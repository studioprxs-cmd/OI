import { AppStateCard, PageContainer } from "@/components/ui";

export default function TopicDetailLoading() {
  return (
    <PageContainer>
      <AppStateCard
        eyebrow="Loading"
        title="토픽 상세를 준비하고 있어요"
        description="투표/댓글/베팅 데이터를 불러오는 중입니다."
      />
    </PageContainer>
  );
}
