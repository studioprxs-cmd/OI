"use client";

import { useState } from "react";

type MarketZone = "GOODS" | "DIGITAL" | "DEAL" | "GIFT";

type MarketProduct = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  zone: MarketZone;
  pricePoints: number;
  stock: number | null;
  isActive: boolean;
};

const MARKET_ZONE_LABELS: Record<MarketZone, string> = {
  GOODS: "굿즈 존",
  DIGITAL: "디지털 존",
  DEAL: "핫딜 존",
  GIFT: "기프트 존",
};

type Props = {
  products: MarketProduct[];
};

export function AdminMarketCatalogActions({ products }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [stockDraft, setStockDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function patchProduct(productId: string, payload: Record<string, unknown>) {
    setPendingId(productId);
    setError(null);

    const response = await fetch("/api/market/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, ...payload }),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) {
      setError(json?.error ?? "카탈로그 업데이트에 실패했습니다.");
      setPendingId(null);
      return;
    }

    window.location.reload();
  }

  return (
    <>
      {error ? <p style={{ color: "#b91c1c", marginTop: "0.4rem" }}>{error}</p> : null}
      <div className="admin-market-list" style={{ marginTop: "0.7rem" }}>
        {products.map((product) => {
          const stockValue = stockDraft[product.id] ?? (product.stock === null ? "" : String(product.stock));
          const busy = pendingId === product.id;

          return (
            <article key={product.id} className="admin-market-item">
              <img src={product.imageUrl} alt="" />
              <div>
                <p className="admin-market-zone">{MARKET_ZONE_LABELS[product.zone]}</p>
                <strong>{product.name}</strong>
                <p>{product.description}</p>
                <small>
                  {product.pricePoints.toLocaleString("ko-KR")}pt · 재고 {product.stock === null ? "무제한" : product.stock.toLocaleString("ko-KR")} · {product.isActive ? "판매중" : "비활성"}
                </small>

                <div className="row" style={{ gap: "0.5rem", marginTop: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`btn ${product.isActive ? "btn-ghost" : "btn-primary"}`}
                    disabled={busy}
                    onClick={() => patchProduct(product.id, { isActive: !product.isActive })}
                  >
                    {busy ? "처리 중..." : product.isActive ? "비활성" : "판매 시작"}
                  </button>

                  <input
                    type="number"
                    min={0}
                    placeholder="재고"
                    value={stockValue}
                    onChange={(event) => setStockDraft((prev) => ({ ...prev, [product.id]: event.target.value }))}
                    style={{ maxWidth: "8rem" }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => patchProduct(product.id, { stock: stockValue.trim() ? Number(stockValue) : null })}
                  >
                    재고 저장
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
