"use client";

import { useState } from "react";

import { Button, Message, SelectField } from "@/components/ui";

const STATUSES = ["OPEN", "REVIEWING", "CLOSED", "REJECTED"] as const;
const VISIBILITY_OPTIONS = [
  { value: "KEEP", label: "댓글 상태 유지" },
  { value: "HIDE", label: "댓글 숨김" },
  { value: "UNHIDE", label: "댓글 숨김 해제" },
] as const;

type StatusValue = (typeof STATUSES)[number];
type VisibilityValue = (typeof VISIBILITY_OPTIONS)[number]["value"];

type Props = {
  reportId: string;
  initialStatus: StatusValue;
  hasComment: boolean;
};

export function ReportActions({ reportId, initialStatus, hasComment }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<StatusValue>(initialStatus);
  const [commentVisibility, setCommentVisibility] = useState<VisibilityValue>("KEEP");

  async function submit() {
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status,
          commentVisibility: hasComment ? commentVisibility : "KEEP",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "상태 변경에 실패했습니다.");
        return;
      }
      setMessage("신고 상태가 업데이트되었습니다.");
      setTimeout(() => window.location.reload(), 300);
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="list" style={{ gap: "0.45rem" }}>
      <div className="row" style={{ gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ minWidth: "9rem" }}>
          <SelectField
            id={`report-status-${reportId}`}
            name={`report-status-${reportId}`}
            value={status}
            onChange={(value) => setStatus(value as StatusValue)}
            options={STATUSES.map((item) => ({ value: item, label: item }))}
          />
        </div>

        {hasComment ? (
          <div style={{ minWidth: "11rem" }}>
            <SelectField
              id={`report-comment-visibility-${reportId}`}
              name={`report-comment-visibility-${reportId}`}
              value={commentVisibility}
              onChange={(value) => setCommentVisibility(value as VisibilityValue)}
              options={[...VISIBILITY_OPTIONS]}
            />
          </div>
        ) : null}

        <Button type="button" disabled={isLoading} onClick={submit}>
          {isLoading ? "저장 중..." : "변경 저장"}
        </Button>
      </div>

      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </div>
  );
}
