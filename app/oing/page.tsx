import Link from "next/link";

import { WidgetCard } from "@/components/WidgetCard";
import { OiBadge, PageContainer, Pill } from "@/components/ui";
import { getOingMarkets } from "@/lib/oing-market";

import { OingMarketBoard } from "./OingMarketBoard";

export default async function OingPage() {
  const marketData = await getOingMarkets();

  return (
    <PageContainer>
      <div className="content-grid oing-layout">
        <main className="main-column">
          <section className="hero-block compact">
            <OiBadge label="OING" />
            <p className="hero-eyebrow">Polymarket-style Betting</p>
            <h1>오잉 베팅</h1>
            <p>핫한 이슈에 YES/NO로 베팅하고 포인트를 쌓아보세요. 오잉은 <strong>최소 10분 ~ 최대 7일</strong> 안에 결과가 나는 명확한 주제만 다룹니다.</p>
            <div className="row" style={{ marginTop: "0.6rem" }}>
              <Pill tone="success">진행중 {marketData.openCount}</Pill>
              <Pill tone="neutral">만기 10분~7일</Pill>
              <Pill tone="neutral">총 베팅풀 {marketData.totalPool.toLocaleString("ko-KR")} pt</Pill>
              <Link href="/topics?kind=BETTING" className="text-link">전체 베팅 토픽</Link>
            </div>
          </section>

          <OingMarketBoard initialData={marketData} />
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
