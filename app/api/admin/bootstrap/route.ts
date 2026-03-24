import { NextResponse } from "next/server";

import { assertAdminToken, runProjectCommand } from "@/lib/admin/runtime-commands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertAdminToken(request);

    const dbPush = await runProjectCommand("npx", ["prisma", "db", "push", "--skip-generate"]);
    const seed = await runProjectCommand("npx", ["tsx", "scripts/seed.ts"]);

    return NextResponse.json({
      ok: true,
      steps: {
        dbPush,
        seed
      }
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
  }
}
