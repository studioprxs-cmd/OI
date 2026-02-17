"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Message } from "@/components/ui";

type Props = {
  reportId: string;
};

export function WithdrawReportButton({ reportId }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function onWithdraw() {
    const agreed = window.confirm("접수된 신고를 취소하시겠습니까? 취소 후에는 관리자 검토 대상에서 제외됩니다.");
    if (!agreed) return;

    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/me/reports/${reportId}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "신고 취소에 실패했습니다.");
        return;
      }

      router.refresh();
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="list" style={{ gap: "0.35rem" }}>
      <Button type="button" variant="secondary" disabled={isLoading} onClick={onWithdraw}>
        {isLoading ? "취소 중..." : "신고 취소"}
      </Button>
      {message ? <Message text={message} tone="error" /> : null}
    </div>
  );
}
