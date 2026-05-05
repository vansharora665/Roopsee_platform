import crypto from "crypto";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  WebNotificationRecipient,
  WebPushCampaignRecord
} from "@/lib/web-notifications/types";

const PUSH_BUCKET = "roopsee-system-data";
const WEB_PUSH_CAMPAIGNS_PATH = "notifications/web-push-campaigns.json";

function isMissingObjectError(
  error: { statusCode?: number | string; message?: string } | null | undefined
) {
  const message = String(error?.message || "").toLowerCase();
  return String(error?.statusCode || "") === "404" || message.includes("not found") || message.includes("no such object");
}

function sortCampaigns(campaigns: WebPushCampaignRecord[] = []) {
  return [...campaigns].sort((a, b) => {
    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();
    return bTime - aTime;
  });
}

let bucketReadyPromise: Promise<void> | null = null;

async function ensureBucket() {
  if (!bucketReadyPromise) {
    bucketReadyPromise = (async () => {
      const supabase = getSupabaseAdminClient();
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

      if (listError) throw listError;

      const exists = (buckets || []).some((bucket) => bucket.name === PUSH_BUCKET);
      if (exists) return;

      const { error: createError } = await supabase.storage.createBucket(PUSH_BUCKET, {
        public: false,
        fileSizeLimit: "1MB"
      });

      if (
        createError &&
        !String(createError.message || "").toLowerCase().includes("already exists")
      ) {
        throw createError;
      }
    })().catch((error) => {
      bucketReadyPromise = null;
      throw error;
    });
  }

  return bucketReadyPromise;
}

export async function listWebPushCampaigns() {
  await ensureBucket();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(PUSH_BUCKET).download(WEB_PUSH_CAMPAIGNS_PATH);

  if (error) {
    if (isMissingObjectError(error)) return [];
    throw error;
  }

  const text = await data.text();
  if (!text.trim()) return [];

  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? sortCampaigns(parsed as WebPushCampaignRecord[]) : [];
}

async function saveWebPushCampaigns(campaigns: WebPushCampaignRecord[]) {
  await ensureBucket();

  const payload = Buffer.from(JSON.stringify(sortCampaigns(campaigns), null, 2), "utf8");
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(PUSH_BUCKET).upload(WEB_PUSH_CAMPAIGNS_PATH, payload, {
    upsert: true,
    contentType: "application/json"
  });

  if (error) throw error;

  return sortCampaigns(campaigns);
}

export async function upsertWebPushCampaign(campaign: WebPushCampaignRecord) {
  const campaigns = await listWebPushCampaigns();
  const nextCampaigns = campaigns.filter((item) => item.id !== campaign.id);
  nextCampaigns.push(campaign);
  await saveWebPushCampaigns(nextCampaigns);
  return campaign;
}

export async function updateWebPushCampaign(
  campaignId: string,
  updates: Partial<WebPushCampaignRecord>
) {
  const campaigns = await listWebPushCampaigns();
  const index = campaigns.findIndex((item) => item.id === campaignId);

  if (index === -1) return null;

  const next = {
    ...campaigns[index],
    ...updates,
    updated_at: new Date().toISOString()
  } satisfies WebPushCampaignRecord;

  campaigns[index] = next;
  await saveWebPushCampaigns(campaigns);
  return next;
}

export function buildWebPushCampaignRecord({
  createdBy,
  recipients,
  titleTemplate,
  bodyTemplate,
  url,
  sendAt,
  status = "scheduled"
}: {
  createdBy: string | null | undefined;
  recipients: WebNotificationRecipient[];
  titleTemplate: string;
  bodyTemplate: string;
  url: string;
  sendAt: string | null;
  status?: WebPushCampaignRecord["status"];
}) {
  const now = new Date().toISOString();
  const userIds = recipients.map((recipient) => recipient.targetUserId).filter(Boolean) as string[];
  const emails = recipients
    .filter((recipient) => !recipient.targetUserId)
    .map((recipient) => recipient.email?.trim().toLowerCase())
    .filter(Boolean) as string[];

  return {
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    created_by: createdBy || null,
    status,
    title_template: titleTemplate || "Roopsee",
    body_template: bodyTemplate,
    url,
    send_at: sendAt,
    sent_at: status === "sent" ? now : null,
    audience: {
      user_ids: [...new Set(userIds)],
      emails: [...new Set(emails)]
    },
    results: null,
    source: "roopsee-platform-web"
  } satisfies WebPushCampaignRecord;
}
