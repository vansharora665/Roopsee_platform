import { apiResponse, handleApiError } from "@/lib/api";
import { updatePushCampaign } from "@/lib/notifications/campaign-store";

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
    const campaign = await updatePushCampaign(params.id, {
      status: "cancelled",
      cancelled_at: new Date().toISOString()
    });

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    return apiResponse(campaign);
  } catch (error) {
    return handleApiError(error);
  }
}
