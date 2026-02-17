"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button, Card, Field, Message, SelectField, TextAreaField } from "@/components/ui";

type Props = { topicId: string };

type ResultValue = "YES" | "NO";
type SettlementPreviewSummary = {
  totalPool: number;
  winnerPool: number;
  settledCount: number;
  winnerCount: number;
  payoutTotal: number;
};

type PreviewResponse = {
  topic?: {
    id: string;
    status: string;
    resolution: { id: string; result: ResultValue; resolvedAt: string } | null;
  };
  unsettledBetCount?: number;
  preview?: {
    YES: SettlementPreviewSummary;
    NO: SettlementPreviewSummary;
  };
  resolvedSettlement?: {
    totalBets: number;
    payoutTotal: number;
    winnerCount: number;
    winnerPool: number;
    totalPool: number;
    topPayouts: Array<{
      betId: string;
      userId: string;
      userLabel: string;
      payoutAmount: number;
      amount: number;
      choice: ResultValue;
    }>;
  } | null;
};

const resultOptions = [
  { value: "YES", label: "YES" },
  { value: "NO", label: "NO" },
] as const;

function payoutMultiplier(summary?: SettlementPreviewSummary) {
  if (!summary) return 0;
  if (summary.winnerPool <= 0) return 0;
  return summary.totalPool / summary.winnerPool;
}

