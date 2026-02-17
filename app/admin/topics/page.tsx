import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, PageContainer, Pill, SectionTitle, StatePanel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";

import { TopicQuickActions } from "./TopicQuickActions";

type Props = {
  searchParams?: Promise<{ status?: string; q?: string }>;
};

const STATUS_ORDER = ["OPEN", "LOCKED", "RESOLVED", "CANCELED", "DRAFT"] as const;
const STATUS_WEIGHT: Record<string, number> = {
  OPEN: 4,
  LOCKED: 3,
  DRAFT: 2,
  RESOLVED: 1,
  CANCELED: 0,
};

export default async function AdminTopicsPage({ searchParams }: Props) {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");
  if (viewer.role !== "ADMIN") redirect("/");

  const canUseDb = Boolean(process.env.DATABASE_URL);
  const query = await searchParams;
  const selectedStatus = String(query?.status ?? "ALL").toUpperCase();
  const keyword = String(query?.q ?? "").trim().toLowerCase();

  const dbTopics = canUseDb
    ? await db.topic
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
      })
      .catch(() => [])
    : [];

  const topics = [
    ...dbTopics,
    ...mockTopicSummaries().filter((mock) => !dbTopics.some((topic) => topic.id === mock.id)),
  ];

  const statusCounts = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, topics.filter((topic) => topic.status === status).length]),
  ) as Record<(typeof STATUS_ORDER)[number], number>;

  const filteredTopics = topics
    .filter((topic) => {
      if (selectedStatus !== "ALL" && topic.status !== selectedStatus) return false;
      if (!keyword) return true;

      const haystack = [topic.id, topic.title, topic.description, topic.status].join(" ").toLowerCase();
      return haystack.includes(keyword);
    })
    .sort((a, b) => {
      const statusDiff = (STATUS_WEIGHT[b.status] ?? -1) - (STATUS_WEIGHT[a.status] ?? -1);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const pendingResolveCount = topics.filter((topic) => topic.status === "OPEN" || topic.status === "LOCKED").length;
  const staleOpenCount = topics.filter((topic) => topic.status === "OPEN" && Date.now() - new Date(topic.createdAt).getTime() >= 24 * 60 * 60 * 1000).length;

  return (
    <PageContainer>
      <div className="row admin-header-row">
        <h1 style={{ margin: 0 }}>Admin · Topics</h1>
        <div className="row admin-header-links">
          <Link className="text-link" href="/admin/topics/new">+ Create Topic</Link>
          <Link className="text-link" href="/admin/topics?status=ALL">필터 초기화</Link>
        </div>
      </div>

      <Card>
        <SectionTitle>운영 내비게이션</SectionTitle>
        <div className="admin-link-grid" style={{ marginTop: "0.72rem" }}>
          <Link className="admin-quick-link" href="/topics">사용자 토픽 목록 보기</Link>
          <Link className="admin-quick-link" href="/admin/topics/new">새 토픽 생성</Link>
          <Link className="admin-quick-link" href="/admin/moderation">모더레이션/정산 현황</Link>
        </div>
      </Card>

      <Card>
        <SectionTitle>상태 요약</SectionTitle>
        <div className="admin-kpi-grid" style={{ marginTop: "0.75rem" }}>
          <div className="admin-kpi-tile">
            <p className="admin-kpi-label">처리 필요</p>
            <strong className="admin-kpi-value">{pendingResolveCount}건</strong>
            <span className="admin-kpi-meta">OPEN + LOCKED</span>
          </div>
          <div className="admin-kpi-tile">
            <p className="admin-kpi-label">오픈 지연</p>
            <strong className="admin-kpi-value">{staleOpenCount}건</strong>
            <span className="admin-kpi-meta">24시간 이상 OPEN</span>
          </div>
          <div className="admin-kpi-tile">
            <p className="admin-kpi-label">정산 완료</p>
            <strong className="admin-kpi-value">{statusCounts.RESOLVED}건</strong>
            <span className="admin-kpi-meta">RESOLVED</span>
          </div>
          <div className="admin-kpi-tile">
            <p className="admin-kpi-label">초안</p>
            <strong className="admin-kpi-value">{statusCounts.DRAFT}건</strong>
            <span className="admin-kpi-meta">출시 전 점검</span>
          </div>
        </div>
        <div className="row" style={{ marginTop: "0.7rem", flexWrap: "wrap", gap: "0.45rem" }}>
          <Pill tone="success">OPEN {statusCounts.OPEN}</Pill>
          <Pill>LOCKED {statusCounts.LOCKED}</Pill>
          <Pill tone="danger">RESOLVED {statusCounts.RESOLVED}</Pill>
          <Pill>CANCELED {statusCounts.CANCELED}</Pill>
          <Pill>DRAFT {statusCounts.DRAFT}</Pill>
        </div>
      </Card>

      <Card>
        <SectionTitle>토픽 필터</SectionTitle>
        <div className="row" style={{ marginTop: "0.7rem", flexWrap: "wrap", gap: "0.55rem" }}>
          <Link className="text-link" href={`/admin/topics?status=ALL&q=${encodeURIComponent(keyword)}`}>
            ALL {topics.length}
          </Link>
          {STATUS_ORDER.map((status) => (
            <Link key={status} className="text-link" href={`/admin/topics?status=${status}&q=${encodeURIComponent(keyword)}`}>
              <Pill tone={selectedStatus === status ? "danger" : "neutral"}>
                {status} {statusCounts[status]}
              </Pill>
            </Link>
          ))}
        </div>

        <form method="get" className="row moderation-filter-form" style={{ marginTop: "0.75rem", gap: "0.55rem", flexWrap: "wrap" }}>
          <input type="hidden" name="status" value={selectedStatus} />
          <input
            className="input moderation-filter-search"
            name="q"
            defaultValue={query?.q ?? ""}
            placeholder="토픽 id/제목/설명 검색"
          />
          <button
            type="submit"
            className="btn btn-primary moderation-filter-submit"
          >
            필터 적용
          </button>
        </form>
      </Card>

      <div className="list">
        {filteredTopics.map((topic) => (
          <Card key={topic.id}>
            <div className="row moderation-report-head" style={{ justifyContent: "space-between", gap: "0.55rem", flexWrap: "wrap" }}>
              <strong>{topic.title}</strong>
              <div className="row" style={{ gap: "0.45rem" }}>
                {topic.status === "OPEN" ? <Pill tone="danger">우선 확인</Pill> : null}
                <small style={{ color: "#6b7280" }}>{topic.status}</small>
              </div>
            </div>
            <p style={{ margin: "0.45rem 0", color: "#6b7280" }}>{topic.description}</p>
            <div className="row admin-topic-link-row">
              <Link className="text-link" href={`/topics/${topic.id}`}>상세 보기</Link>
              <Link className="text-link" href={`/admin/topics/${topic.id}/resolve`}>
                {topic.status === "RESOLVED" ? "정산 결과 보기" : "Resolve"}
              </Link>
            </div>

            <div style={{ marginTop: "0.74rem" }}>
              <TopicQuickActions topicId={topic.id} topicStatus={topic.status} />
            </div>
          </Card>
        ))}
        {filteredTopics.length === 0 ? (
          <StatePanel
            title="조건에 맞는 토픽이 없습니다"
            description="검색어를 줄이거나 상태를 ALL로 전환해 다시 확인하세요."
            actions={<Link className="btn btn-secondary" href="/admin/topics?status=ALL">필터 초기화</Link>}
          />
        ) : null}
      </div>
    </PageContainer>
  );
}
