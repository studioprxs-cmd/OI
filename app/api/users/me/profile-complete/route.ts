import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { localAdjustUserPoints } from "@/lib/auth-local";
import { db } from "@/lib/db";
import { ONBOARDING_POLICY } from "@/lib/onboarding-policy";
import { applyWalletDelta } from "@/lib/wallet";

type LocalProfileRewardData = {
  claimedUserIds: string[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const LOCAL_PROFILE_REWARD_FILE = path.join(DATA_DIR, "profile-complete-rewards.json");
const PROFILE_COMPLETE_REFERENCE_PREFIX = "profile-complete:";

async function readLocalProfileRewardData(): Promise<LocalProfileRewardData> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(LOCAL_PROFILE_REWARD_FILE, "utf8");
    const parsed = JSON.parse(raw) as LocalProfileRewardData;
    return {
      claimedUserIds: Array.isArray(parsed.claimedUserIds) ? parsed.claimedUserIds : [],
    };
  } catch {
    return { claimedUserIds: [] };
  }
}

async function writeLocalProfileRewardData(data: LocalProfileRewardData) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LOCAL_PROFILE_REWARD_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  const guard = requireUser(user);

  if (!guard.ok) {
    return NextResponse.json({ ok: false, data: null, error: guard.error }, { status: guard.status });
  }

  const authUser = user!;

  if (!process.env.DATABASE_URL) {
    const localData = await readLocalProfileRewardData();

    if (localData.claimedUserIds.includes(authUser.id)) {
      return NextResponse.json(
        {
          ok: false,
          data: {
            alreadyClaimed: true,
          },
          error: "프로필 완성 보상은 이미 지급되었습니다.",
        },
        { status: 409 },
      );
    }

    const wallet = await localAdjustUserPoints(authUser.id, ONBOARDING_POLICY.PROFILE_COMPLETE_POINTS);
    localData.claimedUserIds = [...localData.claimedUserIds, authUser.id];
    await writeLocalProfileRewardData(localData);

    return NextResponse.json(
      {
        ok: true,
        data: {
          alreadyClaimed: false,
          rewardPoints: ONBOARDING_POLICY.PROFILE_COMPLETE_POINTS,
          pointBalance: wallet.pointBalance,
        },
        error: null,
      },
      { status: 201 },
    );
  }

  const relatedReference = `${PROFILE_COMPLETE_REFERENCE_PREFIX}${authUser.id}`;

  try {
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`profile-complete:${authUser.id}`}))`;

      const existing = await tx.walletTransaction.findFirst({
        where: {
          userId: authUser.id,
          type: "PROFILE_COMPLETE",
          relatedVoteId: relatedReference,
        },
        select: { id: true },
      });

      if (existing) {
        throw new Error("PROFILE_COMPLETE_ALREADY_CLAIMED");
      }

      const rewardTx = await applyWalletDelta({
        tx,
        userId: authUser.id,
        amount: ONBOARDING_POLICY.PROFILE_COMPLETE_POINTS,
        type: "PROFILE_COMPLETE",
        relatedVoteId: relatedReference,
        note: "프로필 완성 보상 지급",
      });

      return {
        alreadyClaimed: false,
        rewardPoints: ONBOARDING_POLICY.PROFILE_COMPLETE_POINTS,
        pointBalance: rewardTx.balanceAfter,
      };
    });

    return NextResponse.json({ ok: true, data: result, error: null }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (message === "PROFILE_COMPLETE_ALREADY_CLAIMED" || message === "WALLET_TX_DUPLICATE_REFERENCE") {
      return NextResponse.json(
        {
          ok: false,
          data: {
            alreadyClaimed: true,
          },
          error: "프로필 완성 보상은 이미 지급되었습니다.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: false, data: null, error: "Failed to claim profile completion reward" }, { status: 500 });
  }
}
