import Link from "next/link";

import { FeedCard } from "@/components/FeedCard";
import { WidgetCard } from "@/components/WidgetCard";
import { OiBadge, Pill, PageContainer, StatePanel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";
import { parseTopicKindFromTitle } from "@/lib/topic";
import { getTopicThumbnail } from "@/lib/topic-thumbnail";

type Props = {
  searchParams?: Promise<{ q?: string; status?: string; kind?: string }>;
};

function statusTone(status: string): "neutral" | "success" | "danger" {
  if (status === "OPEN") return "success";
  if (status === "RESOLVED") return "danger";
  return "neutral";
}

export default async function TopicsPage({ searchParams }: Props) {
  const canUseDb = Boolean(process.env.DATABASE_URL);
  const viewer = await getSessionUser();
  const canManage = viewer?.role === "ADMIN";
  const params = (await searchParams) ?? {};

  const keyword = (params.q ?? "").trim();
  const normalizedKeyword = keyword.toLowerCase();
  const statusFilter = params.status === "OPEN" || params.status === "RESOLVED" ? params.status : "ALL";
  const kindFilter = params.kind === "BETTING" || params.kind === "POLL" ? params.kind : "ALL";

  const buildTopicFilterHref = (next: { status?: "OPEN" | "RESOLVED" | "ALL"; kind?: "BETTING" | "POLL" | "ALL" }) => {
    const search = new URLSearchParams();

    if (keyword) search.set("q", keyword);

    const nextStatus = next.status ?? statusFilter;
    const nextKind = next.kind ?? kindFilter;

    if (nextStatus !== "ALL") search.set("status", nextStatus);
    if (nextKind !== "ALL") search.set("kind", nextKind);

    const query = search.toString();
    return query ? `/topics?${query}` : "/topics";
  };

  const dbTopics = canUseDb ? await db.topic
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { votes: true, bets: true, comments: true } } },
    })
    .catch(() => []) : [];

  const topics = [
    ...dbTopics.map((topic) => ({
      ...topic,
      kind: parseTopicKindFromTitle(topic.title),
      voteCount: topic._count.votes,
      betCount: topic._count.bets,
      commentCount: topic._count.comments,
    })),
    ...mockTopicSummaries()
      .filter((mock) => !dbTopics.some((topic) => topic.id === mock.id))
      .map((mock) => ({ ...mock, kind: parseTopicKindFromTitle(mock.title) })),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const filteredTopics = topics.filter((topic) => {
    if (statusFilter !== "ALL" && topic.status !== statusFilter) return false;
    if (kindFilter !== "ALL" && topic.kind !== kindFilter) return false;
    if (!normalizedKeyword) return true;

    return `${topic.title} ${topic.description}`.toLowerCase().includes(normalizedKeyword);
  });

  const activeTopics = topics.filter((topic) => topic.status === "OPEN").length;
  const resolvedTopics = topics.filter((topic) => topic.status === "RESOLVED").length;
  const bettingTopics = topics.filter((topic) => topic.kind === "BETTING").length;
  const pollTopics = topics.filter((topic) => topic.kind === "POLL").length;
  const filteredOpenCount = filteredTopics.filter((topic) => topic.status === "OPEN").length;

  const featuredTopics = filteredTopics
    .slice()
    .sort((a, b) => (b.voteCount + b.betCount + b.commentCount) - (a.voteCount + a.betCount + a.commentCount))
    .slice(0, 3);

  const topicExperienceSignals = [
    {
      id: "hierarchy",
      label: "Visual hierarchy",
      value: filteredOpenCount > 0 ? "Active" : "Calm",
      hint: filteredOpenCount > 0 ? `지금 참여 가능 ${filteredOpenCount}건 우선 노출` : "핵심 요약 중심 정돈 상태",
      tone: filteredOpenCount > 0 ? "warning" : "ok",
    },
    {
      id: "spacing",
      label: "Spacing rhythm",
      value: "Premium cadence",
      hint: "카드 간격과 텍스트 리듬을 모바일 기준으로 유지",
      tone: "neutral",
    },
    {
      id: "thumb",
      label: "Thumb reach",
      value: "Primary ready",
      hint: keyword ? `검색어 “${keyword}” 결과로 바로 진입` : "필터 → 탭 → 리스트 동선 최소화",
      tone: keyword ? "warning" : "ok",
    },
    {
      id: "states",
      label: "State clarity",
      value: filteredTopics.length === 0 ? "Empty" : "Stable",
      hint: filteredTopics.length === 0 ? "필터 초기화 CTA를 상단에 노출" : "빈 상태/오류 상태 패턴 정돈",
      tone: filteredTopics.length === 0 ? "danger" : "ok",
    },
  ] as const;

  return (
    <PageContainer>
      <div className="content-grid topics-layout">
        <main className="main-column">
          <section className="topic-head-panel">
            <div className="topic-head-title">
              <OiBadge label="OI Topics" />
              <p className="hero-eyebrow">Topics Explorer</p>
              <h1>전체 토픽 피드</h1>
              <p>토론·예측 토픽을 한눈에 비교하고, 관심 이슈에 바로 참여해보세요.</p>
            </div>
            <div className="row" style={{ marginTop: "0.6rem" }}>
              <Pill tone="success">활성 {activeTopics}</Pill>
              <Pill tone="danger">종료 {resolvedTopics}</Pill>
              <Pill>베팅형 {bettingTopics}</Pill>
              <Pill>여론형 {pollTopics}</Pill>
              {canManage ? <Link href="/admin/topics" className="text-link">관리자 화면</Link> : null}
            </div>
            <div className="topic-filter-row" style={{ marginTop: "0.62rem" }}>
              <Link
                href={buildTopicFilterHref({ status: "OPEN" })}
                className={`topic-filter-chip ${statusFilter === "OPEN" ? "is-active" : ""}`}
              >
                오픈만 보기
              </Link>
              <Link
                href={buildTopicFilterHref({ status: "RESOLVED" })}
                className={`topic-filter-chip ${statusFilter === "RESOLVED" ? "is-active" : ""}`}
              >
                종료만 보기
              </Link>
              <Link href={buildTopicFilterHref({ status: "ALL" })} className={`topic-filter-chip ${statusFilter === "ALL" ? "is-active" : ""}`}>상태 초기화</Link>
            </div>
            <div className="topic-kind-tabs" style={{ marginTop: "0.42rem" }} role="tablist" aria-label="이슈 유형 탭">
              <Link
                href={buildTopicFilterHref({ kind: "BETTING" })}
                className={`topic-kind-tab ${kindFilter === "BETTING" ? "is-active" : ""}`}
                role="tab"
                aria-selected={kindFilter === "BETTING"}
              >
                베팅 가능 이슈
              </Link>
              <Link
                href={buildTopicFilterHref({ kind: "POLL" })}
                className={`topic-kind-tab ${kindFilter === "POLL" ? "is-active" : ""}`}
                role="tab"
                aria-selected={kindFilter === "POLL"}
              >
                여론 투표 이슈
              </Link>
              <Link
                href={buildTopicFilterHref({ kind: "ALL" })}
                className={`topic-kind-tab ${kindFilter === "ALL" ? "is-active" : ""}`}
                role="tab"
                aria-selected={kindFilter === "ALL"}
              >
                전체
              </Link>
            </div>
          </section>

          <section className="topics-visual-stage" aria-label="토픽 비주얼 스테이지">
            <div className="section-header topics-visual-stage-header">
              <p className="section-kicker">TOPICS Visual Stage</p>
              <h2>배너 중심으로 바로 참여</h2>
            </div>
            <div className="topics-visual-stage-grid">
              {featuredTopics.map((topic, index) => (
                <article key={`featured-${topic.id}`} className="topics-visual-card">
                  <Link href={`/topics/${topic.id}`} className="topics-visual-image" aria-label={`${topic.title} 열기`}>
                    <img src={getTopicThumbnail(topic.id, topic.title)} alt={`${topic.title} 대표 배너`} loading="lazy" />
                    <span className="topics-visual-badge">#{index + 1} 참여 집중</span>
                  </Link>
                  <div className="topics-visual-body">
                    <strong>
                      <Link href={`/topics/${topic.id}`} className="title-link">{topic.title}</Link>
                    </strong>
                    <small>{topic.status === "OPEN" ? "지금 참여 가능" : "결과/정산 확인"} · {topic.kind === "BETTING" ? "베팅형" : "여론형"}</small>
                    <div className="topics-visual-meta">
                      <span>투표 {topic.voteCount}</span>
                      <span>베팅 {topic.betCount}</span>
                      <span>댓글 {topic.commentCount}</span>
                    </div>
                    <Link href={`/topics/${topic.id}`} className="btn btn-primary topics-visual-cta">참여/확인</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="topic-command-grid" aria-label="토픽 탐색 빠른 실행">
            <Link href={buildTopicFilterHref({ status: "OPEN", kind: "ALL" })} className="topic-command-card is-primary">
              <span>Now</span>
              <strong>참여 가능한 이슈 보기</strong>
              <small>OPEN {activeTopics}건 · 지금 바로 참여</small>
            </Link>
            <Link href={buildTopicFilterHref({ status: "RESOLVED", kind: "ALL" })} className="topic-command-card is-secondary">
              <span>Next</span>
              <strong>종료 이슈 결과 확인</strong>
              <small>RESOLVED {resolvedTopics}건 · 정산/결과 체크</small>
            </Link>
            <Link href={buildTopicFilterHref({})} className="topic-command-card is-neutral">
              <span>Mode</span>
              <strong>{statusFilter} · {kindFilter}</strong>
              <small>{keyword ? `검색어 “${keyword}” 적용` : "필터 없이 전체 탐색"}</small>
            </Link>
          </section>

          <section className="topic-polish-strip" aria-label="제품 완성도 신호">
            {topicExperienceSignals.map((item) => (
              <article key={item.id} className={`topic-polish-item is-${item.tone}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.hint}</small>
              </article>
            ))}
          </section>

          <section className="topic-summary-grid" aria-label="토픽 요약 지표">
            <article className="topic-summary-card">
              <p className="topic-summary-label">활성 토픽</p>
              <strong className="topic-summary-value">{activeTopics}</strong>
              <span className="topic-summary-meta">지금 참여 가능한 이슈</span>
            </article>
            <article className="topic-summary-card">
              <p className="topic-summary-label">종료 토픽</p>
              <strong className="topic-summary-value">{resolvedTopics}</strong>
              <span className="topic-summary-meta">정산/결과 확인 가능</span>
            </article>
            <article className="topic-summary-card">
              <p className="topic-summary-label">현재 필터</p>
              <strong className="topic-summary-value">{statusFilter} · {kindFilter}</strong>
              <span className="topic-summary-meta">{keyword ? `검색어 “${keyword}” 적용` : "검색어 없음"}</span>
            </article>
          </section>

          {topics.length === 0 ? (
            <StatePanel
              title="아직 생성된 토픽이 없습니다"
              description="관리자 화면에서 첫 토픽을 생성해 피드를 시작해보세요."
              tone="warning"
              actions={canManage ? <Link href="/admin/topics/new" className="btn btn-primary">첫 토픽 만들기</Link> : null}
            />
          ) : null}

          <section className="feed-section">
            <div className="section-header">
              <p className="section-kicker">전체 토픽</p>
              <h2>
                토픽 목록
                {keyword ? ` · “${keyword}” 검색 결과` : ""}
              </h2>
            </div>
            {filteredTopics.length === 0 ? (
              <StatePanel
                title="조건에 맞는 토픽이 없습니다"
                description={`현재 필터: ${statusFilter}${keyword ? ` · 키워드: ${keyword}` : ""}`}
                actions={<Link href="/topics" className="btn btn-secondary">전체 토픽 보기</Link>}
              />
            ) : (
              <div className="feed-list">
                {filteredTopics.map((topic) => (
                  <FeedCard
                    key={topic.id}
                    thumbnailSrc={getTopicThumbnail(topic.id, topic.title)}
                    thumbnailAlt={`${topic.title} 썸네일`}
                    title={<Link href={`/topics/${topic.id}`} className="title-link">{topic.title}</Link>}
                    description={topic.description}
                    badge={<Pill tone={statusTone(topic.status)}>{topic.status} · {topic.kind === "BETTING" ? "베팅" : "여론"}</Pill>}
                    meta={<span className="topic-meta-chips"><span>투표 {topic.voteCount}</span><span>{topic.kind === "BETTING" ? `베팅 ${topic.betCount}` : "베팅 없음"}</span><span>댓글 {topic.commentCount}</span></span>}
                    footer={<Link href={`/topics/${topic.id}`} className="text-link">토픽 열기 →</Link>}
                  />
                ))}
              </div>
            )}
          </section>
        </main>

        <aside className="widget-column">
          <WidgetCard title="필터 힌트">
            <ul className="simple-list muted">
              <li>상단 검색창에서 제목/설명 검색</li>
              <li>오픈/종료 상태를 빠르게 전환</li>
              <li>관리자는 상태 변경 가능</li>
            </ul>
          </WidgetCard>
        </aside>
      </div>
    </PageContainer>
  );
}
