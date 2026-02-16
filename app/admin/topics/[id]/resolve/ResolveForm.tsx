"use client";

import { FormEvent, useState } from "react";

import { Button, Field, Message, SelectField, TextAreaField } from "@/components/ui";

type Props = { topicId: string };

const resultOptions = [
  { value: "YES", label: "YES" },
  { value: "NO", label: "NO" },
] as const;

export function ResolveForm({ topicId }: Props) {
  const [result, setResult] = useState("YES");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

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

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "정산 처리 실패");
        return;
      }

      const settledCount = Number(data?.data?.settlement?.settledCount ?? 0);
      setMessage(`정산(해결) 정보가 저장되었습니다. 정산 베팅 ${settledCount}건`);
      setSummary("");
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="list" onSubmit={onSubmit}>
      <Field label="결과" htmlFor="result">
        <SelectField id="result" name="result" value={result} onChange={setResult} options={[...resultOptions]} />
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
      <Button type="submit" disabled={isLoading}>{isLoading ? "저장 중..." : "결과 확정"}</Button>
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </form>
  );
}
