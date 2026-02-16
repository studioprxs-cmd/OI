import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "user@oi.local" },
    update: {},
    create: {
      id: "seed-user",
      email: "user@oi.local",
      nickname: "demo-user",
      role: "USER",
      pointBalance: 1000,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@oi.local" },
    update: {},
    create: {
      id: "seed-admin",
      email: "admin@oi.local",
      nickname: "demo-admin",
      role: "ADMIN",
      pointBalance: 10000,
    },
  });

  const betting = await prisma.topic.upsert({
    where: { id: "seed-topic-betting" },
    update: {},
    create: {
      id: "seed-topic-betting",
      title: "[BETTING] 삼성 라이온즈 홈 개막전 승리할까?",
      description: "오늘 경기 결과를 예측해보세요.",
      status: "OPEN",
      closeAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      createdById: "seed-admin",
    },
  });

  const poll = await prisma.topic.upsert({
    where: { id: "seed-topic-poll" },
    update: {},
    create: {
      id: "seed-topic-poll",
      title: "[POLL] 이번 주말 날씨는 나들이하기 좋다?",
      description: "의견만 남기는 일반 투표형 이슈입니다.",
      status: "OPEN",
      closeAt: new Date(Date.now() + 1000 * 60 * 60 * 48),
      createdById: "seed-admin",
    },
  });

  await prisma.comment.upsert({
    where: { id: "seed-comment-1" },
    update: {},
    create: {
      id: "seed-comment-1",
      topicId: betting.id,
      userId: user.id,
      content: "전반 흐름 좋으면 YES 가봅니다.",
    },
  });

  await prisma.vote.upsert({
    where: {
      topicId_userId: {
        topicId: poll.id,
        userId: user.id,
      },
    },
    update: { choice: "YES" },
    create: {
      topicId: poll.id,
      userId: user.id,
      choice: "YES",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
