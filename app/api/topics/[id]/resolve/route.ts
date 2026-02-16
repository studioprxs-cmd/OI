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

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, data: null, error: "DB is not configured in local mode. resolve/settlement is disabled." },
      { status: 503 },
    );
  }

  const authUser = user!;

  const topic = await db.topic.findUnique({ where: { id } });
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

  const hasSettledBet = await db.bet.findFirst({
    where: { topicId: id, settled: true },
    select: { id: true },
  });

  if (hasSettledBet) {
    return NextResponse.json(
      { ok: false, data: null, error: "Settlement already processed for this topic" },
      { status: 409 },
    );
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

    const bets = await tx.bet.findMany({
      where: { topicId: id, settled: false },
      orderBy: { createdAt: "asc" },
    });

    const totalPool = bets.reduce((sum, bet) => sum + bet.amount, 0);
    const winnerPool = bets.filter((bet) => bet.choice === result).reduce((sum, bet) => sum + bet.amount, 0);

    let settledCount = 0;
    let winnerCount = 0;
    let payoutTotal = 0;

    for (const bet of bets) {
      const won = bet.choice === result;
      const payout = won && winnerPool > 0 ? Math.floor((totalPool * bet.amount) / winnerPool) : 0;

      await tx.bet.update({
        where: { id: bet.id },
        data: {
          settled: true,
          payoutAmount: payout,
        },
      });

      settledCount += 1;

      if (payout > 0) {
        winnerCount += 1;
        const updatedUser = await tx.user.update({
          where: { id: bet.userId },
          data: { pointBalance: { increment: payout } },
          select: { pointBalance: true },
        });

        await tx.walletTransaction.create({
          data: {
            userId: bet.userId,
            type: "BET_SETTLE",
            amount: payout,
            balanceAfter: updatedUser.pointBalance,
            relatedBetId: bet.id,
            note: `Settlement payout for topic:${id}`,
          },
        });

        payoutTotal += payout;
      }
    }

    const updatedTopic = await tx.topic.update({
      where: { id },
      data: { status: TopicStatus.RESOLVED },
    });

    return {
      resolution,
      topic: updatedTopic,
      settlement: {
        totalPool,
        winnerPool,
        settledCount,
        winnerCount,
        payoutTotal,
      },
    };
  });

  return NextResponse.json({ ok: true, data: resolved, error: null }, { status: 201 });
}
