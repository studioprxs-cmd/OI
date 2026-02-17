import Link from "next/link";

import { FeedCard } from "@/components/FeedCard";
import { WidgetCard } from "@/components/WidgetCard";
import { OiBadge, Pill, PageContainer, StatePanel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";

type Props = {
  searchParams?: Promise<{ q?: string; status?: string }>;
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
      voteCount: topic._count.votes,
      betCount: topic._count.bets,
      commentCount: topic._count.comments,
    })),
    ...mockTopicSummaries().filter((mock) => !dbTopics.some((topic) => topic.id === mock.id)),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const filteredTopics = topics.filter((topic) => {
    if (statusFilter !== "ALL" && topic.status !== statusFilter) return false;
    if (!normalizedKeyword) return true;

    return `${topic.title} ${topic.description}`.toLowerCase().includes(normalizedKeyword);
  });

  const activeTopics = topics.filter((topic) => topic.status === "OPEN").length;
  const resolvedTopics = topics.filter((topic) => topic.status === "RESOLVED").length;

  return (
    <PageContainer>
      <div className="content-grid">
        <main className="main-column">
          <section className="hero-block compact">
            <OiBadge label="OI Topics" />
            <p className="hero-eyebrow">Topics</p>
            <h1>전체 토픽 피드</h1>
            <p>토론·예측 토픽을 한눈에 비교하고, 관심 이슈에 바로 참여해보세요.</p>
            <div className="row" style={{ marginTop: "0.6rem" }}>
              <Pill tone="success">활성 {activeTopics}</Pill>
              <Pill tone="danger">종료 {resolvedTopics}</Pill>
              {canManage ? <Link href="/admin/topics" className="text-link">관리자 화면</Link> : null}
            </div>
            <div className="filter-chip-row" style={{ marginTop: "0.55rem" }}>
              <Link
                href={`/topics${keyword ? `?q=${encodeURIComponent(keyword)}&status=OPEN` : "?status=OPEN"}`}
                className={`filter-chip ${statusFilter === "OPEN" ? "is-active" : ""}`}
              >
                오픈만 보기
              </Link>
              <Link
                href={`/topics${keyword ? `?q=${encodeURIComponent(keyword)}&status=RESOLVED` : "?status=RESOLVED"}`}
                className={`filter-chip ${statusFilter === "RESOLVED" ? "is-active" : ""}`}
              >
                종료만 보기
              </Link>
              <Link href={keyword ? "/topics" : "/topics?status=ALL"} className={`filter-chip ${statusFilter === "ALL" ? "is-active" : ""}`}>필터 초기화</Link>
            </div>
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
                    title={<Link href={`/topics/${topic.id}`} className="title-link">{topic.title}</Link>}
                    description={topic.description}
                    badge={<Pill tone={statusTone(topic.status)}>{topic.status}</Pill>}
                    meta={<span className="topic-meta-chips"><span>투표 {topic.voteCount}</span><span>베팅 {topic.betCount}</span><span>댓글 {topic.commentCount}</span></span>}
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
