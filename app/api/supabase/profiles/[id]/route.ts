import { apiResponse, handleApiError } from "@/lib/api";
import { getSyncedProfileById } from "@/lib/supabase/profile-service";

export async function GET(
  _request: Request,
  context: {
    params: {
      id: string;
    };
  }
) {
  try {
    const profile = await getSyncedProfileById(context.params.id);

    if (!profile) {
      throw new Error("Supabase profile not found");
    }

    return apiResponse(profile);
  } catch (error) {
    return handleApiError(error);
  }
}
