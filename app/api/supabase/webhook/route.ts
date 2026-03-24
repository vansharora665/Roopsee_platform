import { apiResponse, handleApiError } from "@/lib/api";
import {
  ingestSupabaseWebhookRow,
  syncSupabaseProfileByExternalId
} from "@/lib/supabase/profile-service";

function readString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function looksLikeSkinScansRow(row: Record<string, unknown>) {
  return ["front", "left", "right", "front_url", "left_url", "right_url"].some((key) => key in row);
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
      throw new Error("Webhook payload must contain a profile record");
    }

    const record = row as Record<string, unknown>;
    const table = readString(body.table);
    const profileIdFromUser = readString(record.id);
    const profileIdFromScan = readString(record.user_id) ?? profileIdFromUser;

    if (table === "skin_scans" || looksLikeSkinScansRow(record)) {
      if (!profileIdFromScan) {
        throw new Error("skin_scans webhook payload must include user_id or id");
      }

      const syncedProfile = await syncSupabaseProfileByExternalId(profileIdFromScan);

      if (!syncedProfile) {
        throw new Error(`Could not find matching users row for scan profile ${profileIdFromScan}`);
      }

      return apiResponse(syncedProfile);
    }

    if (profileIdFromUser) {
      const syncedProfile = await syncSupabaseProfileByExternalId(profileIdFromUser);

      if (syncedProfile) {
        return apiResponse(syncedProfile);
      }
    }

    return apiResponse(await ingestSupabaseWebhookRow(record));
  } catch (error) {
    return handleApiError(error);
  }
}
