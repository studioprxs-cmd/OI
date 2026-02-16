import { Choice } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const topic = await db.topic.findUnique({ where: { id } });
  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
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

  const result = await db.$transaction(async (tx) => {
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
}
