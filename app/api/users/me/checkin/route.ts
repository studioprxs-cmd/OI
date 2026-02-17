import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { localAdjustUserPoints } from "@/lib/auth-local";
import { getAuthUser, requireUser } from "@/lib/auth";
import { CHECKIN_POLICY } from "@/lib/checkin-policy";
import { db } from "@/lib/db";
import { applyWalletDelta } from "@/lib/wallet";

type LocalCheckinData = {
  byUser: Record<string, string[]>;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const LOCAL_CHECKIN_FILE = path.join(DATA_DIR, "daily-checkins.json");

function getKstDayWindow(now = new Date()) {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const base = now.getTime() + kstOffsetMs;
  const dayStartBase = Math.floor(base / 86_400_000) * 86_400_000;
  const start = new Date(dayStartBase - kstOffsetMs);
  const end = new Date(dayStartBase + 86_400_000 - kstOffsetMs);
  const dateKey = new Date(dayStartBase).toISOString().slice(0, 10);
  return { start, end, dateKey };
}

function calcNextDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).getTime() + 86_400_000;
}

function resolveStreakFromDateKeys(rawDateKeys: string[], todayDateKey: string) {
  const uniqueSorted = [...new Set(rawDateKeys)].sort();
  if (uniqueSorted.length === 0) return 0;

  const previousDateKey = new Date(calcNextDateKey(todayDateKey) - 2 * 86_400_000).toISOString().slice(0, 10);
  if (!uniqueSorted.includes(previousDateKey)) {
    return 0;
  }

  let cursor = previousDateKey;
  let streak = 0;

  while (uniqueSorted.includes(cursor)) {
    streak += 1;
    cursor = new Date(new Date(`${cursor}T00:00:00.000Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  }

  return streak;
}

function resolveStreakBonus(streakAfterClaim: number) {
  if (streakAfterClaim === 30) return CHECKIN_POLICY.STREAK_30D_BONUS_POINTS;
  if (streakAfterClaim === 7) return CHECKIN_POLICY.STREAK_7D_BONUS_POINTS;
  return 0;
}

async function readLocalCheckinData(): Promise<LocalCheckinData> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(LOCAL_CHECKIN_FILE, "utf8");
    const parsed = JSON.parse(raw) as LocalCheckinData;
    return { byUser: parsed.byUser ?? {} };
  } catch {
    return { byUser: {} };
  }
}

async function writeLocalCheckinData(data: LocalCheckinData) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LOCAL_CHECKIN_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireUser(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const authUser = user!;
  const { start, end, dateKey } = getKstDayWindow(new Date());

  if (!process.env.DATABASE_URL) {
    const localData = await readLocalCheckinData();
    const claimedDays = localData.byUser[authUser.id] ?? [];

    if (claimedDays.includes(dateKey)) {
      return NextResponse.json(
        {
          ok: false,
          data: {
            alreadyClaimed: true,
            dateKey,
          },
          error: "오늘 출석 보상은 이미 받았습니다.",
        },
        { status: 409 },
      );
    }

    const streakBeforeClaim = resolveStreakFromDateKeys(claimedDays, dateKey);
    const streakAfterClaim = streakBeforeClaim + 1;
    const streakBonus = resolveStreakBonus(streakAfterClaim);
    const totalReward = CHECKIN_POLICY.DAILY_REWARD_POINTS + streakBonus;

    const wallet = await localAdjustUserPoints(authUser.id, totalReward);
    localData.byUser[authUser.id] = [...claimedDays, dateKey];
    await writeLocalCheckinData(localData);

    return NextResponse.json(
      {
        ok: true,
        data: {
          dateKey,
          streakBeforeClaim,
          streakAfterClaim,
          dailyReward: CHECKIN_POLICY.DAILY_REWARD_POINTS,
          streakBonus,
          totalReward,
          pointBalance: wallet.pointBalance,
          alreadyClaimed: false,
        },
        error: null,
      },
      { status: 201 },
    );
  }

  try {
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`daily-checkin:${authUser.id}`}))`;

      const existingToday = await tx.walletTransaction.findFirst({
        where: {
          userId: authUser.id,
          type: "DAILY_CHECKIN",
          createdAt: {
            gte: start,
            lt: end,
          },
        },
        select: { id: true },
      });

      if (existingToday) {
        throw new Error("CHECKIN_ALREADY_CLAIMED");
      }

      const recentCheckins = await tx.walletTransaction.findMany({
        where: {
          userId: authUser.id,
          type: "DAILY_CHECKIN",
        },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { createdAt: true },
      });

      const dateKeys = recentCheckins.map((entry) => getKstDayWindow(entry.createdAt).dateKey);
      const streakBeforeClaim = resolveStreakFromDateKeys(dateKeys, dateKey);
      const streakAfterClaim = streakBeforeClaim + 1;
      const streakBonus = resolveStreakBonus(streakAfterClaim);

      const dailyTx = await applyWalletDelta({
        tx,
        userId: authUser.id,
        amount: CHECKIN_POLICY.DAILY_REWARD_POINTS,
        type: "DAILY_CHECKIN",
        note: `Daily check-in ${dateKey}`,
      });

      let bonusTxBalance = dailyTx.balanceAfter;
      if (streakBonus > 0) {
        const bonusTx = await applyWalletDelta({
          tx,
          userId: authUser.id,
          amount: streakBonus,
          type: "DAILY_STREAK_BONUS",
          note: `Daily streak bonus ${streakAfterClaim}d ${dateKey}`,
        });
        bonusTxBalance = bonusTx.balanceAfter;
      }

      return {
        dateKey,
        streakBeforeClaim,
        streakAfterClaim,
        dailyReward: CHECKIN_POLICY.DAILY_REWARD_POINTS,
        streakBonus,
        totalReward: CHECKIN_POLICY.DAILY_REWARD_POINTS + streakBonus,
        pointBalance: bonusTxBalance,
        alreadyClaimed: false,
      };
    });

    return NextResponse.json({ ok: true, data: result, error: null }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (message === "CHECKIN_ALREADY_CLAIMED") {
      return NextResponse.json(
        {
          ok: false,
          data: {
            alreadyClaimed: true,
            dateKey,
          },
          error: "오늘 출석 보상은 이미 받았습니다.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: false, data: null, error: "Failed to claim daily check-in" }, { status: 500 });
  }
}
