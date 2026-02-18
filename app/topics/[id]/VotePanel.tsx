"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Message } from "@/components/ui";

type Choice = "YES" | "NO";

type Props = {
  topicId: string;
  canVote: boolean;
  isAuthenticated: boolean;
  blockReason?: string;
};

export function VotePanel({ topicId, canVote, isAuthenticated, blockReason }: Props) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>("YES");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAuthenticated) {
      setMessage("로그인 후 투표할 수 있습니다.");
      return;
    }

    if (!canVote) {
      setMessage(blockReason ?? "지금은 투표할 수 없습니다.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/topics/${topicId}/votes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error ?? "투표에 실패했습니다.");
        return;
      }

      setMessage("투표 완료! +100P 보상이 반영됐습니다.");
      router.refresh();
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="bet-ticket" onSubmit={onSubmit}>
      <div className="bet-choice-row" role="tablist" aria-label="투표 선택">
        <button type="button" className={`bet-choice ${choice === "YES" ? "is-active yes" : ""}`} onClick={() => setChoice("YES")}>YES</button>
        <button type="button" className={`bet-choice ${choice === "NO" ? "is-active no" : ""}`} onClick={() => setChoice("NO")}>NO</button>
      </div>

      <Button type="submit" disabled={isLoading || !isAuthenticated || !canVote}>
        {isLoading ? "투표 처리 중..." : `${choice} 투표하기`}
      </Button>

      {!canVote && blockReason ? <Message text={blockReason} tone="error" /> : null}
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </form>
  );
}
