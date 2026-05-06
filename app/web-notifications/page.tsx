import { WebNotificationCenter } from "@/components/web-notifications/web-notification-center";
import { listWebPushCampaigns } from "@/lib/web-notifications/campaign-store";
import { listWebNotificationRecipients } from "@/lib/web-notifications/recipient-service";
import {
  processDueWebPushCampaigns,
  startWebPushScheduler
} from "@/lib/web-notifications/scheduler";

export const dynamic = "force-dynamic";

export default async function WebNotificationsPage() {
  startWebPushScheduler();
  await processDueWebPushCampaigns().catch((error) => {
    console.error("Failed to process due web notification campaigns:", error);
  });

  const [recipients, campaigns] = await Promise.all([
    listWebNotificationRecipients(),
    listWebPushCampaigns()
  ]);

  return <WebNotificationCenter campaigns={campaigns} recipients={recipients} />;
}
