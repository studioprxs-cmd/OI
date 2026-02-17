import { ReportStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { localCreateReport, localHasActiveTopicReport } from "@/lib/report-local";

type Params = { params: Promise<{ id: string }> };

const ACTIVE_REPORT_STATUSES: ReportStatus[] = ["OPEN", "REVIEWING"];

export async function POST(req: NextRequest, { params }: Params) {
  const { id: topicId } = await params;

  const user = await getAuthUser(req);
  const guard = requireUser(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const authUser = user!;
  const body = await req.json();
  const reason = String(body.reason ?? "").trim();
  const detail = String(body.detail ?? "").trim();

  if (!reason) {
    return NextResponse.json({ ok: false, data: null, error: "reason is required" }, { status: 400 });
  }

  if (reason.length > 80) {
    return NextResponse.json({ ok: false, data: null, error: "reason is too long (max 80 chars)" }, { status: 400 });
  }

  if (detail.length > 500) {
    return NextResponse.json({ ok: false, data: null, error: "detail is too long (max 500 chars)" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    const hasActiveReport = await localHasActiveTopicReport({ reporterId: authUser.id, topicId });
    if (hasActiveReport) {
      return NextResponse.json(
        { ok: false, data: null, error: "이미 접수된 신고가 검토 중입니다." },
        { status: 409 },
      );
    }

    const report = await localCreateReport({
      reporterId: authUser.id,
      topicId,
      reason,
      detail: detail || null,
    });
    return NextResponse.json({ ok: true, data: report, error: null }, { status: 201 });
  }

  const topic = await db.topic.findUnique({
    where: { id: topicId },
    select: { id: true, createdById: true },
  });
  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  if (topic.createdById && topic.createdById === authUser.id) {
    return NextResponse.json(
      { ok: false, data: null, error: "본인이 작성한 토픽은 신고할 수 없습니다." },
      { status: 403 },
    );
  }

  const hasActiveReport = await db.report.findFirst({
    where: {
      reporterId: authUser.id,
      topicId,
      commentId: null,
      status: { in: ACTIVE_REPORT_STATUSES },
    },
    select: { id: true },
  });

  if (hasActiveReport) {
    return NextResponse.json(
      { ok: false, data: null, error: "이미 접수된 신고가 검토 중입니다." },
      { status: 409 },
    );
  }

  const report = await db.report.create({
    data: {
      reporterId: authUser.id,
      topicId,
      reason,
      detail: detail || null,
    },
  });

  return NextResponse.json({ ok: true, data: report, error: null }, { status: 201 });
}
