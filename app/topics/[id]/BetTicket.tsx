"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Message } from "@/components/ui";
import { calcEstimatedPayout, calcPrices } from "@/lib/betting/price";

type Choice = "YES" | "NO";

type Props = {
  topicId: string;
  yesPool: number;
  noPool: number;
  canBet: boolean;
  isAuthenticated: boolean;
  blockReason?: string;
};

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

export function BetTicket({ topicId, yesPool, noPool, canBet, isAuthenticated, blockReason }: Props) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>("YES");
  const [amount, setAmount] = useState("500");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { yesCents, noCents } = calcPrices(yesPool, noPool);

  const parsedAmount = Number(amount);
  const safeAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? Math.floor(parsedAmount) : 0;

  const estimatedPayout = useMemo(
    () => calcEstimatedPayout(safeAmount, choice, yesPool, noPool),
    [choice, noPool, safeAmount, yesPool],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAuthenticated) {
      setMessage("로그인 후 베팅할 수 있습니다.");
      return;
    }
    if (!canBet) {
      setMessage(blockReason ?? "지금은 베팅할 수 없습니다.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/topics/${topicId}/bets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice, amount: safeAmount }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error ?? "베팅에 실패했습니다.");
        return;
      }

      setMessage("베팅이 접수되었습니다.");
      router.refresh();
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="bet-ticket" onSubmit={onSubmit}>
      <div className="bet-choice-row" role="tablist" aria-label="베팅 선택">
        <button type="button" className={`bet-choice ${choice === "YES" ? "is-active yes" : ""}`} onClick={() => setChoice("YES")}>
          YES <small>{yesCents}¢</small>
        </button>
        <button type="button" className={`bet-choice ${choice === "NO" ? "is-active no" : ""}`} onClick={() => setChoice("NO")}>
          NO <small>{noCents}¢</small>
        </button>
      </div>

      <label className="field" htmlFor="bet-amount">
        <span className="label">베팅 금액 (pt)</span>
        <input
          id="bet-amount"
          className="input"
          inputMode="numeric"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="금액 입력"
          required
        />
      </label>

      <div className="bet-quick-row">
        {QUICK_AMOUNTS.map((value) => (
          <button key={value} type="button" className="bet-quick-btn" onClick={() => setAmount(String(value))}>
            +{value}
          </button>
        ))}
      </div>

      <div className="bet-preview">
        <p>예상 수령액 (현재 기준): <strong>{estimatedPayout.toLocaleString("ko-KR")} pt</strong></p>
        <small>실제 정산은 이후 전체 풀 변동에 따라 달라질 수 있어요.</small>
      </div>

      <Button type="submit" disabled={isLoading || !safeAmount || !isAuthenticated || !canBet}>
        {isLoading ? "베팅 처리 중..." : `${choice} 매수하기`}
      </Button>

      {!canBet && blockReason ? <Message text={blockReason} tone="error" /> : null}
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </form>
  );
}
