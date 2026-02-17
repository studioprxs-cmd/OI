"use client";

import { useEffect, useMemo, useState } from "react";

type TopicLivePulseProps = {
  topicId: string;
  topicKind: "BETTING" | "POLL";
  topicStatus: string;
  initialYesVotes: number;
  initialNoVotes: number;
  initialYesPool: number;
  initialNoPool: number;
};

type PulseState = {
  yesVotes: number;
  noVotes: number;
  yesPool: number;
  noPool: number;
  updatedAt: number;
};

function toPercent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function TopicLivePulse({
  topicId,
  topicKind,
  topicStatus,
  initialYesVotes,
  initialNoVotes,
  initialYesPool,
  initialNoPool,
}: TopicLivePulseProps) {
  const [state, setState] = useState<PulseState>({
    yesVotes: initialYesVotes,
    noVotes: initialNoVotes,
    yesPool: initialYesPool,
    noPool: initialNoPool,
    updatedAt: Date.now(),
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchPulse = async () => {
      setIsRefreshing(true);
      try {
        const res = await fetch(`/api/topics/${topicId}`, { cache: "no-store" });
        const payload = await res.json();
        if (!mounted || !payload?.ok || !payload?.data) return;

        const votes = Array.isArray(payload.data.votes) ? payload.data.votes : [];
        const yesVotes = votes.filter((vote: { choice?: string }) => vote.choice === "YES").length;
        const noVotes = votes.filter((vote: { choice?: string }) => vote.choice === "NO").length;

        const yesPool = Number(payload.data.poolStats?.yesPool ?? 0);
        const noPool = Number(payload.data.poolStats?.noPool ?? 0);

        setState({
          yesVotes,
          noVotes,
          yesPool,
          noPool,
          updatedAt: Date.now(),
        });
      } finally {
        if (mounted) setIsRefreshing(false);
      }
    };

    const timer = setInterval(fetchPulse, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [topicId]);

  const totalVotes = state.yesVotes + state.noVotes;
  const totalPool = state.yesPool + state.noPool;

  const yesVotePercent = useMemo(() => toPercent(state.yesVotes, totalVotes), [state.yesVotes, totalVotes]);
  const noVotePercent = useMemo(() => toPercent(state.noVotes, totalVotes), [state.noVotes, totalVotes]);

  return (
    <div className="topic-live-pulse">
      <div className="topic-live-pulse-head">
        <p>Live pulse · 5s refresh</p>
        <span>{isRefreshing ? "업데이트 중…" : `${new Date(state.updatedAt).toLocaleTimeString("ko-KR")}`}</span>
      </div>

      <div className="topic-live-pulse-grid">
        <article>
          <strong>YES {yesVotePercent}%</strong>
          <small>{state.yesVotes.toLocaleString("ko-KR")}표</small>
        </article>
        <article>
          <strong>NO {noVotePercent}%</strong>
          <small>{state.noVotes.toLocaleString("ko-KR")}표</small>
        </article>
        {topicKind === "BETTING" ? (
          <article className="is-wide">
            <strong>베팅 풀 {totalPool.toLocaleString("ko-KR")} pt</strong>
            <small>YES {state.yesPool.toLocaleString("ko-KR")} · NO {state.noPool.toLocaleString("ko-KR")}</small>
          </article>
        ) : null}
      </div>

      {topicStatus === "OPEN" ? (
        <div className="topic-live-pulse-cta">
          {topicKind === "BETTING" ? <a href="#bet-ticket">지금 베팅하기</a> : null}
          <a href="#topic-comment-form">근거 남기기</a>
        </div>
      ) : null}
    </div>
  );
}
