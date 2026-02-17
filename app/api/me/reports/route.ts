import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { localListReports } from "@/lib/report-local";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireUser(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const authUser = user!;

  if (!process.env.DATABASE_URL) {
    const reports = (await localListReports())
      .filter((report) => report.reporterId === authUser.id)
      .slice(0, 100)
      .map((report) => ({
        id: report.id,
        reason: report.reason,
        detail: report.detail,
        status: report.status,
        createdAt: report.createdAt,
        reviewedAt: report.reviewedAt,
        topicId: report.topicId,
        topicTitle: null,
        commentId: report.commentId,
      }));

    return NextResponse.json({ ok: true, data: reports, error: null });
  }

  const reports = await db.report.findMany({
    where: { reporterId: authUser.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      topic: { select: { id: true, title: true } },
      comment: { select: { id: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    data: reports.map((report) => ({
      id: report.id,
      reason: report.reason,
      detail: report.detail,
      status: report.status,
      createdAt: report.createdAt,
      reviewedAt: report.reviewedAt,
      topicId: report.topicId,
      topicTitle: report.topic?.title ?? null,
      commentId: report.comment?.id ?? report.commentId,
    })),
    error: null,
  });
}
