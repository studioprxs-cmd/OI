import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";

export type HomeTopicSummary = {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: Date;
  closeAt: Date;
  voteCount: number;
  betCount: number;
  commentCount: number;
  totalPool: number;
};

export type RecentMember = {
  id: string;
  nickname: string;
  activityLabel: string;
};

const FALLBACK_RECENT_MEMBERS: RecentMember[] = [
  { id: "mock-member-1", nickname: "mint_jiyoon", activityLabel: "방금 참여" },
  { id: "mock-member-2", nickname: "policy_woo", activityLabel: "5분 전" },
  { id: "mock-member-3", nickname: "alpha_hyeri", activityLabel: "17분 전" },
  { id: "mock-member-4", nickname: "market_doyoung", activityLabel: "28분 전" },
  { id: "mock-member-5", nickname: "oing_haeun", activityLabel: "42분 전" },
];

function formatRelativeKo(date: Date) {
  const diffMs = Date.now() - date.getTime();

  if (diffMs < 60_000) return "방금 참여";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

export async function fetchHomeFeedData() {
  const mock = mockTopicSummaries();
  const canUseDb = Boolean(process.env.DATABASE_URL);

  const topicsFromDb: HomeTopicSummary[] = canUseDb
    ? await db.topic
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { _count: { select: { votes: true, bets: true, comments: true } } },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          status: row.status,
          createdAt: row.createdAt,
          closeAt: row.closeAt,
          voteCount: row._count.votes,
          betCount: row._count.bets,
          commentCount: row._count.comments,
          totalPool: 0,
        })),
      )
      .catch(() => [])
    : [];

  const combined: HomeTopicSummary[] = [
    ...topicsFromDb,
    ...mock.filter((item) => !topicsFromDb.some((topic) => topic.id === item.id)),
  ];

  const latest = combined
    .slice()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 5);

  const trending = combined
    .slice()
    .sort((a, b) => b.voteCount + b.commentCount - (a.voteCount + a.commentCount))
    .slice(0, 5);

  const stats = {
    openTopics: combined.filter((topic) => topic.status === "OPEN").length,
    totalVotes: combined.reduce((sum, topic) => sum + topic.voteCount, 0),
    totalBets: combined.reduce((sum, topic) => sum + topic.betCount, 0),
  };

  const recentMembers: RecentMember[] = canUseDb
    ? await db.user
      .findMany({
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, nickname: true, updatedAt: true },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          nickname: row.nickname,
          activityLabel: formatRelativeKo(row.updatedAt),
        })),
      )
      .catch(() => FALLBACK_RECENT_MEMBERS)
    : FALLBACK_RECENT_MEMBERS;

  return {
    combined,
    latest,
    trending,
    stats,
    recentMembers,
  };
}
