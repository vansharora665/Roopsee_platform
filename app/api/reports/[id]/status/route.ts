import { apiResponse, handleApiError } from "@/lib/api";
import { updateReportStatus } from "@/lib/report/report-service";
import { reportStatusUpdateSchema } from "@/lib/validators/report";

export async function POST(
  request: Request,
  {
    params
  }: {
    params: {
      id: string;
    };
  }
) {
  try {
    const body = await request.json();
    const { status } = reportStatusUpdateSchema.parse(body);
    const report = await updateReportStatus(params.id, status);

    return apiResponse(report);
  } catch (error) {
    return handleApiError(error);
  }
}
