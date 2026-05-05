import { WebNotificationCenter } from "@/components/web-notifications/web-notification-center";
import { listWebPushCampaigns } from "@/lib/web-notifications/campaign-store";
import { listWebNotificationRecipients } from "@/lib/web-notifications/recipient-service";

export const dynamic = "force-dynamic";

export default async function WebNotificationsPage() {
  const [recipients, campaigns] = await Promise.all([
    listWebNotificationRecipients(),
    listWebPushCampaigns()
  ]);

  return <WebNotificationCenter campaigns={campaigns} recipients={recipients} />;
}
