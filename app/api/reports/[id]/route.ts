import { apiResponse, handleApiError } from "@/lib/api";
import { getReportById } from "@/lib/report/report-service";

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: {
      id: string;
    };
  }
) {
  try {
    const report = await getReportById(params.id);

    return apiResponse(report);
  } catch (error) {
    return handleApiError(error);
  }
}
