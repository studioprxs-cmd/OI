import { Card, PageContainer } from "@/components/ui";

export default function TopicDetailLoading() {
  return (
    <PageContainer>
      <Card>
        <p style={{ margin: 0, color: "#6b7280" }}>토픽 상세를 불러오는 중...</p>
      </Card>
    </PageContainer>
  );
}
