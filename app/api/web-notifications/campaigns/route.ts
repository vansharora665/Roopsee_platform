import { z } from "zod";

import { apiResponse, handleApiError } from "@/lib/api";
import {
  buildWebPushCampaignRecord,
  updateWebPushCampaign,
  upsertWebPushCampaign
} from "@/lib/web-notifications/campaign-store";
import { sendWebCampaignToRecipients } from "@/lib/web-notifications/delivery-service";
import { getWebNotificationRecipientsByKeys } from "@/lib/web-notifications/recipient-service";
import {
  processDueWebPushCampaigns,
  startWebPushScheduler
} from "@/lib/web-notifications/scheduler";
import { getCurrentUser } from "@/lib/auth";

const createCampaignSchema = z.object({
  recipientKeys: z.array(z.string().trim().min(1)).min(1),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  url: z.string().trim().min(1).max(255).default("/home_2"),
  sendAt: z
    .string()
    .trim()
    .nullable()
    .optional()
});

export async function POST(request: Request) {
  try {
    startWebPushScheduler();
    await processDueWebPushCampaigns();

    const payload = createCampaignSchema.parse(await request.json());
    const recipients = await getWebNotificationRecipientsByKeys(payload.recipientKeys);

    const sendableRecipients = recipients.filter((recipient) => recipient.sendable);
    if (sendableRecipients.length === 0) {
      throw new Error("Select at least one sendable user");
    }

    const sendAt = payload.sendAt ? new Date(payload.sendAt) : new Date();
    if (Number.isNaN(sendAt.getTime())) {
      throw new Error("Choose a valid date and time");
    }

    const currentUser = await getCurrentUser();
    const campaign = buildWebPushCampaignRecord({
      createdBy: currentUser?.email ?? currentUser?.id ?? null,
      recipients: sendableRecipients,
      titleTemplate: payload.title,
      bodyTemplate: payload.body,
      url: payload.url,
      sendAt: sendAt.toISOString(),
      status: "scheduled"
    });

    await upsertWebPushCampaign(campaign);

    if (sendAt.getTime() <= Date.now()) {
      await updateWebPushCampaign(campaign.id, {
        status: "processing",
        processing_started_at: new Date().toISOString()
      });

      const results = await sendWebCampaignToRecipients({
        recipients: sendableRecipients,
        titleTemplate: payload.title,
        bodyTemplate: payload.body,
        url: payload.url
      });

      const deliveredCampaign = await updateWebPushCampaign(campaign.id, {
        status: results.sent_count > 0 ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        results
      });

      return apiResponse({
        campaign: deliveredCampaign || campaign,
        queuedRecipientCount: sendableRecipients.length,
        results
      }, 201);
    }

    return apiResponse({
      campaign,
      queuedRecipientCount: sendableRecipients.length
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
