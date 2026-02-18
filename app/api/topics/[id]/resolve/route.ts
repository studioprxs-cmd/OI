import { Choice, Prisma, TopicStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueueSettlementJob } from "@/lib/settlement-job";
import { calculateSettlement } from "@/lib/settlement";

type Params = { params: Promise<{ id: string }> };

const MIN_RESOLUTION_SUMMARY_LENGTH = 12;
const MAX_PAYOUT_DELTA_TOLERANCE = 0;
const SETTLEMENT_FEE_RATE = 0.05;

async function requireAdminUser(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireAdmin(user);

  if (!guard.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status }),
    };
  }

  return { ok: true as const, user: user! };
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAdminUser(req);
  if (!auth.ok) return auth.response;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, data: null, error: "DB is not configured in local mode. resolve/settlement preview is disabled." },
      { status: 503 },
    );
  }

  const { id } = await params;

  const topic = await db.topic.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      resolution: { select: { id: true, result: true, resolvedAt: true } },
      settlement: {
        select: {
          id: true,
          totalPool: true,
          feeRate: true,
          feeCollected: true,
          netPool: true,
          payoutTotal: true,
          winnerCount: true,
          settledAt: true,
        },
      },
    },
  });

  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  const unsettledBets = await db.bet.findMany({
    where: { topicId: id, settled: false },
    select: { id: true, userId: true, choice: true, amount: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const yesPreview = calculateSettlement(unsettledBets, "YES", { feeRate: SETTLEMENT_FEE_RATE });
  const noPreview = calculateSettlement(unsettledBets, "NO", { feeRate: SETTLEMENT_FEE_RATE });

  const resolvedSettlement = topic.resolution
    ? await db.bet
        .findMany({
          where: { topicId: id, settled: true },
          select: {
            id: true,
            choice: true,
            amount: true,
            payoutAmount: true,
            user: {
              select: {
                id: true,
                nickname: true,
                email: true,
              },
            },
          },
          orderBy: [{ payoutAmount: "desc" }, { amount: "desc" }, { createdAt: "asc" }],
        })
        .then((settledBets) => {
          const totalBets = settledBets.length;
          const payoutTotal = settledBets.reduce((sum, bet) => sum + (bet.payoutAmount ?? 0), 0);
          const winnerCount = settledBets.filter((bet) => bet.choice === topic.resolution?.result).length;
          const winnerPool = settledBets
            .filter((bet) => bet.choice === topic.resolution?.result)
            .reduce((sum, bet) => sum + bet.amount, 0);
          const totalPool = settledBets.reduce((sum, bet) => sum + bet.amount, 0);

          return {
            totalBets,
            payoutTotal,
            winnerCount,
            winnerPool,
            totalPool,
            topPayouts: settledBets
              .filter((bet) => (bet.payoutAmount ?? 0) > 0)
              .slice(0, 5)
              .map((bet) => ({
                betId: bet.id,
                userId: bet.user.id,
                userLabel: bet.user.nickname || bet.user.email || bet.user.id,
                payoutAmount: bet.payoutAmount ?? 0,
                amount: bet.amount,
                choice: bet.choice,
              })),
          };
        })
    : null;

  return NextResponse.json({
    ok: true,
    data: {
      topic,
      unsettledBetCount: unsettledBets.length,
      preview: {
        YES: yesPreview.summary,
        NO: noPreview.summary,
      },
      resolvedSettlement,
    },
    error: null,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const auth = await requireAdminUser(req);
  if (!auth.ok) return auth.response;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, data: null, error: "DB is not configured in local mode. resolve/settlement is disabled." },
      { status: 503 },
    );
  }

  const topic = await db.topic.findUnique({ where: { id } });
  if (!topic) {
    return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
  }

  const body = await req.json();
  const result = String(body.result ?? "").toUpperCase() as Choice;
  const summary = String(body.summary ?? "").trim();
  const confirmNoWinner = Boolean(body.confirmNoWinner);

  if (result !== "YES" && result !== "NO") {
    return NextResponse.json({ ok: false, data: null, error: "result must be YES or NO" }, { status: 400 });
  }

  if (!summary) {
    return NextResponse.json({ ok: false, data: null, error: "summary is required" }, { status: 400 });
  }

  if (summary.length < MIN_RESOLUTION_SUMMARY_LENGTH) {
    return NextResponse.json(
      { ok: false, data: null, error: `summary must be at least ${MIN_RESOLUTION_SUMMARY_LENGTH} characters` },
      { status: 400 },
    );
  }

  try {
    const queuedResolution = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`resolve-topic:${id}`}))`;

      const currentTopic = await tx.topic.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          resolution: { select: { id: true } },
          settlement: { select: { id: true } },
        },
      });

      if (!currentTopic) {
        throw new Error("TOPIC_NOT_FOUND");
      }

      if (currentTopic.status === TopicStatus.RESOLVED || currentTopic.resolution || currentTopic.settlement) {
        throw new Error("ALREADY_RESOLVED");
      }

      if (currentTopic.status === TopicStatus.CANCELED) {
        throw new Error("CANCELED_TOPIC_RESOLVE_BLOCKED");
      }

      if (currentTopic.status === TopicStatus.DRAFT) {
        throw new Error("DRAFT_TOPIC_RESOLVE_BLOCKED");
      }

      const hasSettledBet = await tx.bet.findFirst({
        where: { topicId: id, settled: true },
        select: { id: true },
      });

      if (hasSettledBet) {
        throw new Error("SETTLEMENT_ALREADY_PROCESSED");
      }

      const bets = await tx.bet.findMany({
        where: { topicId: id, settled: false },
        select: { id: true, userId: true, choice: true, amount: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      const settlement = calculateSettlement(bets, result, { feeRate: SETTLEMENT_FEE_RATE });

      if (bets.length > 0 && settlement.summary.winnerPool === 0 && !confirmNoWinner) {
        throw new Error("NO_WINNER_CONFIRM_REQUIRED");
      }

      if (settlement.summary.invalidAmountCount > 0) {
        throw new Error("INVALID_BET_AMOUNT_DETECTED");
      }

      if (settlement.summary.duplicateBetIdCount > 0) {
        throw new Error("DUPLICATE_BET_ID_DETECTED");
      }

      const payoutDelta = settlement.summary.netPool - settlement.summary.payoutTotal;
      if (bets.length > 0 && Math.abs(payoutDelta) > MAX_PAYOUT_DELTA_TOLERANCE) {
        throw new Error("PAYOUT_INTEGRITY_VIOLATION");
      }

      const resolution = await tx.resolution.create({
        data: {
          topicId: id,
          result,
          summary,
          resolverId: auth.user.id,
        },
      });

      const lockedTopic = await tx.topic.update({
        where: { id },
        data: { status: TopicStatus.LOCKED },
      });

      return {
        resolution,
        topic: lockedTopic,
        settlementPreview: settlement.summary,
      };
    });

    const enqueueResult = await enqueueSettlementJob({ topicId: id, settledById: auth.user.id });

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...queuedResolution,
          settlementQueue: enqueueResult,
          message: "Resolution saved. Settlement queued for worker processing.",
        },
        error: null,
      },
      { status: 202 },
    );
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { ok: false, data: null, error: "이미 해결/정산 완료된 토픽입니다." },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (message === "TOPIC_NOT_FOUND") {
      return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
    }

    if (message === "ALREADY_RESOLVED") {
      return NextResponse.json(
        { ok: false, data: null, error: "이미 해결/정산 완료된 토픽입니다." },
        { status: 409 },
      );
    }

    if (message === "SETTLEMENT_ALREADY_PROCESSED") {
      return NextResponse.json(
        { ok: false, data: null, error: "Settlement already processed for this topic" },
        { status: 409 },
      );
    }

    if (message === "CANCELED_TOPIC_RESOLVE_BLOCKED") {
      return NextResponse.json(
        { ok: false, data: null, error: "취소된 토픽(CANCELED)은 정산 처리할 수 없습니다." },
        { status: 409 },
      );
    }

    if (message === "DRAFT_TOPIC_RESOLVE_BLOCKED") {
      return NextResponse.json(
        { ok: false, data: null, error: "초안 토픽(DRAFT)은 정산 처리할 수 없습니다." },
        { status: 409 },
      );
    }

    if (message === "NO_WINNER_CONFIRM_REQUIRED") {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "선택한 결과에 승리 베팅이 없습니다. 0pt 지급 정산을 진행하려면 confirmNoWinner=true로 다시 요청하세요.",
        },
        { status: 409 },
      );
    }

    if (message === "INVALID_BET_AMOUNT_DETECTED") {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "비정상 베팅 금액(0 이하 또는 유효하지 않은 값)이 감지되어 정산을 중단했습니다. 베팅 데이터 정합성을 먼저 복구하세요.",
        },
        { status: 409 },
      );
    }

    if (message === "DUPLICATE_BET_ID_DETECTED") {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "중복 bet ID가 감지되어 정산을 차단했습니다. 데이터 정합성을 점검한 뒤 다시 시도하세요.",
        },
        { status: 409 },
      );
    }

    if (message === "PAYOUT_INTEGRITY_VIOLATION") {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "수수료 차감 후 순지급 풀(net pool)과 총 지급 합계가 일치하지 않아 정산을 차단했습니다. 무결성 점검 후 다시 시도하세요.",
        },
        { status: 409 },
      );
    }

    if (message === "DUPLICATE_SETTLEMENT_TX_DETECTED") {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "동일 베팅에 대한 중복 정산 트랜잭션이 감지되어 정산을 차단했습니다. 원장 정합성을 점검한 뒤 다시 시도하세요.",
        },
        { status: 409 },
      );
    }

    if (message === "WALLET_TX_DUPLICATE_REFERENCE") {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "정산 지급 원장에서 중복 레퍼런스가 감지되었습니다. 중복 지급을 막기 위해 정산을 중단했습니다.",
        },
        { status: 409 },
      );
    }

    if (message === "BET_ALREADY_SETTLED_RACE") {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "정산 처리 중 동시성 충돌이 발생해 일부 베팅이 이미 정산되었습니다. 잠시 후 다시 시도하세요.",
        },
        { status: 409 },
      );
    }

    if (message === "SETTLEMENT_PAYOUT_SUM_MISMATCH") {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "정산 지급 합계 검증에 실패하여 정산을 중단했습니다. 데이터 정합성을 점검한 뒤 다시 시도하세요.",
        },
        { status: 409 },
      );
    }

    if (
      message === "PARTIAL_SETTLEMENT_LEDGER_MISSING"
      || message === "PARTIAL_SETTLEMENT_LEDGER_UNEXPECTED"
      || message === "PARTIAL_SETTLEMENT_LEDGER_USER_MISMATCH"
      || message === "PARTIAL_SETTLEMENT_LEDGER_AMOUNT_MISMATCH"
      || message === "PARTIAL_SETTLEMENT_LEDGER_TYPE_MISMATCH"
      || message === "PARTIAL_SETTLEMENT_PAYOUT_MISMATCH"
    ) {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "기존 부분 정산 원장과 현재 정산 계산 결과가 일치하지 않아 정산을 중단했습니다. 원장 정합성을 점검한 뒤 다시 시도하세요.",
        },
        { status: 409 },
      );
    }

    if (message === "WALLET_BALANCE_WRITE_RACE") {
      return NextResponse.json(
        {
          ok: false,
          data: null,
          error: "정산 지급 반영 중 동시성 충돌이 발생했습니다. 잠시 후 다시 시도하세요.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: false, data: null, error: "정산 처리 실패" }, { status: 500 });
  }
}
