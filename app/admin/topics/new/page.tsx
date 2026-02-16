import { Card, PageContainer, SectionTitle, TextLink } from "@/components/ui";

import { TopicCreateForm } from "./TopicCreateForm";

export default function AdminTopicCreatePage() {
  return (
    <PageContainer>
      <TextLink href="/admin/topics">← Admin Topics</TextLink>
      <Card>
        <SectionTitle>Admin: 새 토픽 생성</SectionTitle>
        <p style={{ margin: "0.5rem 0 0", color: "#6b7280" }}>
          ADMIN 계정으로 로그인한 상태에서만 POST /api/topics 호출이 허용됩니다.
        </p>
      </Card>
      <Card>
        <TopicCreateForm />
      </Card>
    </PageContainer>
  );
}
