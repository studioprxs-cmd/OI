"use client";

import { FormEvent, useState } from "react";

import { Button, Field, Message, SelectField, TextAreaField } from "@/components/ui";

type Props = { commentId: string };

const reasonOptions = [
  { value: "SPAM", label: "스팸/광고" },
  { value: "ABUSE", label: "욕설/혐오" },
  { value: "FALSE_INFO", label: "허위 정보" },
  { value: "PERSONAL_INFO", label: "개인정보 노출" },
  { value: "OTHER", label: "기타" },
] as const;

type ReasonValue = (typeof reasonOptions)[number]["value"];

const reasonLabelMap = new Map<ReasonValue, string>(reasonOptions.map((item) => [item.value, item.label]));

export function CommentReportButton({ commentId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReasonValue>("SPAM");
  const [detail, setDetail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/comments/${commentId}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: reasonLabelMap.get(reason) ?? reason,
          detail: detail.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "신고 처리에 실패했습니다.");
        return;
      }

      setMessage("신고가 접수되었습니다. 검토 후 조치됩니다.");
      setDetail("");
      setIsOpen(false);
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="list" style={{ gap: "0.35rem", alignItems: "flex-end" }}>
      {!isOpen ? (
        <button
          type="button"
          className="text-link"
          disabled={isLoading}
          style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer" }}
          onClick={() => {
            setMessage("");
            setIsOpen(true);
          }}
        >
          신고
        </button>
      ) : (
        <form onSubmit={onSubmit} className="list" style={{ gap: "0.5rem", width: "min(100%, 20rem)" }}>
          <Field label="사유" htmlFor={`report-reason-${commentId}`}>
            <SelectField
              id={`report-reason-${commentId}`}
              name="reason"
              value={reason}
              onChange={(value) => setReason(value as ReasonValue)}
              options={[...reasonOptions]}
            />
          </Field>
          <Field label="상세 내용 (선택)" htmlFor={`report-detail-${commentId}`}>
            <TextAreaField
              id={`report-detail-${commentId}`}
              name="detail"
              value={detail}
              onChange={setDetail}
              rows={3}
              placeholder="문제가 되는 이유를 간단히 적어주세요."
            />
          </Field>
          <div className="row" style={{ gap: "0.45rem", justifyContent: "flex-end", width: "100%" }}>
            <Button type="button" onClick={() => setIsOpen(false)} disabled={isLoading}>
              취소
            </Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "신고 중..." : "신고 제출"}</Button>
          </div>
        </form>
      )}
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </div>
  );
}
