import { ReportStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { localDeleteReport } from "@/lib/report-local";

type Params = { params: Promise<{ id: string }> };

const ACTIONABLE_STATUSES: ReportStatus[] = ["OPEN", "REVIEWING"];

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  const guard = requireUser(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const authUser = user!;

  if (!process.env.DATABASE_URL) {
    const result = await localDeleteReport({ id, reporterId: authUser.id });

    if (!result) {
      return NextResponse.json({ ok: false, data: null, error: "Report not found" }, { status: 404 });
    }

    if (!result.ok && result.reason === "NOT_ACTIONABLE") {
      return NextResponse.json(
        { ok: false, data: null, error: "처리된 신고는 취소할 수 없습니다." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, data: { id: result.report.id }, error: null });
  }

  const report = await db.report.findUnique({
    where: { id },
    select: { id: true, reporterId: true, status: true },
  });

  if (!report || report.reporterId !== authUser.id) {
    return NextResponse.json({ ok: false, data: null, error: "Report not found" }, { status: 404 });
  }

  if (!ACTIONABLE_STATUSES.includes(report.status)) {
    return NextResponse.json(
      { ok: false, data: null, error: "처리된 신고는 취소할 수 없습니다." },
      { status: 409 },
    );
  }

  await db.report.delete({ where: { id: report.id } });

  return NextResponse.json({ ok: true, data: { id: report.id }, error: null });
}
