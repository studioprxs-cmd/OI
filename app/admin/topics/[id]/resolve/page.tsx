import { notFound } from "next/navigation";

import { Card, PageContainer, Pill, SectionTitle, TextLink } from "@/components/ui";
import { db } from "@/lib/db";
import { findMockTopic } from "@/lib/mock-data";

import { ResolveForm } from "./ResolveForm";

type Props = { params: Promise<{ id: string }> };

export default async function TopicResolvePage({ params }: Props) {
  const { id } = await params;
  const canUseDb = Boolean(process.env.DATABASE_URL);

  const topic = canUseDb ? await db.topic
    .findUnique({
      where: { id },
      include: { resolution: true },
    })
    .catch(() => null) : null;

  const mockTopic = findMockTopic(id);
  if (!topic && !mockTopic) return notFound();

  const topicId = topic?.id ?? mockTopic!.id;

  return (
    <PageContainer>
      <TextLink href="/admin/topics">← Admin Topics</TextLink>
      <Card>
        <SectionTitle>Admin: 토픽 해결 처리</SectionTitle>
        <h1 style={{ margin: "0.7rem 0 0" }}>{topic?.title ?? mockTopic!.title}</h1>
        <div className="row" style={{ marginTop: "0.6rem" }}>
          <Pill>{topic?.status ?? mockTopic!.status}</Pill>
          {topic?.resolution ? <Pill tone="success">이미 해결됨</Pill> : <Pill>미해결</Pill>}
        </div>
      </Card>
      <Card>
        <ResolveForm topicId={topicId} />
      </Card>
    </PageContainer>
  );
}
