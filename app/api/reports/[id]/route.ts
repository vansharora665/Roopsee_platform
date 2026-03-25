import { apiResponse, handleApiError } from "@/lib/api";
import { deleteReport, getReportById } from "@/lib/report/report-service";

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

export async function DELETE(
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
    const deleted = await deleteReport(params.id);

    return apiResponse(deleted);
  } catch (error) {
    return handleApiError(error);
  }
}
