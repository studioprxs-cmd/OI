import { Choice } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getParticipationBlockReason } from "@/lib/topic-policy";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const topic = await db.topic.findUnique({
    where: { id },
    select: { id: true, status: true, closeAt: true },
  });
  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  const participationBlockReason = getParticipationBlockReason(topic);
  if (participationBlockReason) {
    return NextResponse.json({ ok: false, data: null, error: participationBlockReason }, { status: 409 });
  }

  const user = await getAuthUser(req);
  const guard = requireUser(user);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const authUser = user!;
  const body = await req.json();

  const amount = Number(body.amount);
  const choice = String(body.choice ?? "").toUpperCase() as Choice;

  if (choice !== "YES" && choice !== "NO") {
    return NextResponse.json({ ok: false, data: null, error: "choice must be YES or NO" }, { status: 400 });
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, data: null, error: "amount must be a positive integer" }, { status: 400 });
  }

  const dbUser = await db.user.findUnique({ where: { id: authUser.id } });
  if (!dbUser) {
    return NextResponse.json({ ok: false, data: null, error: "User not found" }, { status: 404 });
  }

  if (dbUser.pointBalance < amount) {
    return NextResponse.json({ ok: false, data: null, error: "Insufficient points" }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const latestTopic = await tx.topic.findUnique({
        where: { id },
        select: { status: true, closeAt: true },
      });

      if (!latestTopic) {
        throw new Error("TOPIC_NOT_FOUND");
      }

      const latestParticipationBlockReason = getParticipationBlockReason(latestTopic);
      if (latestParticipationBlockReason) {
        throw new Error(`TOPIC_BLOCKED:${latestParticipationBlockReason}`);
      }

      const updatedUser = await tx.user.update({
        where: { id: authUser.id },
        data: { pointBalance: { decrement: amount } },
      });

      const bet = await tx.bet.create({
        data: {
          topicId: id,
          userId: authUser.id,
          choice,
          amount,
        },
      });

      const walletTx = await tx.walletTransaction.create({
        data: {
          userId: authUser.id,
          type: "BET_PLACE",
          amount: -amount,
          balanceAfter: updatedUser.pointBalance,
          relatedBetId: bet.id,
          note: `Bet on topic:${id}`,
        },
      });

      return { bet, walletTx, balance: updatedUser.pointBalance };
    });

    return NextResponse.json({ ok: true, data: result, error: null }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (message === "TOPIC_NOT_FOUND") {
      return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
    }

    if (message.startsWith("TOPIC_BLOCKED:")) {
      return NextResponse.json({ ok: false, data: null, error: message.replace("TOPIC_BLOCKED:", "") }, { status: 409 });
    }

    return NextResponse.json({ ok: false, data: null, error: "Failed to place bet" }, { status: 500 });
  }
}
