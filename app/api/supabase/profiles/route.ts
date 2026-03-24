import { apiResponse, handleApiError } from "@/lib/api";
import { listSyncedProfiles, syncSupabaseProfiles } from "@/lib/supabase/profile-service";

export async function GET() {
  try {
    return apiResponse(await listSyncedProfiles());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit = typeof body.limit === "number" ? body.limit : 50;

    return apiResponse(await syncSupabaseProfiles(limit));
  } catch (error) {
    return handleApiError(error);
  }
}
