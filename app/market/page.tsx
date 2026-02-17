import Link from "next/link";

import { OiBadge, PageContainer, StatePanel } from "@/components/ui";

export default function MarketPage() {
  return (
    <PageContainer>
      <section className="hero-block compact">
        <OiBadge label="POINT MARKET" />
        <p className="hero-eyebrow">Points Marketplace</p>
        <h1>포인트 마켓</h1>
        <p>베팅으로 모은 포인트로 제품을 구매하는 마켓플레이스입니다. 상품/장바구니/주문 플로우를 순차적으로 확장 중이에요.</p>
      </section>

      <StatePanel
        title="마켓플레이스 베타 준비중"
        description="곧 포인트 결제 상품 목록을 공개합니다. 우선 오잉에서 포인트를 쌓아두세요."
        tone="warning"
        actions={<Link href="/oing" className="btn btn-primary">오잉에서 포인트 쌓기</Link>}
      />
    </PageContainer>
  );
}
