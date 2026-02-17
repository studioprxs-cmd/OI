import { Choice, TopicStatus } from "@prisma/client";

export type TopicSummary = {
  id: string;
  title: string;
  description: string;
  status: TopicStatus;
  createdAt: Date;
  closeAt: Date;
  voteCount: number;
  betCount: number;
  commentCount: number;
  totalPool: number;
};

export type TopicDetail = TopicSummary & {
  yesVotes: number;
  noVotes: number;
  yesPool: number;
  noPool: number;
  comments: Array<{ id: string; content: string; createdAt: Date }>;
  resolution?: { result: Choice; summary: string };
};

// Source baseline: Naver ranking news (2026-02-17)
export const MOCK_TOPICS: TopicDetail[] = [
  {
    id: "news-osaka-dotombori-stabbing",
    title: "[POLL] 오사카 도톤보리 흉기 사건, 해외여행 안전 체감에 영향 클까?",
    description: "기사 기반 이슈: 日 오사카 관광명소 인근 흉기 사건 관련 여론 반영",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-17T00:05:00+09:00"),
    closeAt: new Date("2026-03-03T18:00:00+09:00"),
    yesVotes: 151,
    noVotes: 83,
    yesPool: 0,
    noPool: 0,
    voteCount: 234,
    betCount: 0,
    commentCount: 31,
    totalPool: 0,
    comments: [{ id: "c1", content: "여행 수요엔 단기 영향 있을 듯", createdAt: new Date("2026-02-17T00:10:00+09:00") }],
  },
  {
    id: "news-multihome-tax-benefit-debate",
    title: "[POLL] 다주택자 특혜 논쟁, 부동산 정책 변화로 이어질까?",
    description: "기사 기반 이슈: 다주택 세제·정책 공방 확대",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T23:58:00+09:00"),
    closeAt: new Date("2026-03-10T18:00:00+09:00"),
    yesVotes: 203,
    noVotes: 177,
    yesPool: 0,
    noPool: 0,
    voteCount: 380,
    betCount: 0,
    commentCount: 46,
    totalPool: 0,
    comments: [{ id: "c2", content: "정책 신호가 꽤 강해 보임", createdAt: new Date("2026-02-17T00:01:00+09:00") }],
  },
  {
    id: "news-gangwon-heavy-snow",
    title: "[POLL] 강원 동해안 폭설, 봄철 산불 위험 완화에 실질 효과 있을까?",
    description: "기사 기반 이슈: 강원 동해안 적설과 산불 리스크 변화",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T23:50:00+09:00"),
    closeAt: new Date("2026-02-28T18:00:00+09:00"),
    yesVotes: 128,
    noVotes: 54,
    yesPool: 0,
    noPool: 0,
    voteCount: 182,
    betCount: 0,
    commentCount: 18,
    totalPool: 0,
    comments: [],
  },
  {
    id: "winter-shorttrack-kim-gilli-final",
    title: "[BETTING] 쇼트트랙 김길리, 이번 동계올림픽 결승에서 메달권 진입할까?",
    description: "오잉 특집: 동계올림픽 쇼트트랙 결승 메달 가능성 베팅",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-18T00:10:00+09:00"),
    closeAt: new Date("2026-02-21T20:30:00+09:00"),
    yesVotes: 176,
    noVotes: 69,
    yesPool: 840000,
    noPool: 330000,
    voteCount: 245,
    betCount: 122,
    commentCount: 22,
    totalPool: 1170000,
    comments: [{ id: "c4", content: "스타트만 잘 끊으면 메달권 가능", createdAt: new Date("2026-02-18T00:12:00+09:00") }],
  },
  {
    id: "news-highway-wrongway-crash",
    title: "[POLL] 고속도로 역주행 사고, 처벌·예방 제도 강화될까?",
    description: "기사 기반 이슈: 역주행 정면충돌 사고 이후 제도 논의",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T23:30:00+09:00"),
    closeAt: new Date("2026-03-05T18:00:00+09:00"),
    yesVotes: 267,
    noVotes: 42,
    yesPool: 0,
    noPool: 0,
    voteCount: 309,
    betCount: 0,
    commentCount: 57,
    totalPool: 0,
    comments: [],
  },
  {
    id: "winter-speedskating-massstart",
    title: "[BETTING] 스피드스케이팅 매스스타트, 한국 대표팀 메달 획득할까?",
    description: "오잉 특집: 동계올림픽 매스스타트 메달 가능성",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-18T00:15:00+09:00"),
    closeAt: new Date("2026-02-22T18:20:00+09:00"),
    yesVotes: 144,
    noVotes: 136,
    yesPool: 920000,
    noPool: 890000,
    voteCount: 280,
    betCount: 139,
    commentCount: 33,
    totalPool: 1810000,
    comments: [{ id: "c6", content: "막판 스퍼트 나오면 충분히 가능", createdAt: new Date("2026-02-18T00:16:00+09:00") }],
  },
  {
    id: "news-housing-gap-nohome",
    title: "[POLL] 서울 주택 가격 격차, 무주택 체감 악화 계속될까?",
    description: "기사 기반 이슈: 주택 자산 격차와 무주택 부담 확대",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T23:10:00+09:00"),
    closeAt: new Date("2026-06-30T18:00:00+09:00"),
    yesVotes: 241,
    noVotes: 88,
    yesPool: 0,
    noPool: 0,
    voteCount: 329,
    betCount: 0,
    commentCount: 40,
    totalPool: 0,
    comments: [],
  },
  {
    id: "news-bts-concert-room-price",
    title: "[POLL] 대형 공연 수요로 숙박비 급등, 가격 규제 논의 필요할까?",
    description: "기사 기반 이슈: 대형 이벤트 주변 숙박비 급등",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T23:00:00+09:00"),
    closeAt: new Date("2026-03-20T18:00:00+09:00"),
    yesVotes: 198,
    noVotes: 102,
    yesPool: 0,
    noPool: 0,
    voteCount: 300,
    betCount: 0,
    commentCount: 35,
    totalPool: 0,
    comments: [],
  },
  {
    id: "winter-figure-womens-single",
    title: "[BETTING] 피겨 여자 싱글, 한국 선수 메달권 진입할까?",
    description: "오잉 특집: 동계올림픽 피겨 여자 싱글 메달 베팅",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-18T00:18:00+09:00"),
    closeAt: new Date("2026-02-23T21:00:00+09:00"),
    yesVotes: 172,
    noVotes: 91,
    yesPool: 610000,
    noPool: 340000,
    voteCount: 263,
    betCount: 97,
    commentCount: 28,
    totalPool: 950000,
    comments: [{ id: "c9", content: "클린 프로그램이면 포디움 가능", createdAt: new Date("2026-02-18T00:19:00+09:00") }],
  },
  {
    id: "winter-curling-team-kor",
    title: "[BETTING] 컬링 여자 대표팀, 이번 동계올림픽에서 메달 획득할까?",
    description: "오잉 특집: 동계올림픽 컬링 메달 가능성",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-18T00:22:00+09:00"),
    closeAt: new Date("2026-02-24T20:00:00+09:00"),
    yesVotes: 74,
    noVotes: 67,
    yesPool: 250000,
    noPool: 260000,
    voteCount: 141,
    betCount: 61,
    commentCount: 11,
    totalPool: 510000,
    comments: [],
  },
];

export function mockTopicSummaries() {
  return MOCK_TOPICS.map(({ comments, resolution, yesVotes, noVotes, yesPool, noPool, ...summary }) => summary);
}

export function findMockTopic(id: string) {
  return MOCK_TOPICS.find((topic) => topic.id === id);
}
