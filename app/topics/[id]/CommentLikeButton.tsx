"use client";

import { useState } from "react";

type Props = {
  commentId: string;
  initialLikeCount: number;
  canLike: boolean;
};

export function CommentLikeButton({ commentId, initialLikeCount, canLike }: Props) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);

  const onLike = async () => {
    if (!canLike || liked || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/comments/${commentId}/like`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null) as { ok?: boolean; data?: { likeCount?: number } } | null;
      if (!res.ok || !data?.ok) {
        return;
      }

      setLikeCount(Number(data.data?.likeCount ?? likeCount + 1));
      setLiked(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <button
      type="button"
      className="comment-like-button"
      onClick={onLike}
      disabled={!canLike || liked || isSubmitting}
      aria-label="댓글 추천"
    >
      <span>👍 추천</span>
      <strong>{likeCount}</strong>
    </button>
  );
}
