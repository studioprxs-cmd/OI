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

const NO_WINNER_CONFIRM_PHRASE = "0PT 지급 승인";
const PAYOUT_DELTA_CONFIRM_PHRASE = "정산 차이 검토 완료";
const MULTIPLIER_OUTLIER_CONFIRM_PHRASE = "고배당 검토 완료";
const MULTIPLIER_OUTLIER_THRESHOLD = 10;
const MIN_SUMMARY_LENGTH = 12;
const SUMMARY_PRESETS = [
  { label: "공식 근거", text: "공식 발표 및 검증된 근거를 토대로 결과를 확정합니다." },
  { label: "이의기간 종료", text: "이의 제기 기간 종료 후 운영팀 검토를 거쳐 결과를 확정합니다." },
  { label: "무결성 점검", text: "중복/무효 베팅 점검 완료, 정산 무결성 확인 후 확정합니다." },
] as const;

export function ResolveForm({ topicId }: Props) {
  const [result, setResult] = useState<ResultValue>("YES");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmNoWinner, setConfirmNoWinner] = useState(false);
  const [noWinnerConfirmPhrase, setNoWinnerConfirmPhrase] = useState("");
  const [confirmPayoutDelta, setConfirmPayoutDelta] = useState(false);
  const [payoutDeltaConfirmPhrase, setPayoutDeltaConfirmPhrase] = useState("");
  const [confirmMultiplierOutlier, setConfirmMultiplierOutlier] = useState(false);
  const [multiplierOutlierConfirmPhrase, setMultiplierOutlierConfirmPhrase] = useState("");

  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

  const selectedPreview = useMemo(() => previewData?.preview?.[result], [previewData, result]);
  const payoutDelta = useMemo(() => {
    if (!selectedPreview) return 0;
    return selectedPreview.totalPool - selectedPreview.payoutTotal;
  }, [selectedPreview]);
  const alreadyResolved = Boolean(previewData?.topic?.resolution);
  const topicStatus = previewData?.topic?.status ?? "";
  const resolvedSettlement = previewData?.resolvedSettlement ?? null;
  const isBlockedStatus = topicStatus === "CANCELED" || topicStatus === "DRAFT";
  const unsettledCount = Number(previewData?.unsettledBetCount ?? 0);
  const hasPayoutDelta = unsettledCount > 0 && payoutDelta !== 0;
  const requiresNoWinnerConfirm = Number(selectedPreview?.winnerPool ?? 0) === 0 && unsettledCount > 0;
  const noWinnerPhraseMatched = noWinnerConfirmPhrase.trim() === NO_WINNER_CONFIRM_PHRASE;
  const payoutDeltaPhraseMatched = payoutDeltaConfirmPhrase.trim() === PAYOUT_DELTA_CONFIRM_PHRASE;
  const summaryTrimmed = summary.trim();
  const summaryTooShort = summaryTrimmed.length > 0 && summaryTrimmed.length < MIN_SUMMARY_LENGTH;
  const selectedMultiplier = payoutMultiplier(selectedPreview);
  const hasMultiplierOutlier = unsettledCount > 0 && Number(selectedPreview?.winnerPool ?? 0) > 0 && selectedMultiplier >= MULTIPLIER_OUTLIER_THRESHOLD;
  const multiplierOutlierPhraseMatched = multiplierOutlierConfirmPhrase.trim() === MULTIPLIER_OUTLIER_CONFIRM_PHRASE;

  const integrityChecklist = [
    {
      label: "토픽 상태가 정산 가능 상태인지",
      hint: isBlockedStatus ? `${topicStatus} 상태에서는 정산 불가` : `현재 상태: ${topicStatus || "UNKNOWN"}`,
      ok: !isBlockedStatus,
    },
    {
      label: "중복 정산 방지",
      hint: alreadyResolved ? "이미 해결/정산 완료됨" : "아직 해결 기록 없음",
      ok: !alreadyResolved,
    },
    {
      label: "승리 풀(당첨자 존재) 검증",
      hint: requiresNoWinnerConfirm
        ? "승리 베팅 없음 (0pt 지급 정산, 추가 확인 필요)"
        : `승리 풀 ${Number(selectedPreview?.winnerPool ?? 0).toLocaleString("ko-KR")}pt`,
      ok: !requiresNoWinnerConfirm,
    },
    {
      label: "정산 보존식 점검 (총 풀 = 총 지급)",
      hint: hasPayoutDelta
        ? `차이 ${payoutDelta > 0 ? "+" : ""}${payoutDelta.toLocaleString("ko-KR")}pt · 배당 계산 재확인 필요`
        : "총 풀과 총 지급이 일치합니다.",
      ok: !hasPayoutDelta,
    },
    {
      label: "고배당 이상치 점검",
      hint: hasMultiplierOutlier
        ? `예상 배당 ${selectedMultiplier.toFixed(2)}x · 기준 ${MULTIPLIER_OUTLIER_THRESHOLD}x 이상`
        : `예상 배당 ${selectedMultiplier > 0 ? `${selectedMultiplier.toFixed(2)}x` : "0x"}`,
      ok: !hasMultiplierOutlier,
    },
    {
      label: "감사 로그 품질(요약 길이)",
      hint: summaryTrimmed.length >= MIN_SUMMARY_LENGTH ? "감사 최소 길이 충족" : `최소 ${MIN_SUMMARY_LENGTH}자 필요`,
      ok: summaryTrimmed.length >= MIN_SUMMARY_LENGTH,
    },
  ];

  useEffect(() => {
    if (!requiresNoWinnerConfirm) {
      setConfirmNoWinner(false);
      setNoWinnerConfirmPhrase("");
    }
  }, [requiresNoWinnerConfirm, result]);

  useEffect(() => {
    if (!hasPayoutDelta) {
      setConfirmPayoutDelta(false);
      setPayoutDeltaConfirmPhrase("");
    }
  }, [hasPayoutDelta, result]);

  useEffect(() => {
    if (!hasMultiplierOutlier) {
      setConfirmMultiplierOutlier(false);
      setMultiplierOutlierConfirmPhrase("");
    }
  }, [hasMultiplierOutlier, result]);

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

    if (!summaryTrimmed) {
      setMessage("요약은 필수입니다.");
      return;
    }

    if (summaryTrimmed.length < MIN_SUMMARY_LENGTH) {
      setMessage(`요약은 최소 ${MIN_SUMMARY_LENGTH}자 이상 작성해주세요.`);
      return;
    }

    if (requiresNoWinnerConfirm && !confirmNoWinner) {
      setMessage("승리 베팅이 없는 정산(0pt 지급)을 진행하려면 확인 체크가 필요합니다.");
      return;
    }

    if (requiresNoWinnerConfirm && !noWinnerPhraseMatched) {
      setMessage(`0pt 지급 정산을 확정하려면 확인 문구 \"${NO_WINNER_CONFIRM_PHRASE}\" 를 정확히 입력하세요.`);
      return;
    }

    if (hasPayoutDelta && !confirmPayoutDelta) {
      setMessage("총 풀과 예상 총지급이 일치하지 않습니다. 차이 검토 확인 체크를 완료해야 저장할 수 있습니다.");
      return;
    }

    if (hasPayoutDelta && !payoutDeltaPhraseMatched) {
      setMessage(`정산 차이를 검토했으면 확인 문구 \"${PAYOUT_DELTA_CONFIRM_PHRASE}\" 를 정확히 입력하세요.`);
      return;
    }

    if (hasMultiplierOutlier && !confirmMultiplierOutlier) {
      setMessage(`예상 배당 ${selectedMultiplier.toFixed(2)}x는 고배당 이상치입니다. 검토 확인 체크가 필요합니다.`);
      return;
    }

    if (hasMultiplierOutlier && !multiplierOutlierPhraseMatched) {
      setMessage(`고배당 검토를 완료했으면 확인 문구 \"${MULTIPLIER_OUTLIER_CONFIRM_PHRASE}\" 를 정확히 입력하세요.`);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/topics/${topicId}/resolve`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ result, summary: summaryTrimmed, confirmNoWinner, confirmPayoutDelta }),
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
        <div className="resolve-preview-head">
          <strong>정산 미리보기</strong>
          <small>베팅/지급 영향도 먼저 확인한 뒤 확정하세요.</small>
        </div>
        {previewLoading ? <p style={{ margin: 0, color: "#6b7280" }}>불러오는 중...</p> : null}
        {previewError ? <Message text={previewError} tone="error" /> : null}
        {!previewLoading && !previewError && previewData?.preview ? (
          <div className="list" style={{ gap: "0.7rem" }}>
            <div className="resolve-health-row">
              <span>토픽 상태 {topicStatus || "UNKNOWN"}</span>
              <span>미정산 베팅 {unsettledCount}건</span>
              <span>선택 결과 {result}</span>
            </div>

            <div className="resolve-choice-grid">
              {(Object.entries(previewData.preview) as Array<[ResultValue, SettlementPreviewSummary]>).map(([side, item]) => {
                const isSelected = side === result;
                const multiplier = payoutMultiplier(item);

                return (
                  <button
                    key={side}
                    type="button"
                    className={`resolve-choice-card${isSelected ? " is-active" : ""}`}
                    onClick={() => setResult(side)}
                  >
                    <div className="resolve-choice-head">
                      <strong>{side} 승리 시</strong>
                      <small>{isSelected ? "선택됨" : "탭하여 선택"}</small>
                    </div>
                    <div className="resolve-choice-kpi-grid">
                      <span>총 풀 {item.totalPool.toLocaleString("ko-KR")}pt</span>
                      <span>승리 풀 {item.winnerPool.toLocaleString("ko-KR")}pt</span>
                      <span>승자 {item.winnerCount}명</span>
                      <span>예상 총지급 {item.payoutTotal.toLocaleString("ko-KR")}pt</span>
                      <span>배당 {multiplier > 0 ? `${multiplier.toFixed(2)}x` : "0x"}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="integrity-grid">
              {integrityChecklist.map((item) => (
                <div key={item.label} className="integrity-card">
                  <p className="admin-kpi-label" style={{ marginBottom: "0.2rem" }}>{item.label}</p>
                  <p style={{ margin: 0, color: "#4f6258", fontSize: "0.86rem" }}>{item.hint}</p>
                  <p style={{ margin: "0.32rem 0 0", fontSize: "0.78rem", fontWeight: 700, color: item.ok ? "#0f6a3d" : "#a7362f" }}>
                    {item.ok ? "검증 통과" : "추가 확인 필요"}
                  </p>
                </div>
              ))}
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
            {hasPayoutDelta ? (
              <Message
                text={`총 풀과 예상 총지급이 ${payoutDelta > 0 ? "+" : ""}${payoutDelta.toLocaleString("ko-KR")}pt 차이 납니다. 배당/무효 베팅 처리 정책을 다시 확인하세요.`}
                tone="error"
              />
            ) : null}
            {hasPayoutDelta ? (
              <div className="list" style={{ gap: "0.52rem" }}>
                <label className="resolve-confirm-check">
                  <input
                    type="checkbox"
                    checked={confirmPayoutDelta}
                    onChange={(event) => setConfirmPayoutDelta(event.target.checked)}
                  />
                  <span>정산 차이({payoutDelta > 0 ? "+" : ""}{payoutDelta.toLocaleString("ko-KR")}pt) 원인을 검토했고 이 값으로 확정 진행해도 되는지 확인했습니다.</span>
                </label>
                <Field label={`확인 문구 입력 (${PAYOUT_DELTA_CONFIRM_PHRASE})`} htmlFor="payout-delta-confirm-phrase">
                  <input
                    id="payout-delta-confirm-phrase"
                    className="input"
                    value={payoutDeltaConfirmPhrase}
                    onChange={(event) => setPayoutDeltaConfirmPhrase(event.target.value)}
                    placeholder={PAYOUT_DELTA_CONFIRM_PHRASE}
                    autoComplete="off"
                  />
                </Field>
              </div>
            ) : null}
            {hasMultiplierOutlier ? (
              <>
                <Message
                  text={`예상 배당 ${selectedMultiplier.toFixed(2)}x는 고배당 이상치입니다. 토픽 근거/베팅 분포/악성 베팅 여부를 재확인하세요.`}
                  tone="error"
                />
                <div className="list" style={{ gap: "0.52rem" }}>
                  <label className="resolve-confirm-check">
                    <input
                      type="checkbox"
                      checked={confirmMultiplierOutlier}
                      onChange={(event) => setConfirmMultiplierOutlier(event.target.checked)}
                    />
                    <span>고배당({selectedMultiplier.toFixed(2)}x) 이상치를 검토했고 조작/오입력 가능성을 확인했습니다.</span>
                  </label>
                  <Field label={`확인 문구 입력 (${MULTIPLIER_OUTLIER_CONFIRM_PHRASE})`} htmlFor="multiplier-outlier-confirm-phrase">
                    <input
                      id="multiplier-outlier-confirm-phrase"
                      className="input"
                      value={multiplierOutlierConfirmPhrase}
                      onChange={(event) => setMultiplierOutlierConfirmPhrase(event.target.value)}
                      placeholder={MULTIPLIER_OUTLIER_CONFIRM_PHRASE}
                      autoComplete="off"
                    />
                  </Field>
                </div>
              </>
            ) : null}
            {requiresNoWinnerConfirm ? (
              <div className="list" style={{ gap: "0.52rem" }}>
                <label className="resolve-confirm-check">
                  <input
                    type="checkbox"
                    checked={confirmNoWinner}
                    onChange={(event) => setConfirmNoWinner(event.target.checked)}
                  />
                  <span>승리 베팅 없음(총 지급 0pt) 상태를 확인했고 이 결과로 정산 진행에 동의합니다.</span>
                </label>
                <Field label={`확인 문구 입력 (${NO_WINNER_CONFIRM_PHRASE})`} htmlFor="no-winner-confirm-phrase">
                  <input
                    id="no-winner-confirm-phrase"
                    className="input"
                    value={noWinnerConfirmPhrase}
                    onChange={(event) => setNoWinnerConfirmPhrase(event.target.value)}
                    placeholder={NO_WINNER_CONFIRM_PHRASE}
                    autoComplete="off"
                  />
                </Field>
              </div>
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
        <div className="resolve-summary-meta" aria-live="polite">
          <span className={summaryTooShort ? "is-warning" : "is-ok"}>최소 {MIN_SUMMARY_LENGTH}자 · 현재 {summaryTrimmed.length}자</span>
          <small>사후 감사 대비를 위해 판단 근거를 명확히 남겨주세요.</small>
        </div>
        <div className="resolve-summary-preset-row" role="group" aria-label="요약 템플릿">
          {SUMMARY_PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="btn btn-secondary resolve-summary-preset-btn" onClick={() => setSummary(preset.text)}>
              {preset.label}
            </button>
          ))}
        </div>
      </Field>
      <div className="resolve-submit-bar">
        <Button
          type="submit"
          disabled={isLoading || alreadyResolved || isBlockedStatus || !summaryTrimmed || summaryTrimmed.length < MIN_SUMMARY_LENGTH || (requiresNoWinnerConfirm && (!confirmNoWinner || !noWinnerPhraseMatched)) || (hasPayoutDelta && (!confirmPayoutDelta || !payoutDeltaPhraseMatched)) || (hasMultiplierOutlier && (!confirmMultiplierOutlier || !multiplierOutlierPhraseMatched))}
        >
          {isLoading ? "저장 중..." : alreadyResolved ? "이미 해결됨" : isBlockedStatus ? "정산 불가 상태" : "결과 확정"}
        </Button>
      </div>
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </form>
  );
}
