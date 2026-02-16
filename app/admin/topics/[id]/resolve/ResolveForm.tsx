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
};

const resultOptions = [
  { value: "YES", label: "YES" },
  { value: "NO", label: "NO" },
] as const;

export function ResolveForm({ topicId }: Props) {
  const [result, setResult] = useState<ResultValue>("YES");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

  const selectedPreview = useMemo(() => previewData?.preview?.[result], [previewData, result]);
  const alreadyResolved = Boolean(previewData?.topic?.resolution);

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

    if (!summary.trim()) {
      setMessage("summary는 필수입니다.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/topics/${topicId}/resolve`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ result, summary }),
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
        {!previewLoading && !previewError && selectedPreview ? (
          <div className="row" style={{ gap: "0.85rem", flexWrap: "wrap" }}>
            <small style={{ color: "#6b7280" }}>미정산 베팅 {previewData?.unsettledBetCount ?? 0}건</small>
            <small style={{ color: "#6b7280" }}>총 풀 {selectedPreview.totalPool.toLocaleString("ko-KR")}pt</small>
            <small style={{ color: "#6b7280" }}>승리 풀 {selectedPreview.winnerPool.toLocaleString("ko-KR")}pt</small>
            <small style={{ color: "#6b7280" }}>승자 {selectedPreview.winnerCount}명</small>
            <small style={{ color: "#6b7280" }}>예상 총지급 {selectedPreview.payoutTotal.toLocaleString("ko-KR")}pt</small>
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
      <Button type="submit" disabled={isLoading || alreadyResolved}>{isLoading ? "저장 중..." : alreadyResolved ? "이미 해결됨" : "결과 확정"}</Button>
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </form>
  );
}
