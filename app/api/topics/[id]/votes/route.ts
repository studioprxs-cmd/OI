import { Choice, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getAuthUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getParticipationBlockReason } from "@/lib/topic-policy";

type Params = { params: Promise<{ id: string }> };

const VOTE_REWARD = 50;

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

      let vote = await tx.vote.findUnique({
        where: {
          topicId_userId: {
            topicId: id,
            userId: authUser.id,
          },
        },
      });

      let rewarded = false;

      if (!vote) {
        try {
          vote = await tx.vote.create({
            data: {
              topicId: id,
              userId: authUser.id,
              choice,
            },
          });

          const updatedUser = await tx.user.update({
            where: { id: authUser.id },
            data: { pointBalance: { increment: VOTE_REWARD } },
            select: { pointBalance: true },
          });

          await tx.walletTransaction.create({
            data: {
              userId: authUser.id,
              type: "VOTE_REWARD",
              amount: VOTE_REWARD,
              balanceAfter: updatedUser.pointBalance,
              note: `Vote reward topic:${id}`,
            },
          });

          rewarded = true;
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            vote = await tx.vote.findUnique({
              where: {
                topicId_userId: {
                  topicId: id,
                  userId: authUser.id,
                },
              },
            });
          } else {
            throw error;
          }
        }
      }

      if (!vote) {
        throw new Error("VOTE_WRITE_FAILED");
      }

      if (vote.choice !== choice) {
        vote = await tx.vote.update({
          where: { id: vote.id },
          data: { choice },
        });
      }

      return { vote, rewarded, reward: rewarded ? VOTE_REWARD : 0 };
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

    return NextResponse.json({ ok: false, data: null, error: "Failed to submit vote" }, { status: 500 });
  }
}

