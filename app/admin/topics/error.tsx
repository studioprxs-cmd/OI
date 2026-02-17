"use client";

import { AdminErrorState } from "@/components/admin/AdminErrorState";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ reset }: Props) {
  return (
    <AdminErrorState
      title="토픽 운영 화면을 불러오지 못했습니다"
      description="일시적인 데이터 조회 오류일 수 있습니다. 다시 시도하거나 관리자 메인 동선으로 이동해 주세요."
      homeHref="/admin/topics"
      reset={reset}
    />
  );
}
