import { NextResponse } from "next/server";
import { getCurrentActorEmail } from "../../../../auth-actor";
import { getDashboardStateVersion } from "../../../state-version";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const actorEmail = await getCurrentActorEmail();
  const stateVersion = await getDashboardStateVersion(actorEmail);

  return NextResponse.json(stateVersion, {
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
