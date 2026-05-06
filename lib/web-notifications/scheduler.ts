import {
  listWebPushCampaigns,
  updateWebPushCampaign
} from "@/lib/web-notifications/campaign-store";
import { sendWebPushCampaign } from "@/lib/web-notifications/delivery-service";

const SCHEDULER_INTERVAL_MS = 30 * 1000;

let schedulerStarted = false;
let processing = false;

export async function processDueWebPushCampaigns() {
  if (processing) return;
  processing = true;

  try {
    const campaigns = await listWebPushCampaigns();
    const now = Date.now();
    const dueCampaigns = campaigns.filter((campaign) => {
      if (campaign.status !== "scheduled") return false;
      if (!campaign.send_at) return false;
      return new Date(campaign.send_at).getTime() <= now;
    });

    for (const campaign of dueCampaigns) {
      await updateWebPushCampaign(campaign.id, {
        status: "processing",
        processing_started_at: new Date().toISOString()
      });

      try {
        const results = await sendWebPushCampaign(campaign);
        await updateWebPushCampaign(campaign.id, {
          status: results.sent_count > 0 ? "sent" : "failed",
          sent_at: new Date().toISOString(),
          results
        });
      } catch (error) {
        await updateWebPushCampaign(campaign.id, {
          status: "failed",
          sent_at: new Date().toISOString(),
          results: {
            error: error instanceof Error ? error.message : "Failed to send web push"
          }
        });
      }
    }
  } finally {
    processing = false;
  }
}

export function startWebPushScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  setInterval(() => {
    processDueWebPushCampaigns().catch((error) => {
      console.error("Web notification scheduler failed:", error);
    });
  }, SCHEDULER_INTERVAL_MS);
}
