"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Message, SelectField } from "@/components/ui";

const STATUSES = ["OPEN", "REVIEWING", "CLOSED", "REJECTED"] as const;
const VISIBILITY_OPTIONS = [
  { value: "KEEP", label: "댓글 상태 유지" },
  { value: "HIDE", label: "댓글 숨김" },
  { value: "UNHIDE", label: "댓글 숨김 해제" },
] as const;

const TOPIC_ACTION_OPTIONS = [
  { value: "KEEP", label: "토픽 상태 유지" },
  { value: "LOCK", label: "토픽 잠금 (LOCKED)" },
  { value: "CANCEL", label: "토픽 취소 (CANCELED)" },
  { value: "REOPEN", label: "토픽 재오픈 (OPEN)" },
] as const;

type StatusValue = (typeof STATUSES)[number];
type VisibilityValue = (typeof VISIBILITY_OPTIONS)[number]["value"];
type TopicActionValue = (typeof TOPIC_ACTION_OPTIONS)[number]["value"];

type Props = {
  reportId: string;
  initialStatus: StatusValue;
  hasComment: boolean;
  hasTopic: boolean;
  commentHidden?: boolean;
  topicStatus?: string;
};

export function ReportActions({ reportId, initialStatus, hasComment, hasTopic, commentHidden = false, topicStatus }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<StatusValue>(initialStatus);
  const [commentVisibility, setCommentVisibility] = useState<VisibilityValue>("KEEP");
  const [topicAction, setTopicAction] = useState<TopicActionValue>("KEEP");

  const isResolvedTopic = topicStatus === "RESOLVED";
  const hasChanges =
    status !== initialStatus ||
    (hasComment && commentVisibility !== "KEEP") ||
    (hasTopic && topicAction !== "KEEP");

  function applyPreset(input: {
    status: StatusValue;
    commentVisibility?: VisibilityValue;
    topicAction?: TopicActionValue;
  }) {
    const nextCommentVisibility = hasComment ? (input.commentVisibility ?? "KEEP") : "KEEP";
    const nextTopicAction = hasTopic ? (input.topicAction ?? "KEEP") : "KEEP";

    setStatus(input.status);
    setCommentVisibility(nextCommentVisibility);
    setTopicAction(nextTopicAction);

    void submit({
      status: input.status,
      commentVisibility: nextCommentVisibility,
      topicAction: nextTopicAction,
    });
  }

  async function submit(override?: {
    status?: StatusValue;
    commentVisibility?: VisibilityValue;
    topicAction?: TopicActionValue;
  }) {
    const nextStatus = override?.status ?? status;
    const nextCommentVisibility = override?.commentVisibility ?? commentVisibility;
    const nextTopicAction = override?.topicAction ?? topicAction;

    const hasPendingChanges =
      nextStatus !== initialStatus ||
      (hasComment && nextCommentVisibility !== "KEEP") ||
      (hasTopic && nextTopicAction !== "KEEP");

    if (!hasPendingChanges) {
      setMessage("변경된 내용이 없습니다.");
      return;
    }

    if (nextTopicAction === "CANCEL") {
      const agreed = window.confirm("토픽을 CANCELED 상태로 변경하시겠습니까? 이미 참여한 사용자에게 영향이 있을 수 있습니다.");
      if (!agreed) return;
    }

    if (nextTopicAction === "REOPEN" && isResolvedTopic) {
      setMessage("이미 정산 완료된 토픽은 REOPEN 할 수 없습니다.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          commentVisibility: hasComment ? nextCommentVisibility : "KEEP",
          topicAction: hasTopic ? nextTopicAction : "KEEP",
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        data?: { refundSummary?: { refundedBetCount?: number; refundedAmount?: number } | null };
      };
      if (!res.ok) {
        setMessage(data.error ?? "상태 변경에 실패했습니다.");
        return;
      }

      const refundedBetCount = Number(data?.data?.refundSummary?.refundedBetCount ?? 0);
      const refundedAmount = Number(data?.data?.refundSummary?.refundedAmount ?? 0);

      if (nextTopicAction === "CANCEL") {
        setMessage(`신고/토픽 상태를 업데이트했습니다. 환불 ${refundedBetCount}건 · ${refundedAmount.toLocaleString("ko-KR")}pt`);
      } else {
        setMessage("신고 상태/연관 조치가 업데이트되었습니다.");
      }

      router.refresh();
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="list" style={{ gap: "0.45rem" }}>
      <div className="row" style={{ gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ minWidth: "9rem", flex: "1 1 9rem" }}>
          <SelectField
            id={`report-status-${reportId}`}
            name={`report-status-${reportId}`}
            value={status}
            onChange={(value) => setStatus(value as StatusValue)}
            options={STATUSES.map((item) => ({ value: item, label: item }))}
          />
        </div>

        {hasComment ? (
          <div style={{ minWidth: "11rem", flex: "1 1 11rem" }}>
            <SelectField
              id={`report-comment-visibility-${reportId}`}
              name={`report-comment-visibility-${reportId}`}
              value={commentVisibility}
              onChange={(value) => setCommentVisibility(value as VisibilityValue)}
              options={[...VISIBILITY_OPTIONS]}
            />
          </div>
        ) : null}

        {hasTopic ? (
          <div style={{ minWidth: "13rem", flex: "1 1 13rem" }}>
            <SelectField
              id={`report-topic-action-${reportId}`}
              name={`report-topic-action-${reportId}`}
              value={topicAction}
              onChange={(value) => setTopicAction(value as TopicActionValue)}
              options={TOPIC_ACTION_OPTIONS.map((option) => ({
                ...option,
                label: option.value === "REOPEN" && isResolvedTopic ? `${option.label} (정산 완료 토픽 불가)` : option.label,
              }))}
            />
          </div>
        ) : null}

        <Button type="button" disabled={isLoading || !hasChanges} onClick={submit}>
          {isLoading ? "저장 중..." : hasChanges ? "변경 저장" : "변경 없음"}
        </Button>
      </div>

      <div className="report-preset-row">
        <Button
          type="button"
          variant="secondary"
          className="report-preset-button"
          disabled={isLoading}
          onClick={() => applyPreset({ status: "REVIEWING", commentVisibility: hasComment ? "HIDE" : "KEEP" })}
        >
          빠른 처리: 검토중 + 댓글 숨김
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="report-preset-button"
          disabled={isLoading}
          onClick={() => applyPreset({ status: "CLOSED", commentVisibility: "KEEP", topicAction: "KEEP" })}
        >
          빠른 처리: 닫기(CLOSED)
        </Button>
        {hasTopic ? (
          <Button
            type="button"
            variant="danger"
            className="report-preset-button"
            disabled={isLoading || isResolvedTopic}
            onClick={() => applyPreset({ status: "CLOSED", topicAction: "CANCEL" })}
          >
            빠른 처리: 토픽 취소 + 환불
          </Button>
        ) : null}
      </div>

      <small style={{ color: "#6b7280" }}>
        현재 댓글 상태: {hasComment ? (commentHidden ? "숨김" : "표시") : "해당 없음"} · 토픽 상태: {topicStatus ?? "해당 없음"}
      </small>
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </div>
  );
}
