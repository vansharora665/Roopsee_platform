import { apiResponse, handleApiError } from "@/lib/api";
import { createReport, listReports } from "@/lib/report/report-service";
import { createReportRequestSchema, reportStatusSchema } from "@/lib/validators/report";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const reports = await listReports(status ? reportStatusSchema.parse(status) : undefined);

    return apiResponse(reports);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const report = await createReport(createReportRequestSchema.parse(body));

    return apiResponse(report, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
