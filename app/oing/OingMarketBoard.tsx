"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { FeedCard } from "@/components/FeedCard";
import { Pill, StatePanel } from "@/components/ui";
import type { OingMarketsPayload } from "@/lib/oing-market";
import { getTopicThumbnail } from "@/lib/topic-thumbnail";

function statusTone(status: string): "neutral" | "success" | "danger" {
  if (status === "OPEN") return "success";
  if (status === "RESOLVED") return "danger";
  return "neutral";
}

export function OingMarketBoard({ initialData }: { initialData: OingMarketsPayload }) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/oing/markets", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { ok: boolean; data?: OingMarketsPayload };
        if (payload.ok && payload.data) {
          setData(payload.data);
        }
      } catch {
        // keep previous snapshot when polling fails
      }
    }, 10_000);

    return () => clearInterval(timer);
  }, []);

  if (data.topics.length === 0) {
    return (
      <StatePanel
        title="베팅 가능한 오잉 이슈가 아직 없습니다"
        description="지금은 10분~7일 조건에 맞는 OPEN 베팅 토픽이 없습니다. 조건에 맞는 토픽이 열리면 여기서 바로 참여할 수 있어요."
        tone="warning"
        actions={<Link href="/topics" className="btn btn-secondary">토픽 보러가기</Link>}
      />
    );
  }

  return (
    <section className="feed-section">
      <div className="section-header">
        <p className="section-kicker">Live Markets</p>
        <h2>오잉 마켓 보드</h2>
      </div>
      <div className="feed-list">
        {data.topics.map((topic) => (
          <FeedCard
            key={topic.id}
            thumbnailSrc={getTopicThumbnail(topic.id, topic.title)}
            thumbnailAlt={`${topic.title} 배너`}
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
  );
}
