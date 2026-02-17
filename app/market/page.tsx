import Image from "next/image";
import Link from "next/link";

import { MARKET_ZONES, getMarketProducts } from "@/lib/market/catalog";
import { OiBadge, PageContainer, StatePanel } from "@/components/ui";

const ZONE_ORDER = ["GOODS", "DIGITAL", "DEAL", "GIFT"] as const;

export default function MarketPage() {
  const products = getMarketProducts({ activeOnly: true });

  return (
    <PageContainer>
      <div className="market-layout">
        <section className="hero-block compact market-hero">
          <OiBadge label="POINT MARKET" />
          <p className="hero-eyebrow">Points Marketplace</p>
          <h1>포인트 마켓</h1>
          <p>오잉에서 쌓은 포인트를 굿즈·디지털·핫딜로 바로 교환하세요. 모바일에서 빠르게 고르고 바로 참여하도록 MVP 동선을 정리했습니다.</p>
        </section>

        <section className="market-shelf-grid" aria-label="마켓 구역 미리보기">
          {ZONE_ORDER.map((zone) => {
            const shelfProducts = products.filter((product) => product.zone === zone).slice(0, 1);

            return (
              <article className="market-shelf-card" key={zone}>
                <h3>{MARKET_ZONES[zone]}</h3>
                {shelfProducts.length === 0 ? (
                  <p>공개 준비 중인 구역입니다.</p>
                ) : (
                  shelfProducts.map((product) => (
                    <div key={product.id} className="market-product-teaser">
                      <div className="market-product-teaser-image-wrap">
                        <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="market-product-teaser-image" />
                      </div>
                      <strong>{product.name}</strong>
                      <p>{product.description}</p>
                      <small>{product.pricePoints.toLocaleString("ko-KR")}pt</small>
                    </div>
                  ))
                )}
              </article>
            );
          })}
        </section>

        <StatePanel
          title="마켓플레이스 베타 카탈로그 공개"
          description="상품 목록 API(`/api/market/products`)와 모바일 카드 레이아웃을 먼저 열었습니다. 다음 단계에서 구매 트랜잭션/재고 차감을 연결합니다."
          tone="success"
          actions={<Link href="/oing" className="btn btn-primary">오잉에서 포인트 쌓기</Link>}
        />
      </div>
    </PageContainer>
  );
}
