import { Choice } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BetTicket } from "./BetTicket";
import { CommentForm } from "./CommentForm";
import { CommentReportButton } from "./CommentReportButton";
import { TopicReportButton } from "./TopicReportButton";

import { FeedCard } from "@/components/FeedCard";
import { WidgetCard } from "@/components/WidgetCard";
import { OiBadge, PageContainer, Pill } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findMockTopic } from "@/lib/mock-data";
import { getParticipationBlockReason } from "@/lib/topic-policy";

type Props = { params: Promise<{ id: string }> };

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function statusTone(status: string): "neutral" | "success" | "danger" {
  if (status === "OPEN") return "success";
  if (status === "RESOLVED") return "danger";
  return "neutral";
}

export default async function TopicDetailPage({ params }: Props) {
  const { id } = await params;
  const canUseDb = Boolean(process.env.DATABASE_URL);
  const viewer = await getSessionUser();
  const canManage = viewer?.role === "ADMIN";
  const canReport = Boolean(viewer);

  const dbTopic = canUseDb ? await db.topic
    .findUnique({
      where: { id },
      include: {
        votes: { select: { choice: true } },
        bets: { select: { userId: true, choice: true, amount: true, settled: true, payoutAmount: true } },
        comments: {
          where: { isHidden: false },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        resolution: { select: { result: true, summary: true, resolvedAt: true } },
        _count: { select: { votes: true, bets: true, comments: true } },
      },
    })
    .catch(() => null) : null;

  const mockTopic = findMockTopic(id);

  if (!dbTopic && !mockTopic) return notFound();

  const yesVotes = dbTopic
    ? dbTopic.votes.filter((vote) => vote.choice === Choice.YES).length
    : (mockTopic?.yesVotes ?? 0);
  const noVotes = dbTopic
    ? dbTopic.votes.filter((vote) => vote.choice === Choice.NO).length
    : (mockTopic?.noVotes ?? 0);
  const totalVotes = yesVotes + noVotes;

  const yesPool = dbTopic
    ? dbTopic.bets.filter((bet) => bet.choice === Choice.YES).reduce((sum, bet) => sum + bet.amount, 0)
    : (mockTopic?.yesPool ?? 0);
  const noPool = dbTopic
    ? dbTopic.bets.filter((bet) => bet.choice === Choice.NO).reduce((sum, bet) => sum + bet.amount, 0)
    : (mockTopic?.noPool ?? 0);
  const totalPool = yesPool + noPool;

  const settledBetCount = dbTopic ? dbTopic.bets.filter((bet) => bet.settled).length : 0;
  const totalPayout = dbTopic
    ? dbTopic.bets.reduce((sum, bet) => sum + Number(bet.payoutAmount ?? 0), 0)
    : 0;

  const participationBlockReason = dbTopic
    ? getParticipationBlockReason({ status: dbTopic.status, closeAt: dbTopic.closeAt })
    : "데모 토픽에서는 베팅이 제한됩니다.";
  const canBet = canUseDb && !participationBlockReason;

  const resolution = dbTopic?.resolution
    ? {
      result: dbTopic.resolution.result,
      summary: dbTopic.resolution.summary,
      resolvedAt: dbTopic.resolution.resolvedAt,
    }
    : null;

  const winnerPool = resolution
    ? resolution.result === Choice.YES
      ? yesPool
      : noPool
    : 0;
  const winnerPayoutMultiplier = winnerPool > 0 ? totalPool / winnerPool : 0;

  const viewerBets = dbTopic && viewer
    ? dbTopic.bets.filter((bet) => bet.userId === viewer.id)
    : [];
  const viewerBetTotal = viewerBets.reduce((sum, bet) => sum + bet.amount, 0);
  const viewerPayoutTotal = viewerBets.reduce((sum, bet) => sum + Number(bet.payoutAmount ?? 0), 0);
  const viewerProfit = viewerPayoutTotal - viewerBetTotal;
  const viewerSettledCount = viewerBets.filter((bet) => bet.settled).length;
  const viewerPendingCount = viewerBets.filter((bet) => !bet.settled).length;

  const topic = {
    id: dbTopic?.id ?? mockTopic!.id,
    title: dbTopic?.title ?? mockTopic!.title,
    description: dbTopic?.description ?? mockTopic!.description,
    status: dbTopic?.status ?? mockTopic!.status,
    comments: dbTopic?.comments ?? mockTopic!.comments,
    counts: dbTopic
      ? { votes: dbTopic._count.votes, bets: dbTopic._count.bets, comments: dbTopic._count.comments }
      : { votes: mockTopic!.voteCount, bets: mockTopic!.betCount, comments: mockTopic!.commentCount },
  };

  return (
    <PageContainer>
      <div className="content-grid">
        <section className="main-column">
          <section className="hero-block compact">
            <OiBadge label="OI Detail" />
            <p className="hero-eyebrow">Topic Detail</p>
            <h1>{topic.title}</h1>
            <p>{topic.description}</p>
            <div className="row" style={{ marginTop: "0.6rem", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
              <div className="row">
                <Pill tone={statusTone(topic.status)}>{topic.status}</Pill>
                <span className="muted-inline">투표 {topic.counts.votes} · 베팅 {topic.counts.bets} · 댓글 {topic.counts.comments}</span>
              </div>
              {canReport ? <TopicReportButton topicId={topic.id} /> : null}
            </div>
            <nav className="topic-anchor-nav" aria-label="토픽 빠른 이동">
              <a href="#topic-metrics">지표</a>
              {resolution ? <a href="#topic-settlement">정산</a> : null}
              <a href="#topic-comment-form">댓글 작성</a>
              <a href="#topic-comments">최근 댓글</a>
            </nav>
          </section>

          <section id="topic-metrics" className="feed-section">
            <div className="section-header">
              <p className="section-kicker">실시간 현황</p>
              <h2>투표 · 베팅 지표</h2>
            </div>
            <div className="stats-grid">
            <FeedCard title="YES 투표" meta={`${yesVotes}표 (${percent(yesVotes, totalVotes)}%)`}>
              <div className="meter"><span style={{ width: `${percent(yesVotes, totalVotes)}%` }} /></div>
            </FeedCard>
            <FeedCard title="NO 투표" meta={`${noVotes}표 (${percent(noVotes, totalVotes)}%)`}>
              <div className="meter"><span style={{ width: `${percent(noVotes, totalVotes)}%` }} /></div>
            </FeedCard>
            <FeedCard title="총 베팅 풀" meta={`${totalPool.toLocaleString("ko-KR")} pt`}>
              <p className="feed-card-meta" style={{ marginTop: 0 }}>YES {yesPool.toLocaleString("ko-KR")} · NO {noPool.toLocaleString("ko-KR")}</p>
            </FeedCard>
            </div>
          </section>

          <FeedCard title="Polymarket 스타일 베팅 티켓" meta="현재 풀 기준 가격/예상 수령을 보면서 바로 참여">
            <BetTicket
              topicId={topic.id}
              yesPool={yesPool}
              noPool={noPool}
              canBet={Boolean(canBet)}
              isAuthenticated={Boolean(viewer)}
              blockReason={participationBlockReason ?? undefined}
            />
          </FeedCard>

          {resolution ? (
            <div id="topic-settlement">
              <FeedCard title="결과 확정">
                <div className="list" style={{ gap: "0.5rem" }}>
                  <div className="row" style={{ gap: "0.5rem" }}>
                    <Pill tone="danger">결과 {resolution.result}</Pill>
                    <small style={{ color: "#6b7280" }}>{new Date(resolution.resolvedAt).toLocaleString("ko-KR")} 확정</small>
                  </div>
                  <p style={{ margin: 0 }}>{resolution.summary}</p>
                  <small style={{ color: "#6b7280" }}>
                    정산 완료 베팅 {settledBetCount}건 · 총 지급 {totalPayout.toLocaleString("ko-KR")} pt · 승리 풀 {winnerPool.toLocaleString("ko-KR")} pt
                    {winnerPayoutMultiplier > 0 ? ` · 배당 배율 ${winnerPayoutMultiplier.toFixed(2)}x` : " · 배당 없음"}
                  </small>
                  <small style={{ color: "#6b7280" }}>
                    정산 공식: 개인 지급 = 개인 베팅 × (총 베팅 풀 ÷ 승리 선택 풀)
                  </small>
                </div>
              </FeedCard>
            </div>
          ) : null}

          {viewer && canUseDb && viewerBets.length > 0 ? (
            <FeedCard title="내 정산 현황">
              <div className="list" style={{ gap: "0.45rem" }}>
                <div className="row" style={{ gap: "0.5rem" }}>
                  <Pill tone={viewerProfit >= 0 ? "success" : "danger"}>
                    {resolution ? `손익 ${viewerProfit >= 0 ? "+" : ""}${viewerProfit.toLocaleString("ko-KR")} pt` : `참여 ${viewerBets.length}건`}
                  </Pill>
                  <small style={{ color: "#6b7280" }}>
                    베팅 {viewerBetTotal.toLocaleString("ko-KR")} pt
                    {resolution ? ` · 지급 ${viewerPayoutTotal.toLocaleString("ko-KR")} pt` : ""}
                  </small>
                </div>
                <small style={{ color: "#6b7280" }}>
                  정산 완료 {viewerSettledCount}건 · 정산 대기 {viewerPendingCount}건
                </small>
              </div>
            </FeedCard>
          ) : null}

          <FeedCard
            title="빠른 이동"
            footer={
              <div className="row">
                <Link className="text-link" href="/topics">← 토픽 목록</Link>
                {canManage ? <Link className="text-link" href={`/admin/topics/${topic.id}/resolve`}>관리자 Resolve</Link> : null}
                <Link className="text-link" href={`/api/topics/${topic.id}`}>Topic API</Link>
              </div>
            }
          />

          <div id="topic-comment-form">
            <FeedCard title="댓글 작성">
              <CommentForm topicId={topic.id} />
            </FeedCard>
          </div>

          <div id="topic-comments">
            <FeedCard title="최근 댓글">
              <div className="comment-list">
              {topic.comments.length === 0 ? <p style={{ margin: 0, color: "#6b7280" }}>아직 댓글이 없습니다.</p> : null}
              {topic.comments.map((comment) => (
                <article key={comment.id} className="comment-item">
                  <p style={{ margin: "0 0 0.4rem" }}>{comment.content}</p>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <small style={{ color: "#6b7280" }}>{new Date(comment.createdAt).toLocaleString("ko-KR")}</small>
                    {canReport ? <CommentReportButton commentId={comment.id} /> : null}
                  </div>
                </article>
              ))}
              </div>
            </FeedCard>
          </div>

          <a className="topic-floating-comment" href="#topic-comment-form">댓글 쓰기</a>
        </section>

        <aside className="widget-column">
          <WidgetCard title="요약 위젯">
            <ul className="simple-list muted">
              <li>YES {percent(yesVotes, totalVotes)}%</li>
              <li>NO {percent(noVotes, totalVotes)}%</li>
              <li>총 풀 {totalPool.toLocaleString("ko-KR")} pt</li>
            </ul>
          </WidgetCard>
          <WidgetCard title="참여 가이드">
            <ul className="simple-list muted">
              <li>댓글은 최신순으로 노출됩니다.</li>
              <li>토픽 상태가 OPEN일 때 참여를 권장합니다.</li>
              <li>최종 정산은 관리자 Resolve에서 진행됩니다.</li>
            </ul>
          </WidgetCard>
        </aside>
      </div>
    </PageContainer>
  );
}
