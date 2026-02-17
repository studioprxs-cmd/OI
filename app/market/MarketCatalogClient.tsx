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

export function MarketCatalogClient({ products }: Props) {
  const [quantityByProduct, setQuantityByProduct] = useState<Record<string, number>>({});
  const [purchaseState, setPurchaseState] = useState<Record<string, PurchaseState>>({});

  const grouped = useMemo(() => {
    const zoneOrder: MarketProduct["zone"][] = ["GOODS", "DIGITAL", "DEAL", "GIFT"];
    return zoneOrder.map((zone) => ({ zone, items: products.filter((product) => product.zone === zone) }));
  }, [products]);

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
    } catch {
      setPurchaseState((prev) => ({
        ...prev,
        [product.id]: { loading: false, message: "네트워크 오류가 발생했습니다", tone: "danger" },
      }));
    }
  }

  return (
    <div className="market-zone-stack">
      {grouped.map(({ zone, items }) => (
        <section key={zone} className="market-zone-section" aria-label={`${zone} 상품 목록`}>
          <div className="section-header">
            <p className="section-kicker">{zone}</p>
            <h2>{zone} Marketplace</h2>
          </div>

          {items.length === 0 ? (
            <article className="feed-card">
              <p>현재 노출 가능한 상품이 없습니다.</p>
            </article>
          ) : (
            <div className="home-spotlight-grid" role="list">
              {items.map((product) => {
                const quantity = quantityByProduct[product.id] ?? 1;
                const total = product.pricePoints * quantity;
                const state = purchaseState[product.id] ?? { loading: false, message: null, tone: "neutral" as const };

                return (
                  <article key={product.id} className="home-spotlight-card" role="listitem">
                    <div className="home-spotlight-media">
                      <img src={product.imageUrl} alt={`${product.name} 상품 이미지`} loading="lazy" />
                      <span className="home-spotlight-rank">{product.zone}</span>
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
                        onClick={() => handlePurchase(product)}
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
      ))}
    </div>
  );
}
