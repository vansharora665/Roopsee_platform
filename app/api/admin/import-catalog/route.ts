import { randomUUID } from "crypto";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

import { assertAdminToken, runProjectCommand } from "@/lib/admin/runtime-commands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let tempDir: string | null = null;

  try {
    assertAdminToken(request);

    const formData = await request.formData();
    const workbook = formData.get("workbook");

    if (!(workbook instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Attach the workbook file in the 'workbook' field."
        },
        { status: 400 }
      );
    }

    tempDir = path.join("/tmp", `roopsee-catalog-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    const filePath = path.join(tempDir, workbook.name || "catalog.xlsx");
    const bytes = await workbook.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const result = await runProjectCommand("npx", ["tsx", "scripts/import-product-catalog.ts", filePath]);

    return NextResponse.json({
      ok: true,
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof Error && error.name === "UnauthorizedError" ? 401 : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status }
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
