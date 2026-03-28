import { apiResponse, handleApiError } from "@/lib/api";
import { syncSupabaseProfiles } from "@/lib/supabase/profile-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return apiResponse(await syncSupabaseProfiles(100));
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
