import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { getInflationSnapshot } from "@/lib/ops-dashboard";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const snapshot = await getInflationSnapshot(7);
  return NextResponse.json({ ok: true, data: snapshot, error: null });
}
