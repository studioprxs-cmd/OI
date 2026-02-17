"use client";

import { AppStateCard, Button, PageContainer } from "@/components/ui";

export default function TopicDetailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContainer>
      <AppStateCard
        eyebrow="Error"
        title="토픽 상세를 가져오지 못했습니다"
        tone="danger"
        description="일시적인 오류일 수 있어요. 다시 시도하면 대부분 바로 복구됩니다."
        actions={<Button type="button" onClick={reset}>다시 시도</Button>}
      />
    </PageContainer>
  );
}
