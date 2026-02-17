import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { getOpsIssueBurnSnapshot } from "@/lib/ops-dashboard";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const { searchParams } = new URL(req.url);
  const daysParam = Number(searchParams.get("days") ?? 14);
  const days = Number.isFinite(daysParam) ? Math.min(30, Math.max(3, Math.floor(daysParam))) : 14;

  const snapshot = await getOpsIssueBurnSnapshot(days);
  return NextResponse.json({ ok: true, data: snapshot, error: null });
}
