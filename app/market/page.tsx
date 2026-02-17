import Link from "next/link";

import { OiBadge, PageContainer, StatePanel } from "@/components/ui";
import { getMarketProducts } from "@/lib/market/catalog";

import { MarketCatalogClient } from "./MarketCatalogClient";

export default function MarketPage() {
  const products = getMarketProducts({ activeOnly: true });

  return (
    <PageContainer>
      <div className="market-layout">
        <section className="hero-block compact market-hero">
          <OiBadge label="POINT MARKET" />
          <p className="hero-eyebrow">Points Marketplace</p>
          <h1>포인트 마켓</h1>
          <p>오잉에서 쌓은 포인트를 굿즈·디지털·핫딜로 바로 교환하세요. 이미지 중심 카드에서 수량 선택 → 즉시 구매까지 한 번에 이어지도록 MVP 구매 플로우를 연결했습니다.</p>
        </section>

        <MarketCatalogClient products={products} />

        <StatePanel
          title="마켓 MVP 구매 플로우 오픈"
          description="상품 목록 API(`/api/market/products`)와 주문 API(`/api/market/orders`)를 연결해 포인트 차감형 구매를 바로 실행할 수 있습니다."
          tone="success"
          actions={<Link href="/oing" className="btn btn-primary">오잉에서 포인트 쌓기</Link>}
        />
      </div>
    </PageContainer>
  );
}