export function ResolveForm({ topicId }: Props) {
  const [result, setResult] = useState<ResultValue>("YES");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmNoWinner, setConfirmNoWinner] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

  const selectedPreview = useMemo(() => previewData?.preview?.[result], [previewData, result]);
  const alreadyResolved = Boolean(previewData?.topic?.resolution);
  const topicStatus = previewData?.topic?.status ?? "";
  const resolvedSettlement = previewData?.resolvedSettlement ?? null;
  const isBlockedStatus = topicStatus === "CANCELED" || topicStatus === "DRAFT";
  const requiresNoWinnerConfirm = Number(selectedPreview?.winnerPool ?? 0) === 0 && Number(previewData?.unsettledBetCount ?? 0) > 0;

  useEffect(() => {
    if (!requiresNoWinnerConfirm) {
      setConfirmNoWinner(false);
    }
  }, [requiresNoWinnerConfirm, result]);

  useEffect(() => {
    let isAlive = true;

    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError("");
      try {
        const res = await fetch(`/api/topics/${topicId}/resolve`, { cache: "no-store" });
        const data = (await res.json()) as { ok: boolean; data: PreviewResponse | null; error?: string };

        if (!res.ok || !data.ok || !data.data) {
          if (!isAlive) return;
          setPreviewError(data.error ?? "정산 미리보기를 가져오지 못했습니다.");
          return;
        }

        if (!isAlive) return;
        setPreviewData(data.data);
      } catch {
        if (!isAlive) return;
        setPreviewError("정산 미리보기를 가져오는 중 네트워크 오류가 발생했습니다.");
      } finally {
        if (isAlive) setPreviewLoading(false);
      }
    }

    loadPreview();

    return () => {
      isAlive = false;
    };
  }, [topicId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (alreadyResolved) {
      setMessage("이미 해결 처리된 토픽입니다.");
      return;
    }

    if (isBlockedStatus) {
      setMessage(topicStatus === "CANCELED" ? "취소된 토픽은 정산할 수 없습니다." : "초안 토픽은 정산할 수 없습니다.");
      return;
    }

    if (!summary.trim()) {
      setMessage("summary는 필수입니다.");
      return;
    }

    if (requiresNoWinnerConfirm && !confirmNoWinner) {
      setMessage("승리 베팅이 없는 정산(0pt 지급)을 진행하려면 확인 체크가 필요합니다.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/topics/${topicId}/resolve`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ result, summary, confirmNoWinner }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        data?: { settlement?: { settledCount?: number; payoutTotal?: number } };
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "정산 처리 실패");
        return;
      }

      const settledCount = Number(data?.data?.settlement?.settledCount ?? 0);
      const payoutTotal = Number(data?.data?.settlement?.payoutTotal ?? 0);
      setMessage(`정산(해결) 정보가 저장되었습니다. 정산 베팅 ${settledCount}건 · 총 지급 ${payoutTotal.toLocaleString("ko-KR")}pt`);
      setSummary("");
      setTimeout(() => window.location.reload(), 450);
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="list" onSubmit={onSubmit}>
      <Card>
        <strong style={{ display: "block", marginBottom: "0.45rem" }}>정산 미리보기</strong>
        {previewLoading ? <p style={{ margin: 0, color: "#6b7280" }}>불러오는 중...</p> : null}
        {previewError ? <Message text={previewError} tone="error" /> : null}
        {!previewLoading && !previewError && previewData?.preview ? (
          <div className="list" style={{ gap: "0.65rem" }}>
            <small style={{ color: "#6b7280" }}>
              토픽 상태 {topicStatus || "UNKNOWN"} · 미정산 베팅 {previewData.unsettledBetCount ?? 0}건
            </small>
            <div className="row" style={{ gap: "0.7rem", flexWrap: "wrap" }}>
              {(Object.entries(previewData.preview) as Array<[ResultValue, SettlementPreviewSummary]>).map(([side, item]) => {
                const isSelected = side === result;
                const multiplier = payoutMultiplier(item);

                return (
                  <div
                    key={side}
                    style={{
                      flex: "1 1 220px",
                      border: isSelected ? "1px solid #2563eb" : "1px solid rgba(15, 23, 42, 0.08)",
                      borderRadius: "0.85rem",
                      boxShadow: isSelected ? "0 0 0 1px rgba(37, 99, 235, 0.15)" : undefined,
                    }}
                  >
                    <Card>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{side} 승리 시</strong>
                        <small style={{ color: isSelected ? "#2563eb" : "#6b7280" }}>{isSelected ? "선택됨" : ""}</small>
                      </div>
                      <ul className="simple-list muted" style={{ marginTop: "0.5rem" }}>
                        <li>총 풀 {item.totalPool.toLocaleString("ko-KR")}pt</li>
                        <li>승리 풀 {item.winnerPool.toLocaleString("ko-KR")}pt</li>
                        <li>승자 {item.winnerCount}명</li>
                        <li>예상 총지급 {item.payoutTotal.toLocaleString("ko-KR")}pt</li>
                        <li>배당 배율 {multiplier > 0 ? `${multiplier.toFixed(2)}x` : "0x"}</li>
                      </ul>
                    </Card>
                  </div>
                );
              })}
            </div>
            {alreadyResolved && resolvedSettlement ? (
              <div className="resolved-settlement-card">
                <strong style={{ display: "block" }}>확정 정산 결과</strong>
                <ul className="simple-list muted" style={{ marginTop: "0.45rem" }}>
                  <li>총 베팅 {resolvedSettlement.totalBets}건</li>
                  <li>총 풀 {resolvedSettlement.totalPool.toLocaleString("ko-KR")}pt</li>
                  <li>승리 풀 {resolvedSettlement.winnerPool.toLocaleString("ko-KR")}pt</li>
                  <li>승자 {resolvedSettlement.winnerCount}명</li>
                  <li>총 지급 {resolvedSettlement.payoutTotal.toLocaleString("ko-KR")}pt</li>
                </ul>
                {resolvedSettlement.topPayouts.length > 0 ? (
                  <div style={{ marginTop: "0.55rem" }}>
                    <small style={{ color: "#6b7280" }}>상위 지급 내역</small>
                    <ul className="simple-list" style={{ marginTop: "0.35rem" }}>
                      {resolvedSettlement.topPayouts.map((item) => (
                        <li key={item.betId}>
                          {item.userLabel} · {item.payoutAmount.toLocaleString("ko-KR")}pt
                          <small style={{ color: "#6b7280" }}> (베팅 {item.amount.toLocaleString("ko-KR")}pt, {item.choice})</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            {isBlockedStatus ? (
              <Message
                text={topicStatus === "CANCELED" ? "CANCELED 토픽은 정산할 수 없습니다." : "DRAFT 토픽은 정산할 수 없습니다."}
                tone="error"
              />
            ) : null}
            {selectedPreview?.winnerPool === 0 ? (
              <Message text="선택한 결과에 승리 베팅이 없어 지급금이 0pt로 처리됩니다. 결과를 다시 확인하세요." tone="error" />
            ) : null}
            {requiresNoWinnerConfirm ? (
              <label className="resolve-confirm-check">
                <input
                  type="checkbox"
                  checked={confirmNoWinner}
                  onChange={(event) => setConfirmNoWinner(event.target.checked)}
                />
                <span>승리 베팅 없음(총 지급 0pt) 상태를 확인했고 이 결과로 정산 진행에 동의합니다.</span>
              </label>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Field label="결과" htmlFor="result">
        <SelectField id="result" name="result" value={result} onChange={(value) => setResult(value as ResultValue)} options={[...resultOptions]} />
      </Field>
      <Field label="요약" htmlFor="summary">
        <TextAreaField
          id="summary"
          name="summary"
          value={summary}
          onChange={setSummary}
          required
          rows={5}
          placeholder="정산 근거/요약"
        />
      </Field>
      <Button type="submit" disabled={isLoading || alreadyResolved || isBlockedStatus || (requiresNoWinnerConfirm && !confirmNoWinner)}>
        {isLoading ? "저장 중..." : alreadyResolved ? "이미 해결됨" : isBlockedStatus ? "정산 불가 상태" : "결과 확정"}
      </Button>
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </form>
  );
}
