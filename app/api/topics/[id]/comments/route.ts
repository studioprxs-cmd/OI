import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findMockTopic } from "@/lib/mock-data";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;

  if (!process.env.DATABASE_URL) {
    const mockTopic = findMockTopic(id);
    if (!mockTopic) {
      return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: mockTopic.comments, error: null });
  }

  const topic = await db.topic.findUnique({ where: { id }, select: { id: true } });
  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  const comments = await db.comment.findMany({
    where: { topicId: id, isHidden: false },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
    },
  });

  return NextResponse.json({ ok: true, data: comments, error: null });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const user = await getAuthUser(req);
  const guard = requireUser(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, data: null, error: "DB is not configured in local mode. comment write is disabled." },
      { status: 503 },
    );
  }

  const topic = await db.topic.findUnique({ where: { id }, select: { id: true } });
  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  const authUser = user!;
  const body = await req.json();
  const content = String(body.content ?? "").trim();

  if (!content) {
    return NextResponse.json({ ok: false, data: null, error: "content is required" }, { status: 400 });
  }

  const comment = await db.comment.create({
    data: {
      topicId: id,
      userId: authUser.id,
      content,
    },
  });

  return NextResponse.json({ ok: true, data: comment, error: null }, { status: 201 });
}
