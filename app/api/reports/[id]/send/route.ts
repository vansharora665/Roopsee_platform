import { apiResponse, handleApiError } from "@/lib/api";
import { markReportSent } from "@/lib/report/report-service";

export async function POST(
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
    const report = await markReportSent(params.id);

    return apiResponse(report);
  } catch (error) {
    return handleApiError(error);
  }
}
