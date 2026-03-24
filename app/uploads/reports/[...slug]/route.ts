import { readFile } from "fs/promises";

import { getContentType, getUploadReportPath } from "@/lib/storage/files";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string[] } }
) {
  try {
    const filePath = getUploadReportPath(params.slug);
    const file = await readFile(filePath);

    return new Response(file, {
      headers: {
        "Content-Type": getContentType(filePath),
        "Cache-Control": "private, max-age=0, must-revalidate"
      }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
