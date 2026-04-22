export type NotificationRecipient = {
  key: string;
  syncedProfileId: string;
  targetUserId: string | null;
  name: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  suggestedProduct: string | null;
  suggestedProducts: string[];
  tokenCount: number;
  hasPushToken: boolean;
  sendable: boolean;
  latestReportId: string | null;
  latestReportStatus: string | null;
  lastActivityAt: string | null;
};

export type PushCampaignStatus =
  | "scheduled"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";

export type PushCampaignRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  status: PushCampaignStatus;
  title_template: string;
  body_template: string;
  url: string;
  send_at: string | null;
  sent_at: string | null;
  cancelled_at?: string | null;
  processing_started_at?: string | null;
  audience: {
    user_ids: string[];
    emails: string[];
  };
  results?: Record<string, unknown> | null;
  source?: string;
};
