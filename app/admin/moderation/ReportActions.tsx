"use client";

import { useState } from "react";

import { Message } from "@/components/ui";

const STATUSES = ["OPEN", "REVIEWING", "CLOSED", "REJECTED"] as const;

type Props = {
  reportId: string;
  onDone?: () => void;
};

export function ReportActions({ reportId, onDone }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function updateStatus(status: (typeof STATUSES)[number]) {
    setIsLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, hideComment: status === "CLOSED" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "상태 변경에 실패했습니다.");
        return;
      }
      setMessage(`상태가 ${status}로 변경되었습니다.`);
      onDone?.();
      setTimeout(() => window.location.reload(), 250);
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="list" style={{ gap: "0.45rem" }}>
      <div className="row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className="text-link"
            disabled={isLoading}
            style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer" }}
            onClick={() => updateStatus(status)}
          >
            {status}
          </button>
        ))}
      </div>
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </div>
  );
}
