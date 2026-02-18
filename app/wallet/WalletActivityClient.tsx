"use client";

import { useEffect, useMemo, useState } from "react";

type WalletTx = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

type WalletApiData = {
  items: WalletTx[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

const TX_TYPE_FILTERS = [
  { value: "", label: "전체" },
  { value: "VOTE_REWARD", label: "투표 보상" },
  { value: "COMMENT_REWARD", label: "댓글 보상" },
  { value: "COMMENT_LIKE_REWARD", label: "댓글 추천 보상" },
  { value: "BET_PLACE", label: "베팅 사용" },
  { value: "BET_SETTLE", label: "정산 수익" },
  { value: "BET_REFUND", label: "베팅 환불" },
  { value: "MARKET_PURCHASE", label: "마켓 구매" },
  { value: "DAILY_CHECKIN", label: "출석 보상" },
  { value: "SIGNUP_BONUS", label: "가입 보너스" },
] as const;

function getTypeLabel(type: string) {
  const found = TX_TYPE_FILTERS.find((item) => item.value === type);
  if (found) return found.label;
  return type;
}

export function WalletActivityClient() {
  const [activeType, setActiveType] = useState<string>("");
  const [items, setItems] = useState<WalletTx[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (activeType) params.set("type", activeType);

        const res = await fetch(`/api/users/me/transactions?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || !json?.ok || !json?.data) {
          if (!aborted) setError(json?.error ?? "원장 데이터를 불러오지 못했습니다.");
          return;
        }

        const data = json.data as WalletApiData;
        if (aborted) return;

        setHasMore(Boolean(data.hasMore));
        setItems((prev) => (page === 1 ? data.items : [...prev, ...data.items]));
      } catch {
        if (!aborted) setError("원장 데이터를 불러오지 못했습니다.");
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    load();

    return () => {
      aborted = true;
    };
  }, [activeType, page]);

  useEffect(() => {
    setPage(1);
  }, [activeType]);

  const summary = useMemo(() => {
    return items.reduce(
      (acc, tx) => {
        if (tx.amount > 0) acc.earned += tx.amount;
        if (tx.amount < 0) acc.spent += Math.abs(tx.amount);
        return acc;
      },
      { earned: 0, spent: 0 },
    );
  }, [items]);

  return (
    <section className="wallet-card-stack">
      <div className="wallet-summary-grid">
        <article className="wallet-summary-card is-earn">
          <p>최근 수익</p>
          <strong>+{summary.earned.toLocaleString("ko-KR")} pt</strong>
        </article>
        <article className="wallet-summary-card is-spend">
          <p>최근 사용</p>
          <strong>-{summary.spent.toLocaleString("ko-KR")} pt</strong>
        </article>
      </div>

      <div className="wallet-filter-row" role="tablist" aria-label="거래 유형 필터">
        {TX_TYPE_FILTERS.map((filter) => {
          const isActive = activeType === filter.value;
          return (
            <button
              key={filter.value || "ALL"}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`wallet-filter-chip ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveType(filter.value)}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {error ? <p className="wallet-empty-state">{error}</p> : null}

      <ul className="wallet-tx-list" aria-live="polite">
        {!loading && items.length === 0 ? (
          <li className="wallet-empty-state">표시할 원장 내역이 없습니다.</li>
        ) : null}

        {items.map((tx) => {
          const amountPrefix = tx.amount > 0 ? "+" : "-";
          const amountClassName = tx.amount > 0 ? "is-positive" : "is-negative";

          return (
            <li key={tx.id} className="wallet-tx-item">
              <div>
                <p className="wallet-tx-type">{getTypeLabel(tx.type)}</p>
                <small>{new Date(tx.createdAt).toLocaleString("ko-KR")}</small>
                {tx.note ? <p className="wallet-tx-note">{tx.note}</p> : null}
              </div>
              <div className="wallet-tx-amount-wrap">
                <strong className={`wallet-tx-amount ${amountClassName}`}>
                  {amountPrefix}{Math.abs(tx.amount).toLocaleString("ko-KR")}pt
                </strong>
                <small>잔액 {tx.balanceAfter.toLocaleString("ko-KR")}pt</small>
              </div>
            </li>
          );
        })}
      </ul>

      {loading ? <p className="wallet-empty-state">지갑 내역을 불러오는 중...</p> : null}

      {!loading && hasMore ? (
        <button type="button" className="btn btn-ghost wallet-more-btn" onClick={() => setPage((prev) => prev + 1)}>
          더 보기
        </button>
      ) : null}
    </section>
  );
}
