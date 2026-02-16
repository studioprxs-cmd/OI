import { ReportStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { LocalReportStatus, localListReports } from "@/lib/report-local";

const ALLOWED_STATUSES: Array<ReportStatus | "ALL"> = ["ALL", "OPEN", "REVIEWING", "CLOSED", "REJECTED"];

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const { searchParams } = new URL(req.url);
  const rawStatus = String(searchParams.get("status") ?? "ALL").toUpperCase() as ReportStatus | "ALL";
  const status = ALLOWED_STATUSES.includes(rawStatus) ? rawStatus : "ALL";

  if (!process.env.DATABASE_URL) {
    const reports = await localListReports(status === "ALL" ? undefined : (status as LocalReportStatus));
    return NextResponse.json({ ok: true, data: reports, error: null });
  }

  const reports = await db.report.findMany({
    where: status === "ALL" ? undefined : { status: status as ReportStatus },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { id: true, nickname: true, email: true } },
      topic: { select: { id: true, title: true } },
      comment: { select: { id: true, content: true, isHidden: true } },
    },
    take: 200,
  });

  return NextResponse.json({ ok: true, data: reports, error: null });
}
