import Link from "next/link";

import { OiBadge, PageContainer, StatePanel } from "@/components/ui";

export default function MarketPage() {
  return (
    <PageContainer>
      <div className="market-layout">
        <section className="hero-block compact market-hero">
          <OiBadge label="POINT MARKET" />
          <p className="hero-eyebrow">Points Marketplace</p>
          <h1>포인트 마켓</h1>
          <p>베팅으로 모은 포인트로 제품을 구매하는 마켓플레이스입니다. 상품/장바구니/주문 플로우를 순차적으로 확장 중이에요.</p>
        </section>

        <section className="market-shelf-grid" aria-label="마켓 구역 미리보기">
          <article className="market-shelf-card">
            <h3>굿즈 존</h3>
            <p>오이 한정 굿즈, 시즌 콜라보, 응원 상품</p>
          </article>
          <article className="market-shelf-card">
            <h3>디지털 존</h3>
            <p>이모지 팩, 배지, 프로필 꾸미기 아이템</p>
          </article>
          <article className="market-shelf-card">
            <h3>핫딜 존</h3>
            <p>시간 한정 포인트 특가 · 빠른 품절 주의</p>
          </article>
        </section>

        <StatePanel
          title="마켓플레이스 베타 준비중"
          description="곧 포인트 결제 상품 목록을 공개합니다. 우선 오잉에서 포인트를 쌓아두세요."
          tone="warning"
          actions={<Link href="/oing" className="btn btn-primary">오잉에서 포인트 쌓기</Link>}
        />
      </div>
    </PageContainer>
  );
}
