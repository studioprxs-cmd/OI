import { TopicStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureTopicPrefix, TopicKind } from "@/lib/topic";

export async function GET() {
  const topics = await db.topic.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { votes: true, bets: true, comments: true } },
    },
  });

  return NextResponse.json({ ok: true, data: topics, error: null });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const authUser = user!;
  const body = await req.json();

  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const closeAt = body.closeAt ? new Date(body.closeAt) : null;
  const status = (body.status ?? "DRAFT") as TopicStatus;
  const type = String(body.type ?? "BETTING").toUpperCase() as TopicKind;

  if (!title || !description || !closeAt || Number.isNaN(closeAt.getTime())) {
    return NextResponse.json(
      { ok: false, data: null, error: "title, description, closeAt are required" },
      { status: 400 },
    );
  }

  const allowedStatuses: TopicStatus[] = ["DRAFT", "OPEN", "LOCKED", "RESOLVED", "CANCELED"];
  const allowedTypes: TopicKind[] = ["BETTING", "POLL"];
  const finalStatus = allowedStatuses.includes(status) ? status : "DRAFT";

  if (!allowedTypes.includes(type)) {
    return NextResponse.json({ ok: false, data: null, error: "type must be BETTING or POLL" }, { status: 400 });
  }

  const topic = await db.topic.create({
    data: {
      title: ensureTopicPrefix(type, title),
      description,
      closeAt,
      status: finalStatus,
      createdById: authUser.id,
    },
  });

  return NextResponse.json({ ok: true, data: topic, error: null }, { status: 201 });
}
