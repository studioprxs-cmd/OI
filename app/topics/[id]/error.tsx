"use client";

import { Button, Card, Message, PageContainer } from "@/components/ui";

export default function TopicDetailError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContainer>
      <Card>
        <Message text="토픽 상세를 불러오지 못했습니다." tone="error" />
        <div style={{ marginTop: "0.75rem" }}>
          <Button type="button" onClick={reset}>다시 시도</Button>
        </div>
      </Card>
    </PageContainer>
  );
}
