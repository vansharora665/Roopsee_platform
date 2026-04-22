import { NotificationCenter } from "@/components/notifications/notification-center";
import { listPushCampaigns } from "@/lib/notifications/campaign-store";
import { listNotificationRecipients } from "@/lib/notifications/recipient-service";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const [recipients, campaigns] = await Promise.all([
    listNotificationRecipients(),
    listPushCampaigns()
  ]);

  return <NotificationCenter campaigns={campaigns} recipients={recipients} />;
}
