import { Choice, TopicStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const user = await getAuthUser(req);
  const guard = requireAdmin(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const authUser = user!;

  const topic = await db.topic.findUnique({ where: { id: id } });
  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  const body = await req.json();
  const result = String(body.result ?? "").toUpperCase() as Choice;
  const summary = String(body.summary ?? "").trim();

  if (result !== "YES" && result !== "NO") {
    return NextResponse.json({ ok: false, data: null, error: "result must be YES or NO" }, { status: 400 });
  }

  if (!summary) {
    return NextResponse.json({ ok: false, data: null, error: "summary is required" }, { status: 400 });
  }

  const resolved = await db.$transaction(async (tx) => {
    const resolution = await tx.resolution.upsert({
      where: { topicId: id },
      update: {
        result,
        summary,
        resolverId: authUser.id,
        resolvedAt: new Date(),
      },
      create: {
        topicId: id,
        result,
        summary,
        resolverId: authUser.id,
      },
    });

    const updatedTopic = await tx.topic.update({
      where: { id: id },
      data: { status: TopicStatus.RESOLVED },
    });

    return { resolution, topic: updatedTopic };
  });

  return NextResponse.json({ ok: true, data: resolved, error: null }, { status: 201 });
}

