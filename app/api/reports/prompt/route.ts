import { apiResponse, handleApiError } from "@/lib/api";
import { buildPromptPreview } from "@/lib/report/report-service";
import { createReportRequestSchema } from "@/lib/validators/report";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await buildPromptPreview(createReportRequestSchema.parse(body));

    return apiResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
