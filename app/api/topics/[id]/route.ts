import { NextResponse } from "next/server";

import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;

  const topic = await db.topic.findUnique({
    where: { id },
    include: {
      votes: true,
      bets: true,
      comments: {
        where: { isHidden: false },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: { select: { votes: true, bets: true, comments: true } },
    },
  });

  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: topic, error: null });
}
