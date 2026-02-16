import { Card, PageContainer } from "@/components/ui";

export default function TopicsLoading() {
  return (
    <PageContainer>
      <h1 style={{ margin: 0 }}>Topics</h1>
      <Card>
        <p style={{ margin: 0, color: "#6b7280" }}>토픽 목록을 불러오는 중...</p>
      </Card>
    </PageContainer>
  );
}
