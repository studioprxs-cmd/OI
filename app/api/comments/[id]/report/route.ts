import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { localCreateReport } from "@/lib/report-local";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: commentId } = await params;

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

  if (!process.env.DATABASE_URL) {
    const report = await localCreateReport({
      reporterId: authUser.id,
      commentId,
      reason,
      detail: detail || null,
    });
    return NextResponse.json({ ok: true, data: report, error: null }, { status: 201 });
  }

  const comment = await db.comment.findUnique({ where: { id: commentId }, select: { id: true, topicId: true } });
  if (!comment) {
    return NextResponse.json({ ok: false, data: null, error: "Comment not found" }, { status: 404 });
  }

  const report = await db.report.create({
    data: {
      reporterId: authUser.id,
      commentId: comment.id,
      topicId: comment.topicId,
      reason,
      detail: detail || null,
    },
  });

  return NextResponse.json({ ok: true, data: report, error: null }, { status: 201 });
}
