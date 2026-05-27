import { NextResponse } from "next/server";
import { getDashboardStateVersion } from "../../../state-version";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const stateVersion = await getDashboardStateVersion();

  return NextResponse.json(stateVersion, {
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
