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

export const MOCK_TOPICS: TopicDetail[] = [
  {
    id: "mock-us-tariff-korea-chip-2026",
    title: "[POLL] 美 추가 관세, 한국 반도체 수출에 단기 충격 클까?",
    description: "향후 3개월 내 수출 단가/물량 변동 체감 여부를 예측하는 최근 이슈 토픽",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T15:10:00+09:00"),
    closeAt: new Date("2026-03-05T18:00:00+09:00"),
    yesVotes: 176,
    noVotes: 98,
    yesPool: 0,
    noPool: 0,
    voteCount: 274,
    betCount: 0,
    commentCount: 34,
    totalPool: 0,
    comments: [
      { id: "m100", content: "메모리 가격이 버텨주면 생각보다 충격이 짧을 수도", createdAt: new Date("2026-02-16T16:22:00+09:00") },
      { id: "m101", content: "환율 변수까지 같이 봐야 할 듯", createdAt: new Date("2026-02-16T16:05:00+09:00") },
    ],
  },
  {
    id: "mock-kospi-3000-q2-2026",
    title: "[BETTING] 코스피, 2분기 내 3000 재돌파 가능할까?",
    description: "외국인 수급과 금리 기대를 반영한 단기 지수 시나리오 베팅",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T13:40:00+09:00"),
    closeAt: new Date("2026-04-30T15:20:00+09:00"),
    yesVotes: 121,
    noVotes: 93,
    yesPool: 910000,
    noPool: 740000,
    voteCount: 214,
    betCount: 112,
    commentCount: 26,
    totalPool: 1650000,
    comments: [
      { id: "m102", content: "실적 시즌이 키포인트", createdAt: new Date("2026-02-16T14:13:00+09:00") },
    ],
  },
  {
    id: "mock-seoul-rent-2026-h1",
    title: "[POLL] 서울 전세가, 상반기 내 체감 상승 이어질까?",
    description: "전세 매물/수요 흐름 기준으로 체감 가격 방향을 묻는 부동산 이슈",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T11:50:00+09:00"),
    closeAt: new Date("2026-06-30T18:00:00+09:00"),
    yesVotes: 167,
    noVotes: 141,
    yesPool: 0,
    noPool: 0,
    voteCount: 308,
    betCount: 0,
    commentCount: 41,
    totalPool: 0,
    comments: [
      { id: "m103", content: "역세권 소형은 이미 오르는 느낌", createdAt: new Date("2026-02-16T12:20:00+09:00") },
    ],
  },
  {
    id: "mock-ai-phone-agent-2026",
    title: "[BETTING] 온디바이스 AI폰 에이전트, 연내 킬러앱 나올까?",
    description: "국내 사용자가 체감하는 생산성/검색 대체 기능의 대중화 시점 베팅",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T10:30:00+09:00"),
    closeAt: new Date("2026-12-20T18:00:00+09:00"),
    yesVotes: 139,
    noVotes: 77,
    yesPool: 680000,
    noPool: 440000,
    voteCount: 216,
    betCount: 96,
    commentCount: 19,
    totalPool: 1120000,
    comments: [
      { id: "m104", content: "배터리/개인정보 이슈만 넘기면 터질 듯", createdAt: new Date("2026-02-16T10:55:00+09:00") },
    ],
  },
  {
    id: "mock-kbo-lions-opening-2026",
    title: "[BETTING] 삼성 라이온즈, 개막 한 달 승률 6할 넘길까?",
    description: "선발 로테이션과 불펜 운영 안정성을 기준으로 보는 시즌 초반 토픽",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T09:40:00+09:00"),
    closeAt: new Date("2026-04-25T21:00:00+09:00"),
    yesVotes: 148,
    noVotes: 118,
    yesPool: 760000,
    noPool: 810000,
    voteCount: 266,
    betCount: 134,
    commentCount: 27,
    totalPool: 1570000,
    comments: [
      { id: "m105", content: "5선발 구간이 관건", createdAt: new Date("2026-02-16T09:58:00+09:00") },
    ],
  },
  {
    id: "mock-krw-usd-1450-2026",
    title: "[POLL] 원/달러 환율, 상반기 중 1450 재돌파할까?",
    description: "대외 리스크와 달러 강세를 반영한 환율 방향성 토론",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-16T08:55:00+09:00"),
    closeAt: new Date("2026-06-20T15:00:00+09:00"),
    yesVotes: 154,
    noVotes: 129,
    yesPool: 0,
    noPool: 0,
    voteCount: 283,
    betCount: 0,
    commentCount: 31,
    totalPool: 0,
    comments: [
      { id: "m106", content: "수출주엔 단기 호재지만 물가 압박이 큼", createdAt: new Date("2026-02-16T09:02:00+09:00") },
    ],
  },
  {
    id: "mock-nuclear-energy-policy-2026",
    title: "[POLL] 원전 비중 확대 정책, 전기요금 안정에 실제 도움될까?",
    description: "에너지 믹스 변화가 가계/산업 전기요금에 미치는 영향 전망",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-15T22:20:00+09:00"),
    closeAt: new Date("2026-05-31T18:00:00+09:00"),
    yesVotes: 211,
    noVotes: 173,
    yesPool: 0,
    noPool: 0,
    voteCount: 384,
    betCount: 0,
    commentCount: 58,
    totalPool: 0,
    comments: [
      { id: "m107", content: "연료비/송배전까지 같이 봐야 함", createdAt: new Date("2026-02-15T23:11:00+09:00") },
    ],
  },
  {
    id: "mock-bitcoin-120k-2026",
    title: "[BETTING] 비트코인, 연내 12만 달러 도달할까?",
    description: "유동성·ETF 자금 유입을 반영한 고변동 자산 시나리오",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-15T20:05:00+09:00"),
    closeAt: new Date("2026-12-31T23:00:00+09:00"),
    yesVotes: 193,
    noVotes: 162,
    yesPool: 1210000,
    noPool: 1330000,
    voteCount: 355,
    betCount: 188,
    commentCount: 44,
    totalPool: 2540000,
    comments: [
      { id: "m108", content: "변동성 커서 분할 접근이 답", createdAt: new Date("2026-02-15T20:22:00+09:00") },
    ],
  },
  {
    id: "mock-ultra-lowbirth-policy-2026",
    title: "[POLL] 초저출산 대응 패키지, 올해 합계출산율 반등에 기여할까?",
    description: "주거·돌봄·일자리 패키지의 체감 효과를 보는 사회정책 이슈",
    status: TopicStatus.OPEN,
    createdAt: new Date("2026-02-15T18:35:00+09:00"),
    closeAt: new Date("2026-12-15T18:00:00+09:00"),
    yesVotes: 132,
    noVotes: 189,
    yesPool: 0,
    noPool: 0,
    voteCount: 321,
    betCount: 0,
    commentCount: 49,
    totalPool: 0,
    comments: [
      { id: "m109", content: "정책보다 체감 비용 개선이 먼저", createdAt: new Date("2026-02-15T19:03:00+09:00") },
    ],
  },
  {
    id: "mock-ev-battery-price-2026",
    title: "[BETTING] EV 배터리 셀 가격, 하반기 추가 하락할까?",
    description: "원재료 가격과 공급망 안정화에 따른 하반기 원가 추정 토픽",
    status: TopicStatus.DRAFT,
    createdAt: new Date("2026-02-15T17:10:00+09:00"),
    closeAt: new Date("2026-10-31T18:00:00+09:00"),
    yesVotes: 66,
    noVotes: 58,
    yesPool: 340000,
    noPool: 290000,
    voteCount: 124,
    betCount: 63,
    commentCount: 12,
    totalPool: 630000,
    comments: [],
  },
];

export function mockTopicSummaries() {
  return MOCK_TOPICS.map(({ comments, resolution, yesVotes, noVotes, yesPool, noPool, ...summary }) => summary);
}

export function findMockTopic(id: string) {
  return MOCK_TOPICS.find((topic) => topic.id === id);
}
