"use client";

import { FormEvent, useState } from "react";

import { Button, Field, Message, SelectField, TextAreaField } from "@/components/ui";

type Props = { topicId: string };

const reasonOptions = [
  { value: "FALSE_INFO", label: "허위 정보" },
  { value: "MISLEADING", label: "오해를 유도함" },
  { value: "POLICY", label: "운영 정책 위반" },
  { value: "DUPLICATE", label: "중복 토픽" },
  { value: "OTHER", label: "기타" },
] as const;

type ReasonValue = (typeof reasonOptions)[number]["value"];

const reasonLabelMap = new Map<ReasonValue, string>(reasonOptions.map((item) => [item.value, item.label]));

export function TopicReportButton({ topicId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReasonValue>("FALSE_INFO");
  const [detail, setDetail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/topics/${topicId}/report`, {
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

      setMessage("토픽 신고가 접수되었습니다. 운영진이 확인할 예정입니다.");
      setDetail("");
      setIsOpen(false);
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="list" style={{ gap: "0.35rem", alignItems: "flex-start" }}>
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
          토픽 신고
        </button>
      ) : (
        <form onSubmit={onSubmit} className="list" style={{ gap: "0.5rem", width: "min(100%, 24rem)" }}>
          <Field label="사유" htmlFor={`topic-report-reason-${topicId}`}>
            <SelectField
              id={`topic-report-reason-${topicId}`}
              name="reason"
              value={reason}
              onChange={(value) => setReason(value as ReasonValue)}
              options={[...reasonOptions]}
            />
          </Field>
          <Field label="상세 내용 (선택)" htmlFor={`topic-report-detail-${topicId}`}>
            <TextAreaField
              id={`topic-report-detail-${topicId}`}
              name="detail"
              value={detail}
              onChange={setDetail}
              rows={3}
              placeholder="문제가 되는 근거를 간단히 작성해주세요."
            />
          </Field>
          <div className="row" style={{ gap: "0.45rem", justifyContent: "flex-end", width: "100%" }}>
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)} disabled={isLoading}>
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
