"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Message, TextAreaField } from "@/components/ui";

type Props = { topicId: string };

export function CommentForm({ topicId }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/topics/${topicId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "댓글 등록에 실패했습니다.");
        return;
      }

      setContent("");
      setMessage("댓글이 등록되었습니다.");
      router.refresh();
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="list">
      <TextAreaField
        id="comment-content"
        name="content"
        value={content}
        onChange={setContent}
        placeholder="댓글을 입력하세요"
        rows={4}
        required
      />
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "등록 중..." : "댓글 작성"}
      </Button>
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </form>
  );
}
