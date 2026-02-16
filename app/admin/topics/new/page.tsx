import { redirect } from "next/navigation";

import { Card, PageContainer, SectionTitle, TextLink } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";

import { TopicCreateForm } from "./TopicCreateForm";

export default async function AdminTopicCreatePage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");
  if (viewer.role !== "ADMIN") redirect("/");

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
