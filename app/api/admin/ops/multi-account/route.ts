import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { getSuspiciousMultiAccountIps } from "@/lib/security/access-log";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const adminCheck = requireAdmin(user);
  if (!adminCheck.ok) {
    return NextResponse.json({ ok: false, error: adminCheck.error }, { status: adminCheck.status });
  }

  const windowDays = Number(req.nextUrl.searchParams.get("days") ?? 7);
  const minUsers = Number(req.nextUrl.searchParams.get("minUsers") ?? 3);

  const suspicious = await getSuspiciousMultiAccountIps(
    Number.isFinite(windowDays) ? Math.max(1, Math.min(30, Math.floor(windowDays))) : 7,
    Number.isFinite(minUsers) ? Math.max(2, Math.min(20, Math.floor(minUsers))) : 3,
  );

  return NextResponse.json({
    ok: true,
    data: suspicious,
    meta: {
      windowDays: Number.isFinite(windowDays) ? Math.max(1, Math.min(30, Math.floor(windowDays))) : 7,
      minUsers: Number.isFinite(minUsers) ? Math.max(2, Math.min(20, Math.floor(minUsers))) : 3,
      suspiciousIpCount: suspicious.length,
    },
    error: null,
  });
}
