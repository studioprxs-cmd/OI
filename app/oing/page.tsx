import Link from "next/link";

import { FeedCard } from "@/components/FeedCard";
import { WidgetCard } from "@/components/WidgetCard";
import { OiBadge, PageContainer, Pill, StatePanel } from "@/components/ui";
import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";
import { parseTopicKindFromTitle } from "@/lib/topic";

function statusTone(status: string): "neutral" | "success" | "danger" {
  if (status === "OPEN") return "success";
  if (status === "RESOLVED") return "danger";
  return "neutral";
}

export default async function OingPage() {
  const canUseDb = Boolean(process.env.DATABASE_URL);

  const now = Date.now();
  const minCloseMs = now + (10 * 60 * 1000);
  const maxCloseMs = now + (7 * 24 * 60 * 60 * 1000);

  const dbTopics = canUseDb ? await db.topic.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      bets: { select: { choice: true, amount: true } },
      _count: { select: { votes: true, bets: true, comments: true } },
    },
  }).catch(() => []) : [];

  const bettingTopicsFromDb = dbTopics
    .filter((topic) => {
      if (parseTopicKindFromTitle(topic.title) !== "BETTING") return false;
      if (topic.status !== "OPEN") return false;

      const closeMs = new Date(topic.closeAt).getTime();
      if (Number.isNaN(closeMs)) return false;

      return closeMs >= minCloseMs && closeMs <= maxCloseMs;
    })
    .map((topic) => {
      const yesPool = topic.bets.filter((bet) => bet.choice === "YES").reduce((sum, bet) => sum + bet.amount, 0);
      const noPool = topic.bets.filter((bet) => bet.choice === "NO").reduce((sum, bet) => sum + bet.amount, 0);
      const totalPool = yesPool + noPool;
      const yesPrice = totalPool > 0 ? yesPool / totalPool : 0.5;
      const noPrice = totalPool > 0 ? noPool / totalPool : 0.5;

      return {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        status: topic.status,
        createdAt: topic.createdAt,
        voteCount: topic._count.votes,
        betCount: topic._count.bets,
        commentCount: topic._count.comments,
        yesPool,
        noPool,
        totalPool,
        yesPrice,
        noPrice,
      };
    });

  const fallbackMock = mockTopicSummaries()
    .filter((topic) => {
      if (parseTopicKindFromTitle(topic.title) !== "BETTING") return false;
      if (topic.status !== "OPEN") return false;

      const closeMs = new Date(topic.closeAt).getTime();
      if (Number.isNaN(closeMs)) return false;

      return closeMs >= minCloseMs && closeMs <= maxCloseMs;
    })
    .map((topic) => {
      const yesPool = Math.floor(topic.totalPool * 0.5);
      const noPool = topic.totalPool - yesPool;
      const totalPool = yesPool + noPool;
      return {
        ...topic,
        yesPool,
        noPool,
        yesPrice: totalPool > 0 ? yesPool / totalPool : 0.5,
        noPrice: totalPool > 0 ? noPool / totalPool : 0.5,
      };
    });

  const bettingTopics = [
    ...bettingTopicsFromDb,
    ...fallbackMock.filter((mock) => !bettingTopicsFromDb.some((topic) => topic.id === mock.id)),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const openCount = bettingTopics.filter((topic) => topic.status === "OPEN").length;
  const totalPool = bettingTopics.reduce((sum, topic) => sum + topic.totalPool, 0);

  return (
    <PageContainer>
      <div className="content-grid">
        <main className="main-column">
          <section className="hero-block compact">
            <OiBadge label="OING" />
            <p className="hero-eyebrow">Polymarket-style Betting</p>
            <h1>오잉 베팅</h1>
            <p>핫한 이슈에 YES/NO로 베팅하고 포인트를 쌓아보세요. 오잉은 <strong>최소 10분 ~ 최대 7일</strong> 안에 결과가 나는 명확한 주제만 다룹니다.</p>
            <div className="row" style={{ marginTop: "0.6rem" }}>
              <Pill tone="success">진행중 {openCount}</Pill>
              <Pill tone="neutral">만기 10분~7일</Pill>
              <Pill tone="neutral">총 베팅풀 {totalPool.toLocaleString("ko-KR")} pt</Pill>
              <Link href="/topics?kind=BETTING" className="text-link">전체 베팅 토픽</Link>
            </div>
          </section>

          {bettingTopics.length === 0 ? (
            <StatePanel
              title="베팅 가능한 오잉 이슈가 아직 없습니다"
              description="지금은 10분~7일 조건에 맞는 OPEN 베팅 토픽이 없습니다. 조건에 맞는 토픽이 열리면 여기서 바로 참여할 수 있어요."
              tone="warning"
              actions={<Link href="/topics" className="btn btn-secondary">토픽 보러가기</Link>}
            />
          ) : (
            <section className="feed-section">
              <div className="section-header">
                <p className="section-kicker">Live Markets</p>
                <h2>오잉 마켓 보드</h2>
              </div>
              <div className="feed-list">
                {bettingTopics.map((topic) => (
                  <FeedCard
                    key={topic.id}
                    title={<Link href={`/topics/${topic.id}`} className="title-link">{topic.title}</Link>}
                    description={topic.description}
                    badge={<Pill tone={statusTone(topic.status)}>{topic.status}</Pill>}
                    meta={`YES ${(topic.yesPrice * 100).toFixed(0)}% · NO ${(topic.noPrice * 100).toFixed(0)}% · 베팅 ${topic.betCount}`}
                    footer={
                      <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
                        <small style={{ color: "#5f7468" }}>풀 {topic.totalPool.toLocaleString("ko-KR")}pt (YES {topic.yesPool.toLocaleString("ko-KR")} / NO {topic.noPool.toLocaleString("ko-KR")})</small>
                        <Link href={`/topics/${topic.id}`} className="btn btn-primary" style={{ minHeight: "40px" }}>베팅하러 가기</Link>
                      </div>
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="widget-column">
          <WidgetCard title="오잉 가이드">
            <ul className="simple-list muted">
              <li>OPEN 상태에서만 베팅 가능</li>
              <li>토픽 종료 후 관리자 정산 진행</li>
              <li>정산 결과는 내 활동에서 확인</li>
            </ul>
          </WidgetCard>
        </aside>
      </div>
    </PageContainer>
  );
}
