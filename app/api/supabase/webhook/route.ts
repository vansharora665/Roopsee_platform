import { apiResponse, handleApiError } from "@/lib/api";
import {
  ingestSupabaseWebhookRow,
  syncSupabaseProfileByEmail,
  syncSupabaseProfileByExternalId
} from "@/lib/supabase/profile-service";

function readString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      table?: string;
      record?: Record<string, unknown>;
      new?: Record<string, unknown>;
      [key: string]: unknown;
    };
    const row = body.record ?? body.new ?? body;

    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Webhook payload must contain a master_user_quiz row");
    }

    const record = row as Record<string, unknown>;
    const profileId = readString(record.id);
    const email = readString(record.email);

    if (profileId) {
      const syncedProfile = await syncSupabaseProfileByExternalId(profileId);

      if (syncedProfile) {
        return apiResponse(syncedProfile);
      }
    }

    if (email) {
      const syncedProfile = await syncSupabaseProfileByEmail(email);

      if (syncedProfile) {
        return apiResponse(syncedProfile);
      }
    }

    return apiResponse(await ingestSupabaseWebhookRow(record));
  } catch (error) {
    return handleApiError(error);
  }
}
