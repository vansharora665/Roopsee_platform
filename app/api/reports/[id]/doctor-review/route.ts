import { apiResponse, handleApiError } from "@/lib/api";
import { updateDoctorReview } from "@/lib/report/report-service";
import { doctorReviewUpdateSchema } from "@/lib/validators/report";

export async function PATCH(
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
    const report = await updateDoctorReview(params.id, doctorReviewUpdateSchema.parse(body));

    return apiResponse(report);
  } catch (error) {
    return handleApiError(error);
  }
}
