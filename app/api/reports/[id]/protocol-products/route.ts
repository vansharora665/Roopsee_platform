import { handleApiError } from "@/lib/api";
import { regenerateProtocolProducts } from "@/lib/report/report-service";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const report = await regenerateProtocolProducts(params.id);
    return Response.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}
