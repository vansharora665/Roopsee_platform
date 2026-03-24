import { apiResponse } from "@/lib/api";

export async function GET() {
  return apiResponse({ ok: true, timestamp: new Date().toISOString() });
}
