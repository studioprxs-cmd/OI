"use client";

import { useMemo, useState } from "react";

import type { MarketProduct } from "@/lib/market/catalog";

type Props = {
  products: MarketProduct[];
};

type PurchaseState = {
  loading: boolean;
  message: string | null;
  tone: "neutral" | "success" | "danger";
};

const ZONE_ORDER: MarketProduct["zone"][] = ["GOODS", "DIGITAL", "DEAL", "GIFT"];

const ZONE_LABEL: Record<MarketProduct["zone"], string> = {
  GOODS: "굿즈",
  DIGITAL: "디지털",
  DEAL: "핫딜",
  GIFT: "기프트",
};

const ZONE_SUBTITLE: Record<MarketProduct["zone"], string> = {
  GOODS: "현실에서 들고 다니는 OI",
  DIGITAL: "프로필을 꾸미는 디지털 아이템",
  DEAL: "시간 한정 참여 딜",
  GIFT: "교환권/선물 전환 존",
};

export function MarketCatalogClient({ products }: Props) {
  const [activeZone, setActiveZone] = useState<MarketProduct["zone"]>("GOODS");
  const [quantityByProduct, setQuantityByProduct] = useState<Record<string, number>>({});
  const [purchaseState, setPurchaseState] = useState<Record<string, PurchaseState>>({});
  const [purchaseModalTarget, setPurchaseModalTarget] = useState<MarketProduct | null>(null);

  const grouped = useMemo(() => {
    return ZONE_ORDER.map((zone) => ({ zone, items: products.filter((product) => product.zone === zone) }));
  }, [products]);

  const activeItems = grouped.find((zone) => zone.zone === activeZone)?.items ?? [];

  async function handlePurchase(product: MarketProduct) {
    const quantity = quantityByProduct[product.id] ?? 1;

    setPurchaseState((prev) => ({
      ...prev,
      [product.id]: { loading: true, message: null, tone: "neutral" },
    }));

    try {
      const res = await fetch("/api/market/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity }),
      });
      const payload = await res.json();

      if (!res.ok || !payload?.ok) {
        const errorMessage = typeof payload?.error === "string" ? payload.error : "구매에 실패했습니다";
        setPurchaseState((prev) => ({
          ...prev,
          [product.id]: { loading: false, message: errorMessage, tone: "danger" },
        }));
        return;
      }

      const balanceText = typeof payload?.data?.balanceAfter === "number"
        ? ` · 잔액 ${Number(payload.data.balanceAfter).toLocaleString("ko-KR")}pt`
        : "";

      setPurchaseState((prev) => ({
        ...prev,
        [product.id]: {
          loading: false,
          message: `${product.name} ${quantity}개 구매 완료${balanceText}`,
          tone: "success",
        },
      }));
      setPurchaseModalTarget(null);
    } catch {
      setPurchaseState((prev) => ({
        ...prev,
        [product.id]: { loading: false, message: "네트워크 오류가 발생했습니다", tone: "danger" },
      }));
    }
  }

  return (
    <div className="market-zone-stack">
      <section className="market-zone-tabs" aria-label="마켓 존 선택">
        {ZONE_ORDER.map((zone) => {
          const count = grouped.find((item) => item.zone === zone)?.items.length ?? 0;
          const active = activeZone === zone;
          return (
            <button
              key={zone}
              type="button"
              className={`market-zone-tab${active ? " is-active" : ""}`}
              onClick={() => setActiveZone(zone)}
            >
              <strong>{ZONE_LABEL[zone]}</strong>
              <span>{count}개</span>
            </button>
          );
        })}
      </section>

      <section className="market-zone-section" aria-label={`${activeZone} 상품 목록`}>
        <div className="section-header market-zone-header">
          <p className="section-kicker">{activeZone}</p>
          <h2>{ZONE_LABEL[activeZone]} Zone</h2>
          <p>{ZONE_SUBTITLE[activeZone]}</p>
        </div>

        {activeItems.length === 0 ? (
          <article className="feed-card">
            <p>현재 노출 가능한 상품이 없습니다.</p>
          </article>
        ) : (
          <div className="home-spotlight-grid" role="list">
            {activeItems.map((product) => {
              const quantity = quantityByProduct[product.id] ?? 1;
              const total = product.pricePoints * quantity;
              const state = purchaseState[product.id] ?? { loading: false, message: null, tone: "neutral" as const };

              return (
                <article key={product.id} className="home-spotlight-card market-product-card" role="listitem">
                  <div className="home-spotlight-media">
                    <img src={product.imageUrl} alt={`${product.name} 상품 이미지`} loading="lazy" />
                    <span className="home-spotlight-rank">{ZONE_LABEL[product.zone]}</span>
                  </div>
                  <div className="home-spotlight-body">
                    <strong>{product.name}</strong>
                    <p>{product.description}</p>
                    <div className="home-spotlight-metrics">
                      <span>{product.pricePoints.toLocaleString("ko-KR")}pt</span>
                      <span>{product.stock === null ? "재고 무제한" : `재고 ${product.stock}`}</span>
                    </div>

                    <label className="field" htmlFor={`qty-${product.id}`}>
                      수량
                      <select
                        id={`qty-${product.id}`}
                        value={quantity}
                        onChange={(event) => setQuantityByProduct((prev) => ({
                          ...prev,
                          [product.id]: Number(event.target.value),
                        }))}
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={`${product.id}-qty-${value}`} value={value}>{value}</option>
                        ))}
                      </select>
                    </label>

                    <div className="home-pulse-stats">
                      <span>총 결제 {total.toLocaleString("ko-KR")}pt</span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary home-spotlight-cta"
                      onClick={() => setPurchaseModalTarget(product)}
                      disabled={state.loading}
                    >
                      {state.loading ? "구매 처리 중..." : (product.ctaLabel ?? "바로 구매")}
                    </button>

                    {state.message ? (
                      <p className={state.tone === "danger" ? "inline-error" : "inline-success"}>{state.message}</p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {purchaseModalTarget ? (
        <div className="market-purchase-modal-backdrop" role="presentation" onClick={() => setPurchaseModalTarget(null)}>
          <section
            className="market-purchase-modal"
            role="dialog"
            aria-modal="true"
            aria-label="상품 구매 확인"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="section-kicker">구매 확인</p>
            <h3>{purchaseModalTarget.name}</h3>
            <p>
              수량 {(quantityByProduct[purchaseModalTarget.id] ?? 1)}개 · 총
              {" "}
              {(purchaseModalTarget.pricePoints * (quantityByProduct[purchaseModalTarget.id] ?? 1)).toLocaleString("ko-KR")}pt
            </p>
            <div className="market-purchase-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPurchaseModalTarget(null)}>
                취소
              </button>
              <button type="button" className="btn btn-primary" onClick={() => handlePurchase(purchaseModalTarget)}>
                구매 확정
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
