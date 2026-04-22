import { z } from "zod";

import { apiResponse, handleApiError } from "@/lib/api";
import {
  buildPushCampaignRecord,
  upsertPushCampaign
} from "@/lib/notifications/campaign-store";
import { getNotificationRecipientsByKeys } from "@/lib/notifications/recipient-service";
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
    const payload = createCampaignSchema.parse(await request.json());
    const recipients = await getNotificationRecipientsByKeys(payload.recipientKeys);

    const sendableRecipients = recipients.filter((recipient) => recipient.sendable);
    if (sendableRecipients.length === 0) {
      throw new Error("Select at least one sendable user");
    }

    const sendAt = payload.sendAt ? new Date(payload.sendAt) : new Date();
    if (Number.isNaN(sendAt.getTime())) {
      throw new Error("Choose a valid date and time");
    }

    const currentUser = await getCurrentUser();
    const campaign = buildPushCampaignRecord({
      createdBy: currentUser?.email ?? currentUser?.id ?? null,
      recipients: sendableRecipients,
      titleTemplate: payload.title,
      bodyTemplate: payload.body,
      url: payload.url,
      sendAt: sendAt.toISOString(),
      status: "scheduled"
    });

    await upsertPushCampaign(campaign);

    return apiResponse({
      campaign,
      queuedRecipientCount: sendableRecipients.length
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
