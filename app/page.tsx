import Link from "next/link";

import { FeedCard } from "@/components/FeedCard";
import { WidgetCard } from "@/components/WidgetCard";
import { OiBadge, Pill, PageContainer } from "@/components/ui";
import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";

function statusTone(status: string): "neutral" | "success" | "danger" {
  if (status === "OPEN") return "success";
  if (status === "RESOLVED") return "danger";
  return "neutral";
}

export default async function HomePage() {
  const mock = mockTopicSummaries();
  const canUseDb = Boolean(process.env.DATABASE_URL);

  const topics = canUseDb ? await db.topic
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
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
    .catch(() => []) : [];

  const combined = [...topics, ...mock.filter((item) => !topics.some((topic) => topic.id === item.id))];
  const latest = combined
    .slice()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 5);
  const trending = combined
    .slice()
    .sort((a, b) => b.voteCount + b.commentCount - (a.voteCount + a.commentCount))
    .slice(0, 5);

  const totalVotes = combined.reduce((sum, topic) => sum + topic.voteCount, 0);
  const totalBets = combined.reduce((sum, topic) => sum + topic.betCount, 0);
  const openCount = combined.filter((topic) => topic.status === "OPEN").length;

  return (
    <PageContainer>
      <div className="content-grid">
        <main className="main-column">
          <section className="hero-block">
            <OiBadge label="OI Brief" />
            <p className="hero-eyebrow">OI Community Dashboard</p>
            <h1>오늘의 이슈</h1>
            <p>정치·경제 이슈를 투명하게 파악하고, 1분 안에 참여까지 이어지는 모바일 퍼스트 커뮤니티 허브</p>
            <div className="hero-kpis">
              <div>
                <span>오픈 토픽</span>
                <strong>{openCount}</strong>
              </div>
              <div>
                <span>총 투표</span>
                <strong>{totalVotes.toLocaleString("ko-KR")}</strong>
              </div>
              <div>
                <span>총 베팅</span>
                <strong>{totalBets.toLocaleString("ko-KR")}</strong>
              </div>
            </div>
          </section>

          <section className="feed-section">
            <div className="section-heading-row">
              <h2>인기 토픽</h2>
              <Link href="/topics" className="text-link">전체 보기</Link>
            </div>
            <div className="feed-list">
              {trending.map((topic) => (
                <FeedCard
                  key={topic.id}
                  title={<Link href={`/topics/${topic.id}`} className="title-link">{topic.title}</Link>}
                  description={topic.description}
                  badge={<Pill tone={statusTone(topic.status)}>{topic.status}</Pill>}
                  meta={`투표 ${topic.voteCount} · 댓글 ${topic.commentCount}`}
                />
              ))}
            </div>
          </section>

          <section className="feed-section">
            <h2>최신 이슈</h2>
            <div className="feed-list">
              {latest.map((topic) => (
                <FeedCard
                  key={topic.id}
                  title={<Link href={`/topics/${topic.id}`} className="title-link">{topic.title}</Link>}
                  description={topic.description}
                  meta={new Date(topic.createdAt).toLocaleDateString("ko-KR")}
                />
              ))}
            </div>
          </section>
        </main>

        <aside className="widget-column">
          <WidgetCard title="Trending">
            <ul className="simple-list">
              {trending.slice(0, 4).map((topic) => (
                <li key={`t-${topic.id}`}>
                  <Link href={`/topics/${topic.id}`}>{topic.title}</Link>
                </li>
              ))}
            </ul>
          </WidgetCard>

          <WidgetCard title="New Members">
            <ul className="simple-list muted">
              <li>@mint_jiyoon · 방금 참여</li>
              <li>@policy_woo · 5분 전</li>
              <li>@alpha_hyeri · 17분 전</li>
              <li>@market_doyoung · 28분 전</li>
            </ul>
          </WidgetCard>
        </aside>
      </div>
    </PageContainer>
  );
}
