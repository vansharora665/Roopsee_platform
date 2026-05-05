import { prisma } from "@/lib/db/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WebNotificationRecipient } from "@/lib/web-notifications/types";

const PUSH_BUCKET = "roopsee-system-data";
const WEB_PUSH_SUBSCRIPTIONS_PATH = "notifications/web-push-subscriptions.json";

function isMissingObjectError(
  error: { statusCode?: number | string; message?: string } | null | undefined
) {
  const message = String(error?.message || "").toLowerCase();
  return String(error?.statusCode || "") === "404" || message.includes("not found") || message.includes("no such object");
}

function readJsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function pickProductNames(report: {
  doctorReview: { productRows: unknown } | null;
  productMatches: Array<{ product: { brandName: string; productName: string } }>;
}) {
  const fromDoctorReview = readJsonArray(report.doctorReview?.productRows)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const brand = typeof row.brand === "string" ? row.brand.trim() : "";
      const productName =
        typeof row.productName === "string" ? row.productName.trim() : "";
      const combined = [brand, productName].filter(Boolean).join(" - ");
      return combined || null;
    })
    .filter((item): item is string => Boolean(item));

  if (fromDoctorReview.length > 0) {
    return [...new Set(fromDoctorReview)];
  }

  const fromMatches = report.productMatches
    .map((item) => [item.product.brandName, item.product.productName].filter(Boolean).join(" - "))
    .filter(Boolean);

  return [...new Set(fromMatches)];
}

async function fetchAppUsersByEmail(emails: string[]) {
  if (emails.length === 0) {
    return new Map<
      string,
      { id: string; name: string | null; email: string | null; phone_no: string | null }
    >();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, phone_no")
    .in("email", emails);

  if (error) {
    console.error("Failed to load app users for web notifications:", error.message);
    return new Map();
  }

  return new Map(
    (data || [])
      .filter((item) => typeof item.email === "string" && item.email.trim())
      .map((item) => [String(item.email).trim().toLowerCase(), item])
  );
}

async function fetchWebSubscriptionCounts(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, number>();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(PUSH_BUCKET)
    .download(WEB_PUSH_SUBSCRIPTIONS_PATH);

  if (error) {
    if (isMissingObjectError(error)) return new Map();
    console.error("Failed to load web subscription counts:", error.message);
    return new Map();
  }

  const text = await data.text();
  if (!text.trim()) return new Map();

  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : [];
  const userIdSet = new Set(userIds);
  const counts = new Map<string, number>();

  for (const row of rows) {
    const userId = typeof row?.user_id === "string" ? row.user_id : null;
    if (!userId || !userIdSet.has(userId)) continue;
    counts.set(userId, (counts.get(userId) || 0) + 1);
  }

  return counts;
}

export async function listWebNotificationRecipients() {
  const profiles = await prisma.syncedProfile.findMany({
    orderBy: [{ lastSyncedAt: "desc" }, { updatedAt: "desc" }],
    take: 200,
    include: {
      reports: {
        orderBy: [{ createdAt: "desc" }],
        take: 3,
        include: {
          doctorReview: {
            select: {
              productRows: true
            }
          },
          productMatches: {
            orderBy: [{ rank: "asc" }],
            take: 4,
            include: {
              product: {
                select: {
                  brandName: true,
                  productName: true
                }
              }
            }
          }
        }
      }
    }
  });

  const emails = [...new Set(
    profiles
      .map((profile) => profile.email?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value))
  )];
  const appUsersByEmail = await fetchAppUsersByEmail(emails);
  const webSubscriptionCounts = await fetchWebSubscriptionCounts(
    [...new Set(Array.from(appUsersByEmail.values()).map((user) => user.id))]
  );

  const recipients = new Map<string, WebNotificationRecipient>();

  for (const profile of profiles) {
    const normalizedEmail = profile.email?.trim().toLowerCase() || null;
    const appUser = normalizedEmail ? appUsersByEmail.get(normalizedEmail) : null;
    const latestReport = profile.reports[0] || null;
    const suggestedProducts = latestReport ? pickProductNames(latestReport) : [];
    const name =
      appUser?.name?.trim() ||
      profile.fullName?.trim() ||
      normalizedEmail?.split("@")[0] ||
      "Unnamed customer";
    const key = appUser?.id
      ? `user:${appUser.id}`
      : normalizedEmail
        ? `email:${normalizedEmail}`
        : `profile:${profile.id}`;
    const subscriptionCount = appUser?.id ? webSubscriptionCounts.get(appUser.id) || 0 : 0;
    const lastActivity = [
      latestReport?.updatedAt?.toISOString?.() || null,
      profile.lastSyncedAt.toISOString()
    ]
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;

    const candidate: WebNotificationRecipient = {
      key,
      syncedProfileId: profile.id,
      targetUserId: appUser?.id || null,
      name,
      firstName: name.split(/\s+/)[0] || name,
      email: normalizedEmail,
      phone: appUser?.phone_no?.trim() || profile.phone?.trim() || null,
      suggestedProduct: suggestedProducts[0] || null,
      suggestedProducts,
      subscriptionCount,
      hasWebSubscription: subscriptionCount > 0,
      sendable: Boolean(appUser?.id || normalizedEmail),
      latestReportId: latestReport?.id || null,
      latestReportStatus: latestReport?.status || null,
      lastActivityAt: lastActivity
    };

    const existing = recipients.get(key);
    if (!existing) {
      recipients.set(key, candidate);
      continue;
    }

    const existingTime = existing.lastActivityAt ? new Date(existing.lastActivityAt).getTime() : 0;
    const candidateTime = candidate.lastActivityAt ? new Date(candidate.lastActivityAt).getTime() : 0;

    if (candidateTime > existingTime) {
      recipients.set(key, candidate);
    }
  }

  return Array.from(recipients.values()).sort((a, b) => {
    if (a.hasWebSubscription !== b.hasWebSubscription) return a.hasWebSubscription ? -1 : 1;
    if (a.sendable !== b.sendable) return a.sendable ? -1 : 1;
    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function getWebNotificationRecipientsByKeys(keys: string[]) {
  const keySet = new Set(keys);
  const recipients = await listWebNotificationRecipients();
  return recipients.filter((recipient) => keySet.has(recipient.key));
}
