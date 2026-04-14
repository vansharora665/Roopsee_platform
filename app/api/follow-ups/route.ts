import { z } from "zod";

import { apiResponse, handleApiError } from "@/lib/api";
import { createFollowUpReport } from "@/lib/report/follow-up-service";

const createFollowUpSchema = z.object({
  syncedProfileId: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { syncedProfileId } = createFollowUpSchema.parse(body);
    const report = await createFollowUpReport(syncedProfileId);

    return apiResponse(report, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
