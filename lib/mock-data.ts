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
    id: "news-shorttrack-kim-gilli-medal",
    title: "[BETTING] 김길리, 다음 메이저 대회에서도 메달권 유지할까?",
    description: "기사 기반 이슈: 쇼트트랙 1000m 동메달 이후 경기력 전망",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T23:40:00+09:00"),
    closeAt: new Date("2026-03-15T18:00:00+09:00"),
    yesVotes: 176,
    noVotes: 69,
    yesPool: 840000,
    noPool: 330000,
    voteCount: 245,
    betCount: 122,
    commentCount: 22,
    totalPool: 1170000,
    comments: [{ id: "c4", content: "컨디션만 유지하면 가능성 높아", createdAt: new Date("2026-02-17T00:12:00+09:00") }],
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
    id: "news-bitcoin-safe-asset-ai-era",
    title: "[BETTING] ‘AI 시대 비트코인 안전자산론’, 연내 수익률로 증명될까?",
    description: "기사 기반 이슈: 비트코인 안전자산 평가 확산",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T23:20:00+09:00"),
    closeAt: new Date("2026-12-20T18:00:00+09:00"),
    yesVotes: 144,
    noVotes: 136,
    yesPool: 920000,
    noPool: 890000,
    voteCount: 280,
    betCount: 139,
    commentCount: 33,
    totalPool: 1810000,
    comments: [{ id: "c6", content: "매크로랑 같이 봐야지", createdAt: new Date("2026-02-17T00:14:00+09:00") }],
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
    id: "news-ai-tax-arrears-vehicle-enforcement",
    title: "[BETTING] AI 체납차량 단속, 연내 전국 확대 도입될까?",
    description: "기사 기반 이슈: AI 기반 도로 단속 성과 보도",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T22:50:00+09:00"),
    closeAt: new Date("2026-05-31T18:00:00+09:00"),
    yesVotes: 172,
    noVotes: 91,
    yesPool: 610000,
    noPool: 340000,
    voteCount: 263,
    betCount: 97,
    commentCount: 28,
    totalPool: 950000,
    comments: [{ id: "c9", content: "효율성은 확실히 보여줬네", createdAt: new Date("2026-02-17T00:15:00+09:00") }],
  },
  {
    id: "news-kospi-stock-picks-retail",
    title: "[BETTING] 개인투자자 ‘종목 압축 전략’, 상반기 성과 낼까?",
    description: "기사 기반 이슈: 개인투자자 종목 선택·수익 전략 관심 확대",
    status: TopicStatus.DRAFT,
    createdAt: new Date("2026-02-16T22:40:00+09:00"),
    closeAt: new Date("2026-06-15T18:00:00+09:00"),
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
