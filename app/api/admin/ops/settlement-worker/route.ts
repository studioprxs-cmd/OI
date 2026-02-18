import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { processPendingSettlements } from "@/lib/settlement-job";

const DEFAULT_LIMIT = 20;

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, data: null, error: "DB is not configured in local mode. settlement worker is disabled." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, Math.floor(limitParam))) : DEFAULT_LIMIT;

  const result = await processPendingSettlements(limit);

  return NextResponse.json({ ok: true, data: result, error: null });
}
