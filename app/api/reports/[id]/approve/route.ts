import { apiResponse, handleApiError } from "@/lib/api";
import { approveReport } from "@/lib/report/report-service";

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
    const report = await approveReport(params.id);

    return apiResponse(report);
  } catch (error) {
    return handleApiError(error);
  }
}
