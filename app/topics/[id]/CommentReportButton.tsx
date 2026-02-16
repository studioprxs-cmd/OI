"use client";

import { useState } from "react";

import { Button, Message } from "@/components/ui";

type Props = { commentId: string };

export function CommentReportButton({ commentId }: Props) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onClick() {
    const reason = window.prompt("신고 사유를 입력해주세요.", "부적절한 내용");
    if (!reason || !reason.trim()) return;

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/comments/${commentId}/report`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "신고 처리에 실패했습니다.");
        return;
      }

      setMessage("신고가 접수되었습니다.");
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="list" style={{ gap: "0.4rem" }}>
      <Button type="button" onClick={onClick} disabled={isLoading}>
        {isLoading ? "신고 중..." : "신고"}
      </Button>
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </div>
  );
}
