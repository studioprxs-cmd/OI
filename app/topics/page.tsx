import Link from "next/link";

import { FeedCard } from "@/components/FeedCard";
import { WidgetCard } from "@/components/WidgetCard";
import { Pill, PageContainer } from "@/components/ui";
import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";

function statusTone(status: string): "neutral" | "success" | "danger" {
  if (status === "OPEN") return "success";
  if (status === "RESOLVED") return "danger";
  return "neutral";
}

export default async function TopicsPage() {
  const canUseDb = Boolean(process.env.DATABASE_URL);

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

  const activeTopics = topics.filter((topic) => topic.status === "OPEN").length;

  return (
    <PageContainer>
      <div className="content-grid">
        <main className="main-column">
          <section className="hero-block compact">
            <p className="hero-eyebrow">Topics</p>
            <h1>전체 토픽 피드</h1>
            <p>실시간 토론/예측 토픽을 확인하고 원하는 이슈에 참여해보세요.</p>
            <div className="row" style={{ marginTop: "0.6rem" }}>
              <Pill tone="success">활성 {activeTopics}</Pill>
              <Link href="/admin/topics" className="text-link">관리자 화면</Link>
            </div>
          </section>

          {topics.length === 0 ? (
            <FeedCard title="아직 생성된 토픽이 없습니다." description="관리자 화면에서 첫 토픽을 생성해보세요." />
          ) : null}

          <section className="feed-section">
            <div className="feed-list">
              {topics.map((topic) => (
                <FeedCard
                  key={topic.id}
                  title={<Link href={`/topics/${topic.id}`} className="title-link">{topic.title}</Link>}
                  description={topic.description}
                  badge={<Pill tone={statusTone(topic.status)}>{topic.status}</Pill>}
                  meta={`투표 ${topic.voteCount} · 베팅 ${topic.betCount} · 댓글 ${topic.commentCount}`}
                />
              ))}
            </div>
          </section>
        </main>

        <aside className="widget-column">
          <WidgetCard title="필터 힌트">
            <ul className="simple-list muted">
              <li>BETTING/POLL 키워드로 검색</li>
              <li>상단 네비게이션에서 빠른 이동</li>
              <li>관리자는 상태 변경 가능</li>
            </ul>
          </WidgetCard>
        </aside>
      </div>
    </PageContainer>
  );
}
