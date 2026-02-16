import { Choice } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentForm } from "./CommentForm";

import { FeedCard } from "@/components/FeedCard";
import { WidgetCard } from "@/components/WidgetCard";
import { PageContainer, Pill } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findMockTopic } from "@/lib/mock-data";

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

  const dbTopic = canUseDb ? await db.topic
    .findUnique({
      where: { id },
      include: {
        votes: { select: { choice: true } },
        bets: { select: { choice: true, amount: true } },
        comments: {
          where: { isHidden: false },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
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
            <p className="hero-eyebrow">Topic Detail</p>
            <h1>{topic.title}</h1>
            <p>{topic.description}</p>
            <div className="row" style={{ marginTop: "0.6rem" }}>
              <Pill tone={statusTone(topic.status)}>{topic.status}</Pill>
              <span className="muted-inline">투표 {topic.counts.votes} · 베팅 {topic.counts.bets} · 댓글 {topic.counts.comments}</span>
            </div>
          </section>

          <section className="stats-grid">
            <FeedCard title="YES Votes" meta={`${yesVotes} (${percent(yesVotes, totalVotes)}%)`}>
              <div className="meter"><span style={{ width: `${percent(yesVotes, totalVotes)}%` }} /></div>
            </FeedCard>
            <FeedCard title="NO Votes" meta={`${noVotes} (${percent(noVotes, totalVotes)}%)`}>
              <div className="meter"><span style={{ width: `${percent(noVotes, totalVotes)}%` }} /></div>
            </FeedCard>
            <FeedCard title="Total Pool" meta={`${totalPool.toLocaleString("ko-KR")} pt`}>
              <p className="feed-card-meta" style={{ marginTop: 0 }}>YES {yesPool.toLocaleString("ko-KR")} · NO {noPool.toLocaleString("ko-KR")}</p>
            </FeedCard>
          </section>

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

          <FeedCard title="댓글 작성">
            <CommentForm topicId={topic.id} />
          </FeedCard>

          <FeedCard title="최근 댓글">
            <div className="comment-list">
              {topic.comments.length === 0 ? <p style={{ margin: 0, color: "#6b7280" }}>아직 댓글이 없습니다.</p> : null}
              {topic.comments.map((comment) => (
                <article key={comment.id} className="comment-item">
                  <p style={{ margin: "0 0 0.4rem" }}>{comment.content}</p>
                  <small style={{ color: "#6b7280" }}>{new Date(comment.createdAt).toLocaleString("ko-KR")}</small>
                </article>
              ))}
            </div>
          </FeedCard>
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
