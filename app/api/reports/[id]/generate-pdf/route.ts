import { apiResponse, handleApiError } from "@/lib/api";
import { generateReportPdf } from "@/lib/pdf/generate-report-pdf";
import { getReportById, saveGeneratedFiles } from "@/lib/report/report-service";

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
    const report = await getReportById(params.id);
    const generated = await generateReportPdf(report);
    const updated = await saveGeneratedFiles(params.id, generated);

    return apiResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
