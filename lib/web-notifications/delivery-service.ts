import webpush from "web-push";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  personalizeWebNotificationTemplate
} from "@/lib/web-notifications/template";
import type {
  WebNotificationRecipient,
  WebPushCampaignRecord
} from "@/lib/web-notifications/types";

const PUSH_BUCKET = "roopsee-system-data";
const WEB_PUSH_SUBSCRIPTIONS_PATH = "notifications/web-push-subscriptions.json";
const DEFAULT_OPEN_URL = "/home_2";
const INVALID_STATUS_CODES = new Set([404, 410]);

type StoredWebPushSubscription = {
  user_id?: string | null;
  endpoint?: string | null;
  expiration_time?: number | null;
  keys?: {
    auth?: string | null;
    p256dh?: string | null;
  } | null;
};

type WebPushRecipientResult = {
  user_id: string | null;
  email: string | null;
  name: string;
  title: string;
  body: string;
  subscription_count: number;
  success_count: number;
  failure_count: number;
  invalid_subscription_count: number;
  status: "sent" | "failed" | "skipped";
  reason: string | null;
};

let vapidConfigured = false;

function isMissingObjectError(
  error: { statusCode?: number | string; message?: string } | null | undefined
) {
  const message = String(error?.message || "").toLowerCase();
  return String(error?.statusCode || "") === "404" || message.includes("not found") || message.includes("no such object");
}

function ensureVapidConfigured() {
  if (vapidConfigured) return;

  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY || "";
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY || "";
  const subject = process.env.WEB_PUSH_SUBJECT || "mailto:contact@roopsee.com";

  if (!publicKey || !privateKey) {
    throw new Error("WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY are required on Railway");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

async function listStoredSubscriptions() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(PUSH_BUCKET)
    .download(WEB_PUSH_SUBSCRIPTIONS_PATH);

  if (error) {
    if (isMissingObjectError(error)) return [] as StoredWebPushSubscription[];
    throw error;
  }

  const text = await data.text();
  if (!text.trim()) return [] as StoredWebPushSubscription[];

  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed as StoredWebPushSubscription[] : [];
}

async function removeInvalidSubscriptions(endpoints: string[]) {
  const endpointSet = new Set(endpoints.filter(Boolean));
  if (endpointSet.size === 0) return;

  const existing = await listStoredSubscriptions();
  const next = existing.filter((item) => !endpointSet.has(String(item.endpoint || "")));

  if (next.length === existing.length) return;

  const supabase = getSupabaseAdminClient();
  const payload = Buffer.from(JSON.stringify(next, null, 2), "utf8");
  const { error } = await supabase.storage
    .from(PUSH_BUCKET)
    .upload(WEB_PUSH_SUBSCRIPTIONS_PATH, payload, {
      upsert: true,
      contentType: "application/json"
    });

  if (error) throw error;
}

async function listSubscriptionsByUserId(userId: string | null) {
  if (!userId) return [] as StoredWebPushSubscription[];
  const subscriptions = await listStoredSubscriptions();
  return subscriptions.filter((item) => item.user_id === userId);
}

async function sendToSubscriptions({
  subscriptions,
  title,
  body,
  url,
  tag
}: {
  subscriptions: StoredWebPushSubscription[];
  title: string;
  body: string;
  url: string;
  tag: string;
}) {
  ensureVapidConfigured();

  const validSubscriptions = subscriptions.filter(
    (item) => item.endpoint && item.keys?.auth && item.keys?.p256dh
  );
  const invalidEndpoints: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  const payload = JSON.stringify({
    title,
    body,
    url,
    tag
  });

  for (const subscription of validSubscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: String(subscription.endpoint),
          expirationTime: subscription.expiration_time || null,
          keys: {
            auth: String(subscription.keys?.auth || ""),
            p256dh: String(subscription.keys?.p256dh || "")
          }
        },
        payload
      );
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
      if (INVALID_STATUS_CODES.has(statusCode) && subscription.endpoint) {
        invalidEndpoints.push(subscription.endpoint);
      }
    }
  }

  if (invalidEndpoints.length > 0) {
    await removeInvalidSubscriptions(invalidEndpoints);
  }

  return {
    successCount,
    failureCount,
    invalidEndpoints
  };
}

export async function sendWebCampaignToRecipients({
  recipients,
  titleTemplate,
  bodyTemplate,
  url = DEFAULT_OPEN_URL
}: {
  recipients: WebNotificationRecipient[];
  titleTemplate: string;
  bodyTemplate: string;
  url?: string;
}) {
  const results: WebPushRecipientResult[] = [];

  for (const recipient of recipients) {
    const title = personalizeWebNotificationTemplate(titleTemplate, recipient) || "Roopsee";
    const body = personalizeWebNotificationTemplate(bodyTemplate, recipient);
    const subscriptions = await listSubscriptionsByUserId(recipient.targetUserId);

    if (subscriptions.length === 0) {
      results.push({
        user_id: recipient.targetUserId,
        email: recipient.email,
        name: recipient.name,
        title,
        body,
        subscription_count: 0,
        success_count: 0,
        failure_count: 0,
        invalid_subscription_count: 0,
        status: "skipped",
        reason: "no_web_subscription"
      });
      continue;
    }

    const response = await sendToSubscriptions({
      subscriptions,
      title,
      body,
      url,
      tag: `roopsee-web-${recipient.targetUserId || recipient.key}`
    });

    results.push({
      user_id: recipient.targetUserId,
      email: recipient.email,
      name: recipient.name,
      title,
      body,
      subscription_count: subscriptions.length,
      success_count: response.successCount,
      failure_count: response.failureCount,
      invalid_subscription_count: response.invalidEndpoints.length,
      status: response.successCount > 0 ? "sent" : "failed",
      reason: response.successCount > 0 ? null : "delivery_failed"
    });
  }

  return results.reduce(
    (summary, recipient) => {
      if (recipient.status === "sent") summary.sent_count += 1;
      if (recipient.status === "failed") summary.failure_count += 1;
      if (recipient.status === "skipped") summary.skipped_count += 1;
      summary.success_count += recipient.success_count;
      summary.recipients.push(recipient);
      return summary;
    },
    {
      audience_count: recipients.length,
      sent_count: 0,
      success_count: 0,
      failure_count: 0,
      skipped_count: 0,
      recipients: [] as WebPushRecipientResult[]
    }
  );
}

export async function sendWebPushCampaign(campaign: WebPushCampaignRecord) {
  const recipientKeys = [
    ...campaign.audience.user_ids.map((id) => `user:${id}`),
    ...campaign.audience.emails.map((email) => `email:${email}`)
  ];
  const { getWebNotificationRecipientsByKeys } = await import("@/lib/web-notifications/recipient-service");
  const recipients = await getWebNotificationRecipientsByKeys(recipientKeys);

  return sendWebCampaignToRecipients({
    recipients,
    titleTemplate: campaign.title_template,
    bodyTemplate: campaign.body_template,
    url: campaign.url || DEFAULT_OPEN_URL
  });
}
