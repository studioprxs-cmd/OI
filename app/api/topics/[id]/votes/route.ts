import { Choice, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ENGAGEMENT_POLICY } from "@/lib/engagement-policy";
import { getParticipationBlockReason } from "@/lib/topic-policy";
import { applyWalletDelta } from "@/lib/wallet";

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
  const choice = String(body.choice ?? "").toUpperCase() as Choice;

  if (choice !== "YES" && choice !== "NO") {
    return NextResponse.json({ ok: false, data: null, error: "choice must be YES or NO" }, { status: 400 });
  }

  try {
    const voteResult = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`vote-user-topic:${authUser.id}:${id}`}))`;

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

      const existingVote = await tx.vote.findUnique({
        where: {
          topicId_userId: {
            topicId: id,
            userId: authUser.id,
          },
        },
      });

      if (existingVote) {
        throw new Error("VOTE_ALREADY_EXISTS");
      }

      let vote;
      try {
        vote = await tx.vote.create({
          data: {
            topicId: id,
            userId: authUser.id,
            choice,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new Error("VOTE_ALREADY_EXISTS");
        }
        throw error;
      }

      await applyWalletDelta({
        tx,
        userId: authUser.id,
        amount: ENGAGEMENT_POLICY.VOTE_REWARD_POINTS,
        type: "VOTE_REWARD",
        relatedVoteId: vote.id,
        note: `Vote reward topic:${id}`,
      });

      return { vote, rewarded: true, reward: ENGAGEMENT_POLICY.VOTE_REWARD_POINTS };
    });

    return NextResponse.json({ ok: true, data: voteResult, error: null }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";

    if (message === "TOPIC_NOT_FOUND") {
      return NextResponse.json({ ok: false, data: null, error: "Topic not found" }, { status: 404 });
    }

    if (message.startsWith("TOPIC_BLOCKED:")) {
      return NextResponse.json({ ok: false, data: null, error: message.replace("TOPIC_BLOCKED:", "") }, { status: 409 });
    }

    if (message === "VOTE_ALREADY_EXISTS") {
      return NextResponse.json(
        { ok: false, data: null, error: "이미 투표한 토픽입니다. 투표는 1회만 가능합니다." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: false, data: null, error: "Failed to submit vote" }, { status: 500 });
  }
}

