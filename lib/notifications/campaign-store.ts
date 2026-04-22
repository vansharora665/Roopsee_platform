import crypto from "crypto";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  NotificationRecipient,
  PushCampaignRecord,
  PushCampaignStatus
} from "@/lib/notifications/types";

const PUSH_BUCKET = "roopsee-system-data";
const PUSH_CAMPAIGNS_PATH = "notifications/push-campaigns.json";

function isMissingObjectError(
  error: { statusCode?: number | string; message?: string } | null | undefined
) {
  const message = String(error?.message || "").toLowerCase();
  return String(error?.statusCode || "") === "404" || message.includes("not found") || message.includes("no such object");
}

function sortCampaigns(campaigns: PushCampaignRecord[] = []) {
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

export async function listPushCampaigns() {
  await ensureBucket();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(PUSH_BUCKET).download(PUSH_CAMPAIGNS_PATH);

  if (error) {
    if (isMissingObjectError(error)) return [];
    throw error;
  }

  const text = await data.text();
  if (!text.trim()) return [];

  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? sortCampaigns(parsed as PushCampaignRecord[]) : [];
}

async function savePushCampaigns(campaigns: PushCampaignRecord[]) {
  await ensureBucket();

  const payload = Buffer.from(JSON.stringify(sortCampaigns(campaigns), null, 2), "utf8");
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(PUSH_BUCKET).upload(PUSH_CAMPAIGNS_PATH, payload, {
    upsert: true,
    contentType: "application/json"
  });

  if (error) throw error;

  return sortCampaigns(campaigns);
}

export async function upsertPushCampaign(campaign: PushCampaignRecord) {
  const campaigns = await listPushCampaigns();
  const nextCampaigns = campaigns.filter((item) => item.id !== campaign.id);
  nextCampaigns.push(campaign);
  await savePushCampaigns(nextCampaigns);
  return campaign;
}

export async function updatePushCampaign(
  campaignId: string,
  updates: Partial<PushCampaignRecord>
) {
  const campaigns = await listPushCampaigns();
  const index = campaigns.findIndex((item) => item.id === campaignId);

  if (index === -1) return null;

  const next = {
    ...campaigns[index],
    ...updates,
    updated_at: new Date().toISOString()
  } satisfies PushCampaignRecord;

  campaigns[index] = next;
  await savePushCampaigns(campaigns);
  return next;
}

export function buildPushCampaignRecord({
  createdBy,
  recipients,
  titleTemplate,
  bodyTemplate,
  url,
  sendAt,
  status = "scheduled"
}: {
  createdBy: string | null | undefined;
  recipients: NotificationRecipient[];
  titleTemplate: string;
  bodyTemplate: string;
  url: string;
  sendAt: string | null;
  status?: PushCampaignStatus;
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
    source: "roopsee-platform"
  } satisfies PushCampaignRecord;
}
