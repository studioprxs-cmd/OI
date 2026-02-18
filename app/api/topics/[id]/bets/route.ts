import { Choice } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { BET_LIMITS } from "@/lib/betting-policy";
import { localAdjustUserPoints, localFindUserById } from "@/lib/auth-local";
import { calcEstimatedPayout, calcPrices } from "@/lib/betting/price";
import { setTopicPoolStatsCache } from "@/lib/betting/pool-cache";
import { assertBetAmount, assertDailyLimit, assertLossCooldown, assertPoolShare } from "@/lib/betting/validation";
import { db } from "@/lib/db";
import { addLocalBet, getLocalTopicInteractions } from "@/lib/local-topic-interactions";
import { findMockTopic } from "@/lib/mock-data";
import { parseTopicKindFromTitle } from "@/lib/topic";
import { getParticipationBlockReason } from "@/lib/topic-policy";
import { getKstDayRange } from "@/lib/time-window";
import { applyWalletDelta } from "@/lib/wallet";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const useLocal = !process.env.DATABASE_URL;

  const topic = useLocal
    ? findMockTopic(id)
    : await db.topic.findUnique({
      where: { id },
      select: { id: true, title: true, status: true, closeAt: true },
    });

  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  const topicKind = parseTopicKindFromTitle(topic.title);
  if (topicKind !== "BETTING") {
    return NextResponse.json({ ok: false, data: null, error: "이 토픽은 베팅 없이 여론 투표만 가능합니다." }, { status: 409 });
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

  try {
    assertBetAmount(amount);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "BET_AMOUNT_INVALID:amount must be a positive integer";
    return NextResponse.json({ ok: false, data: null, error: message.replace("BET_AMOUNT_INVALID:", "") }, { status: 400 });
  }

  if (useLocal) {
    const localUser = await localFindUserById(authUser.id);
    if (!localUser) {
      return NextResponse.json({ ok: false, data: null, error: "User not found" }, { status: 404 });
    }

    if (localUser.pointBalance < amount) {
      return NextResponse.json({ ok: false, data: null, error: "Insufficient points" }, { status: 400 });
    }

    const local = await getLocalTopicInteractions(id);
    const yesPool = local.bets.filter((bet) => bet.choice === "YES").reduce((sum, bet) => sum + bet.amount, 0);
    const noPool = local.bets.filter((bet) => bet.choice === "NO").reduce((sum, bet) => sum + bet.amount, 0);

    const priceSnapshot = calcPrices(yesPool, noPool);
    const estimatedPayout = calcEstimatedPayout(amount, choice, yesPool, noPool);
    const priceCents = choice === "YES" ? priceSnapshot.yesCents : priceSnapshot.noCents;

    const wallet = await localAdjustUserPoints(authUser.id, -amount).catch(() => null);
    if (!wallet) {
      return NextResponse.json({ ok: false, data: null, error: "Insufficient points" }, { status: 400 });
    }

    const bet = await addLocalBet({ topicId: id, userId: authUser.id, choice, amount });

    const nextYesPool = choice === "YES" ? yesPool + amount : yesPool;
    const nextNoPool = choice === "NO" ? noPool + amount : noPool;

    await setTopicPoolStatsCache(id, nextYesPool, nextNoPool);

    return NextResponse.json({
      ok: true,
      data: {
        bet,
        balance: wallet.pointBalance,
        priceCents,
        estimatedPayout,
        newPoolStats: {
          yesPool: nextYesPool,
          noPool: nextNoPool,
          totalPool: nextYesPool + nextNoPool,
        },
      },
      error: null,
    }, { status: 201 });
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
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bet-user:${authUser.id}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bet-topic:${id}`}))`;

      const latestTopic = await tx.topic.findUnique({
        where: { id },
        select: { title: true, status: true, closeAt: true },
      });

      if (!latestTopic) {
        throw new Error("TOPIC_NOT_FOUND");
      }

      const latestTopicKind = parseTopicKindFromTitle(latestTopic.title);
      if (latestTopicKind !== "BETTING") {
        throw new Error("TOPIC_NOT_BETTING");
      }

      const latestParticipationBlockReason = getParticipationBlockReason(latestTopic);
      if (latestParticipationBlockReason) {
        throw new Error(`TOPIC_BLOCKED:${latestParticipationBlockReason}`);
      }

      const recentSettledBets = await tx.bet.findMany({
        where: {
          userId: authUser.id,
          settled: true,
        },
        orderBy: { createdAt: "desc" },
        take: BET_LIMITS.COOLDOWN_AFTER_LOSSES,
        select: { payoutAmount: true, createdAt: true },
      });

      assertLossCooldown(recentSettledBets);

      const { start: todayStartKst, end: todayEndKst } = getKstDayRange();

      const [userTopicTotal, topicPoolTotal, userTodayTotal] = await Promise.all([
        tx.bet.aggregate({
          _sum: { amount: true },
          where: { topicId: id, userId: authUser.id },
        }),
        tx.bet.aggregate({
          _sum: { amount: true },
          where: { topicId: id },
        }),
        tx.bet.aggregate({
          _sum: { amount: true },
          where: {
            userId: authUser.id,
            createdAt: {
              gte: todayStartKst,
              lt: todayEndKst,
            },
          },
        }),
      ]);

      const currentUserTopicTotal = userTopicTotal._sum.amount ?? 0;
      const currentTopicPoolTotal = topicPoolTotal._sum.amount ?? 0;
      const currentUserTodayTotal = userTodayTotal._sum.amount ?? 0;

      assertDailyLimit(currentUserTodayTotal, amount);
      assertPoolShare(currentTopicPoolTotal, currentUserTopicTotal, amount);

      const [yesPoolAgg, noPoolAgg] = await Promise.all([
        tx.bet.aggregate({
          _sum: { amount: true },
          where: { topicId: id, choice: "YES" },
        }),
        tx.bet.aggregate({
          _sum: { amount: true },
          where: { topicId: id, choice: "NO" },
        }),
      ]);

      const beforeYesPool = yesPoolAgg._sum.amount ?? 0;
      const beforeNoPool = noPoolAgg._sum.amount ?? 0;
      const priceSnapshot = calcPrices(beforeYesPool, beforeNoPool);
      const priceCents = choice === "YES" ? priceSnapshot.yesCents : priceSnapshot.noCents;
      const estimatedPayout = calcEstimatedPayout(amount, choice, beforeYesPool, beforeNoPool);

      const walletBeforeBet = await applyWalletDelta({
        tx,
        userId: authUser.id,
        amount: -amount,
        type: "BET_PLACE",
        note: `Bet on topic:${id}`,
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "WALLET_FAILURE";
        if (message === "WALLET_INSUFFICIENT_BALANCE") {
          throw new Error("INSUFFICIENT_POINTS_RACE");
        }
        if (message === "WALLET_USER_NOT_FOUND") {
          throw new Error("USER_NOT_FOUND");
        }
        throw error;
      });

      const bet = await tx.bet.create({
        data: {
          topicId: id,
          userId: authUser.id,
          choice,
          amount,
        },
      });

      const walletTx = await tx.walletTransaction.update({
        where: { id: walletBeforeBet.transaction.id },
        data: { relatedBetId: bet.id },
      });

      const nextYesPool = choice === "YES" ? beforeYesPool + amount : beforeYesPool;
      const nextNoPool = choice === "NO" ? beforeNoPool + amount : beforeNoPool;

      return {
        bet,
        walletTx,
        balance: walletBeforeBet.balanceAfter,
        priceCents,
        estimatedPayout,
        newPoolStats: {
          yesPool: nextYesPool,
          noPool: nextNoPool,
          totalPool: nextYesPool + nextNoPool,
        },
      };
    });

    await setTopicPoolStatsCache(id, result.newPoolStats.yesPool, result.newPoolStats.noPool);

    return NextResponse.json({ ok: true, data: result, error: null }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (message === "TOPIC_NOT_FOUND") {
      return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
    }

    if (message === "TOPIC_NOT_BETTING") {
      return NextResponse.json({ ok: false, data: null, error: "이 토픽은 베팅 없이 여론 투표만 가능합니다." }, { status: 409 });
    }

    if (message.startsWith("TOPIC_BLOCKED:")) {
      return NextResponse.json({ ok: false, data: null, error: message.replace("TOPIC_BLOCKED:", "") }, { status: 409 });
    }

    if (message === "INSUFFICIENT_POINTS_RACE") {
      return NextResponse.json({ ok: false, data: null, error: "Insufficient points" }, { status: 400 });
    }

    if (message === "DAILY_LIMIT_EXCEEDED") {
      return NextResponse.json({ ok: false, data: null, error: `일일 베팅 한도(${BET_LIMITS.DAILY_LIMIT}pt)를 초과했습니다.` }, { status: 409 });
    }

    if (message === "POOL_SHARE_EXCEEDED") {
      return NextResponse.json(
        { ok: false, data: null, error: `한 토픽에서 개인 베팅 점유율은 최대 ${Math.round(BET_LIMITS.MAX_POOL_SHARE * 100)}%입니다.` },
        { status: 409 },
      );
    }

    if (message.startsWith("COOLDOWN_ACTIVE:")) {
      const remainingMs = Number(message.split(":")[1] ?? 0);
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
      return NextResponse.json(
        { ok: false, data: null, error: `연속 손실 보호가 적용되어 있습니다. 약 ${remainingMinutes}분 후 다시 시도해주세요.` },
        { status: 409 },
      );
    }

    if (message === "USER_NOT_FOUND") {
      return NextResponse.json({ ok: false, data: null, error: "User not found" }, { status: 404 });
    }

    if (message === "WALLET_BALANCE_WRITE_RACE") {
      return NextResponse.json(
        { ok: false, data: null, error: "포인트 잔액 반영 중 동시성 충돌이 발생했습니다. 잠시 후 다시 시도해주세요." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: false, data: null, error: "Failed to place bet" }, { status: 500 });
  }
}
