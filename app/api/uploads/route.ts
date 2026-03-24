import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { apiResponse, handleApiError } from "@/lib/api";
import { getUploadsReportsDir } from "@/lib/storage/files";
import { toSlug } from "@/lib/utils";

const allowedKeys = ["image1", "image2", "image3"] as const;
const uploadMap = {
  image1: "image1Url",
  image2: "image2Url",
  image3: "image3Url"
} as const;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const outputDir = getUploadsReportsDir();
    await mkdir(outputDir, { recursive: true });

    const uploaded: Record<string, string | null> = {
      image1Url: null,
      image2Url: null,
      image3Url: null
    };

    for (const key of allowedKeys) {
      const file = formData.get(key);

      if (!(file instanceof File) || file.size === 0) {
        continue;
      }

      if (!file.type.startsWith("image/")) {
        throw new Error(`${key} must be an image`);
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error(`${key} exceeds the 5 MB upload limit`);
      }

      const extension = file.name.split(".").pop() || "png";
      const safeName = `${Date.now()}-${key}-${toSlug(file.name.replace(/\.[^.]+$/, ""))}.${extension}`;
      const filePath = path.join(outputDir, safeName);

      await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
      uploaded[uploadMap[key]] = `/uploads/reports/${safeName}`;
    }

    return apiResponse(uploaded, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
