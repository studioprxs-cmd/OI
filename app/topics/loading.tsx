import { AppStateCard, PageContainer } from "@/components/ui";

export default function TopicsLoading() {
  return (
    <PageContainer>
      <AppStateCard
        eyebrow="Loading"
        title="토픽 목록을 불러오는 중이에요"
        description="최신 여론과 베팅 현황을 정리하고 있습니다. 잠시만 기다려 주세요."
      />
    </PageContainer>
  );
}
