import { ReportStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { LocalReportStatus, localUpdateReportStatus } from "@/lib/report-local";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES: ReportStatus[] = ["OPEN", "REVIEWING", "CLOSED", "REJECTED"];

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const { id } = await params;
  const body = await req.json();
  const status = String(body.status ?? "").toUpperCase() as ReportStatus;
  const commentVisibility = String(body.commentVisibility ?? "KEEP").toUpperCase() as "KEEP" | "HIDE" | "UNHIDE";

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, data: null, error: "invalid status" }, { status: 400 });
  }

  if (!["KEEP", "HIDE", "UNHIDE"].includes(commentVisibility)) {
    return NextResponse.json({ ok: false, data: null, error: "invalid commentVisibility" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    const report = await localUpdateReportStatus({
      id,
      status: status as LocalReportStatus,
      hideComment: commentVisibility === "HIDE",
    });
    if (!report) {
      return NextResponse.json({ ok: false, data: null, error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: report, error: null });
  }

  const updated = await db.$transaction(async (tx) => {
    const report = await tx.report.findUnique({ where: { id } });
    if (!report) return null;

    await tx.report.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
      },
    });

    if (report.commentId && commentVisibility !== "KEEP") {
      await tx.comment.update({
        where: { id: report.commentId },
        data: { isHidden: commentVisibility === "HIDE" },
      });
    }

    return tx.report.findUnique({
      where: { id },
      include: {
        comment: { select: { id: true, isHidden: true } },
      },
    });
  });

  if (!updated) {
    return NextResponse.json({ ok: false, data: null, error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: updated, error: null });
}
