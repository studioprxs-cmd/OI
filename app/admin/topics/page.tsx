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
  const priorityTopics = filteredTopics
    .filter((topic) => {
      const ageHours = Math.floor((Date.now() - new Date(topic.createdAt).getTime()) / (1000 * 60 * 60));
      return topic.status === "LOCKED" || topic.status === "OPEN" || (topic.status === "RESOLVED" && ageHours <= 24);
    })
    .slice(0, 5);
  const spotlightTopics = priorityTopics.slice(0, 3);
  const staleLockedCount = topics.filter((topic) => topic.status === "LOCKED" && Date.now() - new Date(topic.createdAt).getTime() >= 24 * 60 * 60 * 1000).length;
  const nextActionLabel = staleOpenCount > 0
    ? `24h+ OPEN ${staleOpenCount}건부터 우선 정리`
    : statusCounts.LOCKED > 0
      ? `LOCKED ${statusCounts.LOCKED}건 정산/해결 처리`
      : pendingResolveCount > 0
        ? `OPEN/LOCKED ${pendingResolveCount}건 순차 정리`
        : "긴급 토픽 없음 · 신규 생성/품질 관리 권장";
  const topicQueueStressScore = Math.min(100, (statusCounts.OPEN * 11) + (staleOpenCount * 24) + (staleLockedCount * 12));
  const topicIntegrityRiskScore = Math.min(100, (unresolvedSettledBacklogCount * 35) + (resolvedWithoutResolutionCount * 20));
  const topicConfidence = topicIntegrityRiskScore === 0 ? "높음" : topicIntegrityRiskScore <= 30 ? "보통" : "낮음";

  const queueLaneItems = [
    {
      id: "topic-open-lane",
      label: "Intake",
      title: "OPEN",
      value: statusCounts.OPEN,
      meta: staleOpenCount > 0 ? `24h+ ${staleOpenCount}건` : "신규 토픽 점검",
      tone: statusCounts.OPEN > 0 ? "danger" : "ok",
      href: "/admin/topics?status=OPEN",
    },
    {
      id: "topic-locked-lane",
      label: "Settle",
      title: "LOCKED",
      value: statusCounts.LOCKED,
      meta: staleLockedCount > 0 ? `24h+ ${staleLockedCount}건` : "정산/결과 확정",
      tone: statusCounts.LOCKED > 0 ? "warning" : "ok",
      href: "/admin/topics?status=LOCKED",
    },
    {
      id: "topic-resolved-lane",
      label: "Verify",
      title: "RESOLVED",
      value: statusCounts.RESOLVED,
      meta: integrityIssueTotal > 0 ? `무결성 ${integrityIssueTotal}건` : "무결성 유지",
      tone: integrityIssueTotal > 0 ? "danger" : "ok",
      href: "/admin/topics?status=RESOLVED",
    },
  ] as const;

  const operationsChecklist = [
    {
      label: "OPEN 토픽 우선 분류",
      value: `${statusCounts.OPEN}건`,
      tone: statusCounts.OPEN > 0 ? "danger" : "ok",
      hint: "신규 이슈를 빠르게 검수하고 필요 시 LOCKED로 전환",
    },
    {
      label: "LOCKED 정산 처리",
      value: `${statusCounts.LOCKED}건`,
      tone: statusCounts.LOCKED > 0 ? "warning" : "ok",
      hint: "베팅 정산과 결과 기록을 묶어서 완료",
    },
    {
      label: "정산 무결성 점검",
      value: `${integrityIssueTotal}건`,
      tone: integrityIssueTotal > 0 ? "danger" : "ok",
      hint: "RESOLVED 미정산/결과 누락을 우선 복구",
    },
  ] as const;

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

      <Card className="admin-jump-nav-card admin-jump-nav-card-sticky">
        <p className="admin-jump-nav-label">Quick jump</p>
        <div className="admin-jump-nav" aria-label="토픽 운영 섹션 바로가기">
          <a href="#topic-priority" className="admin-jump-nav-item">우선순위</a>
          <a href="#topic-spotlight" className="admin-jump-nav-item">스포트라이트</a>
          <a href="#topic-filter" className="admin-jump-nav-item">필터</a>
          <a href="#topic-list" className="admin-jump-nav-item">토픽 리스트</a>
        </div>
      </Card>

      <Card className="admin-surface-card admin-surface-card-priority">
        <SectionTitle>토픽 운영 온도계</SectionTitle>
        <p className="admin-card-intro">큐 체류 시간과 정산 무결성을 점수화해 모바일에서 즉시 대응 우선순위를 고정합니다.</p>
        <div className="ops-health-strip" style={{ marginTop: "0.72rem" }}>
          <div className={`ops-health-item ${topicQueueStressScore >= 60 ? "is-danger" : topicQueueStressScore >= 30 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Queue Stress</span>
            <strong className="ops-health-value">{topicQueueStressScore}</strong>
            <small>OPEN {statusCounts.OPEN} · 24h+ OPEN {staleOpenCount}</small>
          </div>
          <div className={`ops-health-item ${topicIntegrityRiskScore >= 45 ? "is-danger" : topicIntegrityRiskScore > 0 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Integrity Risk</span>
            <strong className="ops-health-value">{topicIntegrityRiskScore}</strong>
            <small>미정산 백로그 {unresolvedSettledBacklogCount} · 결과 누락 {resolvedWithoutResolutionCount}</small>
          </div>
          <div className={`ops-health-item ${topicConfidence === "낮음" ? "is-danger" : topicConfidence === "보통" ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Settlement Confidence</span>
            <strong className="ops-health-value">{topicConfidence}</strong>
            <small>토픽 정산 신뢰도 상태</small>
          </div>
        </div>
      </Card>

      <Card className="admin-command-card">
        <div className="admin-command-head">
          <div>
            <p className="admin-command-kicker">Topic command rail</p>
            <h2 className="admin-command-title">지금 처리할 핵심 3단계</h2>
          </div>
          <Pill tone={integrityIssueTotal > 0 ? "danger" : "success"}>Integrity {integrityIssueTotal}</Pill>
        </div>
        <div className="admin-command-grid">
          {operationsChecklist.map((item, index) => (
            <article key={item.label} className={`admin-command-item is-${item.tone}`}>
              <span className="admin-command-step">P{index + 1}</span>
              <strong>{item.label}</strong>
              <p>{item.hint}</p>
              <span className="admin-command-value">{item.value}</span>
            </article>
          ))}
        </div>
      </Card>

      <Card className="admin-lane-card">
        <div className="admin-lane-head">
          <div>
            <p className="admin-jump-nav-label">Topic lanes</p>
            <h2 className="admin-command-title">한 손 우선순위 처리 레인</h2>
          </div>
          <Pill tone={pendingResolveCount > 0 ? "danger" : "success"}>Actionable {pendingResolveCount}</Pill>
        </div>
        <div className="admin-lane-grid" style={{ marginTop: "0.62rem" }}>
          {queueLaneItems.map((lane) => (
            <Link key={lane.id} href={lane.href} className={`admin-lane-item is-${lane.tone}`}>
              <span className="admin-lane-label">{lane.label}</span>
              <strong className="admin-lane-title">{lane.title}</strong>
              <span className="admin-lane-value">{lane.value}건</span>
              <small>{lane.meta}</small>
            </Link>
          ))}
        </div>
      </Card>

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

      <Card id="topic-priority" className="admin-surface-card admin-surface-card-priority">
        <SectionTitle>오늘의 우선순위</SectionTitle>
        <div className="row" style={{ marginTop: "0.65rem", flexWrap: "wrap", gap: "0.45rem" }}>
          <Pill tone={pendingResolveCount > 0 ? "danger" : "success"}>처리 필요 {pendingResolveCount}</Pill>
          <Pill tone={staleOpenCount > 0 ? "danger" : "neutral"}>24h+ OPEN {staleOpenCount}</Pill>
          <Pill tone={statusCounts.LOCKED > 0 ? "danger" : "neutral"}>LOCKED {statusCounts.LOCKED}</Pill>
          <Pill tone={integrityIssueTotal > 0 ? "danger" : "success"}>무결성 이슈 {integrityIssueTotal}</Pill>
        </div>
        <p className="admin-muted-note">Next best action: {nextActionLabel}</p>
      </Card>

      <Card id="topic-spotlight">
        <SectionTitle>모바일 스포트라이트</SectionTitle>
        <p className="admin-muted-note">엄지 한 번으로 지금 처리해야 할 토픽으로 이동합니다.</p>
        {spotlightTopics.length > 0 ? (
          <div className="admin-spotlight-grid" style={{ marginTop: "0.65rem" }}>
            {spotlightTopics.map((topic) => {
              const ageHours = Math.floor((Date.now() - new Date(topic.createdAt).getTime()) / (1000 * 60 * 60));
              return (
                <Link key={topic.id} href={`/admin/topics/${topic.id}/resolve`} className="admin-spotlight-link">
                  <span className="admin-spotlight-status">{topic.status}</span>
                  <strong className="admin-spotlight-title">{topic.title}</strong>
                  <small className="admin-spotlight-meta">경과 {Math.max(ageHours, 0)}시간 · Resolve 바로가기</small>
                </Link>
              );
            })}
          </div>
        ) : (
          <StatePanel
            title="스포트라이트 대상이 없습니다"
            description="긴급 처리할 OPEN/LOCKED 토픽이 없습니다. 신규 토픽 품질 점검을 진행하세요."
            tone="success"
          />
        )}
      </Card>

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

      <Card id="topic-filter">
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

      <div id="topic-list" className="list">
        {selectedStatus === "ALL" && !keyword ? (
          <StatePanel
            title="오늘의 실행 루틴"
            description={`OPEN/LOCKED ${pendingResolveCount}건을 우선 정리하고, RESOLVED 무결성 이슈 ${integrityIssueTotal}건을 이어서 점검하세요.`}
            tone={pendingResolveCount > 0 || integrityIssueTotal > 0 ? "warning" : "success"}
            actions={
              pendingResolveCount > 0
                ? <Link className="btn btn-primary" href="/admin/topics?status=OPEN">OPEN 토픽 먼저 보기</Link>
                : <Link className="btn btn-secondary" href="/admin/topics/new">새 토픽 만들기</Link>
            }
          />
        ) : null}
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
          <div className="admin-empty-pattern" role="status">
            <p className="admin-empty-kicker">No topic match</p>
            <strong>조건에 맞는 토픽이 없습니다</strong>
            <p>검색어를 줄이거나 상태를 ALL로 전환해 다시 확인하세요.</p>
            <div>
              <Link className="btn btn-secondary" href="/admin/topics?status=ALL">필터 초기화</Link>
            </div>
          </div>
        ) : null}
      </div>

      <div className="admin-mobile-dock" aria-label="모바일 토픽 운영 빠른 실행">
        <Link href="/admin/topics?status=OPEN" className="admin-quick-action-btn">OPEN {statusCounts.OPEN}</Link>
        <Link href="/admin/topics?status=LOCKED" className="admin-quick-action-btn">LOCKED {statusCounts.LOCKED}</Link>
        <Link href="/admin/topics/new" className="admin-quick-action-btn">새 토픽</Link>
      </div>
      <div className="admin-mobile-dock-spacer" aria-hidden />
    </PageContainer>
  );
}
