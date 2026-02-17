"use client";

import { useState } from "react";

import { Button, Message } from "@/components/ui";

type ActionValue = "LOCK" | "REOPEN" | "CANCEL";

type Props = {
  topicId: string;
  topicStatus: string;
};

const options: Array<{ value: ActionValue; label: string }> = [
  { value: "LOCK", label: "LOCK (참여 중지)" },
  { value: "REOPEN", label: "REOPEN (재오픈)" },
  { value: "CANCEL", label: "CANCEL (환불 취소)" },
];

export function TopicQuickActions({ topicId, topicStatus }: Props) {
  const [action, setAction] = useState<ActionValue>("LOCK");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const disabled = topicStatus === "RESOLVED";

  async function submitAction() {
    if (disabled || isLoading) return;

    if (action === "CANCEL") {
      const confirmed = window.confirm("토픽을 CANCEL 하면 미정산 베팅이 전액 환불됩니다. 계속할까요?");
      if (!confirmed) return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/admin/topics/${topicId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        data?: { refundSummary?: { refundedBetCount: number; refundedAmount: number } | null };
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "상태 변경 실패");
        return;
      }

      const refund = data.data?.refundSummary;
      if (action === "CANCEL" && refund) {
        setMessage(`토픽 취소 완료 · 환불 ${refund.refundedBetCount}건 / ${refund.refundedAmount.toLocaleString("ko-KR")}pt`);
      } else {
        setMessage(`토픽 상태 변경 완료 (${action})`);
      }

      setTimeout(() => window.location.reload(), 350);
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="list" style={{ gap: "0.45rem" }}>
      <div className="row moderation-bulk-row" style={{ gap: "0.45rem" }}>
        <select
          value={action}
          onChange={(event) => setAction(event.target.value as ActionValue)}
          disabled={disabled || isLoading}
          className="input"
          style={{ minHeight: "44px", flex: "1 1 180px" }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="button" onClick={submitAction} disabled={disabled || isLoading}>
          {isLoading ? "처리 중..." : "상태 적용"}
        </Button>
      </div>
      {disabled ? <small style={{ color: "#6b7280" }}>RESOLVED 토픽은 상태를 변경할 수 없습니다.</small> : null}
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </div>
  );
}
