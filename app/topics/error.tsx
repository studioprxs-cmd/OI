"use client";

import { AppStateCard, Button, PageContainer } from "@/components/ui";

export default function TopicsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContainer>
      <AppStateCard
        eyebrow="Error"
        title="토픽 목록을 불러오지 못했습니다"
        tone="danger"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요. 문제가 반복되면 잠시 후 재접속하면 해결되는 경우가 많습니다."
        actions={<Button type="button" onClick={reset}>다시 시도</Button>}
      />
    </PageContainer>
  );
}
