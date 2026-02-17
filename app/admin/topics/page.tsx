import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSectionTabs, Card, PageContainer, Pill, SectionTitle, StatePanel } from "@/components/ui";
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

  const unresolvedSettledBacklogCount = canUseDb
    ? await db.bet
      .count({
        where: {
          settled: false,
          topic: { status: "RESOLVED" },
        },
      })
      .catch(() => 0)
    : 0;

  const resolvedWithoutResolutionCount = canUseDb
    ? await db.topic
      .count({
        where: {
          status: "RESOLVED",
          resolution: null,
        },
      })
      .catch(() => 0)
    : 0;

  const unresolvedSettledBacklogTopics = canUseDb
    ? await db.topic
      .findMany({
        where: {
          status: "RESOLVED",
          bets: {
            some: {
              settled: false,
            },
          },
        },
        select: {
          id: true,
          title: true,
          _count: {
            select: {
              bets: {
                where: {
                  settled: false,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
      .catch(() => [])
    : [];

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
  const integrityIssueTotal = unresolvedSettledBacklogCount + resolvedWithoutResolutionCount;

  return (
    <PageContainer>
      <section className="admin-hero-shell">
        <div className="row admin-header-row">
          <div>
            <p className="admin-hero-eyebrow">Topic Operations</p>
            <h1 className="admin-hero-title">Admin · Topics</h1>
            <p className="admin-hero-subtitle">토픽 생애주기와 정산 위험 신호를 한 화면에서 확인하고 우선순위대로 정리하세요.</p>
          </div>
          <div className="row admin-header-links">
            <Link className="text-link" href="/admin/topics/new">+ Create Topic</Link>
            <Link className="text-link" href="/admin/topics?status=ALL">필터 초기화</Link>
          </div>
        </div>

        <div className="admin-pulse-grid" style={{ marginTop: "0.75rem" }}>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">처리 필요</p>
            <strong className="admin-kpi-value">{pendingResolveCount}건</strong>
            <span className="admin-kpi-meta">OPEN + LOCKED</span>
          </div>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">오픈 지연</p>
            <strong className="admin-kpi-value">{staleOpenCount}건</strong>
            <span className="admin-kpi-meta">24시간 이상 OPEN</span>
          </div>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">정산 백로그</p>
            <strong className="admin-kpi-value">{unresolvedSettledBacklogCount}건</strong>
            <span className="admin-kpi-meta">RESOLVED 상태 미정산</span>
          </div>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">결과 불일치</p>
            <strong className="admin-kpi-value">{resolvedWithoutResolutionCount}건</strong>
            <span className="admin-kpi-meta">RESOLVED · 결과 없음</span>
          </div>
        </div>
      </section>

      <AdminSectionTabs
        items={[
          { href: "/admin/topics", label: "토픽 운영", badge: pendingResolveCount, active: true },
          { href: "/admin/moderation", label: "신고/정산", active: false },
          { href: "/admin/topics/new", label: "새 토픽", active: false },
        ]}
      />

      <StatePanel
        title={integrityIssueTotal > 0 ? "토픽 정산 무결성 점검 필요" : "토픽 정산 무결성 안정"}
        description={integrityIssueTotal > 0
          ? `정산 누락/결과 불일치 이슈 ${integrityIssueTotal}건이 감지되었습니다. 토픽 해소 전 데이터 정합성을 먼저 정리하세요.`
          : "토픽 정산 무결성 이슈가 없습니다. 현재 운영 기준이 안정적으로 유지되고 있습니다."}
        tone={integrityIssueTotal > 0 ? "warning" : "success"}
        actions={(
          <>
            <Link className="btn btn-primary" href="/admin/moderation">모더레이션/정산 대시보드</Link>
            <Link className="btn btn-secondary" href="/admin/topics?status=RESOLVED">RESOLVED 토픽 점검</Link>
          </>
        )}
      />

      {unresolvedSettledBacklogTopics.length > 0 ? (
        <Card>
          <SectionTitle>정산 누락 우선 확인 토픽</SectionTitle>
          <ul className="simple-list" style={{ marginTop: "0.6rem" }}>
            {unresolvedSettledBacklogTopics.map((topic) => (
              <li key={topic.id}>
                <Link className="text-link" href={`/admin/topics/${topic.id}/resolve`}>
                  {topic.title}
                </Link>
                <small style={{ color: "#6b7280" }}> · 미정산 {topic._count.bets}건</small>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>운영 내비게이션</SectionTitle>
        <div className="admin-link-grid" style={{ marginTop: "0.72rem" }}>
          <Link className="admin-quick-link" href="/topics">사용자 토픽 목록 보기</Link>
          <Link className="admin-quick-link" href="/admin/topics/new">새 토픽 생성</Link>
          <Link className="admin-quick-link" href="/admin/moderation">모더레이션/정산 현황</Link>
        </div>
      </Card>

      <Card>
        <SectionTitle>토픽 필터</SectionTitle>
        <div className="chip-row-scroll" style={{ marginTop: "0.72rem" }} aria-label="토픽 상태 필터">
          <Link
            className={`filter-chip${selectedStatus === "ALL" ? " is-active" : ""}`}
            href={`/admin/topics?status=ALL&q=${encodeURIComponent(keyword)}`}
          >
            ALL {topics.length}
          </Link>
          {STATUS_ORDER.map((status) => (
            <Link
              key={status}
              className={`filter-chip${selectedStatus === status ? " is-active" : ""}`}
              href={`/admin/topics?status=${status}&q=${encodeURIComponent(keyword)}`}
            >
              {status} {statusCounts[status]}
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
        {filteredTopics.map((topic) => {
          const createdAt = new Date(topic.createdAt);
          const ageHours = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
          const isAgingOpen = topic.status === "OPEN" && ageHours >= 24;

          return (
            <Card key={topic.id}>
              <article className="admin-list-card">
                <div className="admin-list-card-head">
                  <div className="admin-list-card-title-wrap">
                    <p className="admin-list-card-kicker">{topic.id}</p>
                    <h3 className="admin-list-card-title">{topic.title}</h3>
                  </div>
                  <div className="row" style={{ gap: "0.45rem" }}>
                    {isAgingOpen ? <Pill tone="danger">24h+ 지연</Pill> : null}
                    {topic.status === "OPEN" ? <Pill tone="danger">우선 확인</Pill> : null}
                    <Pill tone={topic.status === "RESOLVED" ? "success" : "neutral"}>{topic.status}</Pill>
                  </div>
                </div>

                <p className="admin-list-card-description">{topic.description}</p>

                <div className="admin-list-card-meta-row">
                  <span>생성 {createdAt.toLocaleDateString("ko-KR")}</span>
                  <span>경과 {Math.max(ageHours, 0)}시간</span>
                </div>

                <div className="row admin-topic-link-row">
                  <Link className="text-link" href={`/topics/${topic.id}`}>상세 보기</Link>
                  <Link className="text-link" href={`/admin/topics/${topic.id}/resolve`}>
                    {topic.status === "RESOLVED" ? "정산 결과 보기" : "Resolve"}
                  </Link>
                </div>

                <div style={{ marginTop: "0.74rem" }}>
                  <TopicQuickActions topicId={topic.id} topicStatus={topic.status} />
                </div>
              </article>
            </Card>
          );
        })}
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
