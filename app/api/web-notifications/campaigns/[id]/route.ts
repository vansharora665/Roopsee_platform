import { apiResponse, handleApiError } from "@/lib/api";
import { updateWebPushCampaign } from "@/lib/web-notifications/campaign-store";

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
    const campaign = await updateWebPushCampaign(params.id, {
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
