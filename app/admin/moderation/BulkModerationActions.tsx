"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Message, SelectField } from "@/components/ui";

const BULK_STATUS_OPTIONS = [
  { value: "REVIEWING", label: "REVIEWING(검토중)으로 일괄 전환" },
  { value: "CLOSED", label: "CLOSED(처리완료)로 일괄 전환" },
  { value: "REJECTED", label: "REJECTED(기각)로 일괄 전환" },
] as const;

type BulkStatusValue = (typeof BULK_STATUS_OPTIONS)[number]["value"];

type Props = {
  openIds: string[];
  reviewingIds: string[];
  filteredCount: number;
};

export function BulkModerationActions({ openIds, reviewingIds, filteredCount }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<BulkStatusValue>("REVIEWING");
  const [scope, setScope] = useState<"OPEN" | "OPEN_REVIEWING">("OPEN");
  const [message, setMessage] = useState("");

  const targetIds = useMemo(() => {
    if (scope === "OPEN_REVIEWING") {
      return Array.from(new Set([...openIds, ...reviewingIds]));
    }
    return openIds;
  }, [openIds, reviewingIds, scope]);

  async function runBulkUpdate() {
    if (targetIds.length === 0) {
      setMessage("일괄 처리할 신고가 없습니다.");
      return;
    }

    const agreed = window.confirm(
      `필터 결과 ${filteredCount}건 중 ${targetIds.length}건을 ${status} 상태로 일괄 변경할까요?`,
    );
    if (!agreed) return;

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ids: targetIds,
          status,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        data?: {
          successCount?: number;
          skipCount?: number;
          missingCount?: number;
          lockedSkipCount?: number;
        };
      };

      if (!res.ok) {
        setMessage(data.error ?? "일괄 처리에 실패했습니다.");
        return;
      }

      const successCount = Number(data?.data?.successCount ?? 0);
      const skipCount = Number(data?.data?.skipCount ?? 0);
      const missingCount = Number(data?.data?.missingCount ?? 0);
      const lockedSkipCount = Number(data?.data?.lockedSkipCount ?? 0);

      const skipMessages = [
        lockedSkipCount > 0 ? `완료 상태 건너뜀 ${lockedSkipCount}건` : null,
        missingCount > 0 ? `존재하지 않는 신고 ${missingCount}건` : null,
      ].filter(Boolean);

      setMessage(`일괄 처리 완료 · 성공 ${successCount}건${skipCount > 0 ? ` · 건너뜀 ${skipCount}건` : ""}${skipMessages.length > 0 ? ` (${skipMessages.join(" · ")})` : ""}`);
      router.refresh();
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="list" style={{ gap: "0.45rem" }}>
      <div className="row moderation-bulk-row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "stretch" }}>
        <div style={{ minWidth: "10rem", flex: "1 1 12rem" }}>
          <SelectField
            id="bulk-scope"
            name="bulk-scope"
            value={scope}
            onChange={(value) => setScope(value as "OPEN" | "OPEN_REVIEWING")}
            options={[
              { value: "OPEN", label: `OPEN만 (${openIds.length}건)` },
              { value: "OPEN_REVIEWING", label: `OPEN+REVIEWING (${new Set([...openIds, ...reviewingIds]).size}건)` },
            ]}
          />
        </div>
        <div style={{ minWidth: "13rem", flex: "2 1 15rem" }}>
          <SelectField
            id="bulk-status"
            name="bulk-status"
            value={status}
            onChange={(value) => setStatus(value as BulkStatusValue)}
            options={[...BULK_STATUS_OPTIONS]}
          />
        </div>
        <Button type="button" onClick={runBulkUpdate} disabled={isLoading || targetIds.length === 0}>
          {isLoading ? "일괄 처리 중..." : `일괄 적용 (${targetIds.length}건)`}
        </Button>
      </div>
      <small style={{ color: "#6b7280" }}>
        안전 모드: 일괄 처리는 상태값만 변경하며, 댓글 숨김/토픽 상태 변경/환불은 개별 신고 카드에서만 수행됩니다.
      </small>
      {message ? <Message text={message} tone={message.includes("실패") ? "error" : "info"} /> : null}
    </div>
  );
}
