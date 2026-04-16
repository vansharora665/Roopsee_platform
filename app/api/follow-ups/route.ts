import { z } from "zod";

import { apiResponse, handleApiError } from "@/lib/api";
import { createFollowUpReport } from "@/lib/report/follow-up-service";

const createFollowUpSchema = z.object({
  syncedProfileId: z.string().trim().min(1),
  productRows: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        title: z.string().trim(),
        slot: z.enum(["cleanser", "sunscreen", "moisturizer", "repair_serum"]).nullable(),
        productCatalogId: z.string().trim().nullable(),
        brand: z.string().trim().nullable(),
        company: z.string().trim().nullable(),
        productName: z.string().trim().nullable()
      })
    )
    .optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { syncedProfileId, productRows } = createFollowUpSchema.parse(body);
    const report = await createFollowUpReport(syncedProfileId, productRows);

    return apiResponse(report, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
