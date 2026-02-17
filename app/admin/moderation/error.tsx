"use client";

import { AdminErrorState } from "@/components/admin/AdminErrorState";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ reset }: Props) {
  return (
    <AdminErrorState
      title="신고/정산 운영 화면을 불러오지 못했습니다"
      description="정산 무결성 데이터나 신고 큐 조회 중 오류가 발생했습니다. 다시 시도해 주세요."
      homeHref="/admin/moderation"
      reset={reset}
      quickChecks={[
        "OPEN 큐만 먼저 로드해 장애 범위를 축소 확인",
        "정산 지표 카드가 비정상이면 /admin/topics에서 DB 응답 점검",
        "문제가 지속되면 잠시 후 재시도 후 운영 로그 확인",
      ]}
      quickLinks={[
        { href: "/admin/moderation?status=OPEN", label: "OPEN Queue" },
        { href: "/admin/topics", label: "Settlement Watch" },
      ]}
    />
  );
}
