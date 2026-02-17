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
    />
  );
}
