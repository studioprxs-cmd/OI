import Link from "next/link";

import { Card, PageContainer, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";

export default async function AdminTopicsPage() {
  const canUseDb = Boolean(process.env.DATABASE_URL);

  const dbTopics = canUseDb ? await db.topic
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    .catch(() => []) : [];

  const topics = [
    ...dbTopics,
    ...mockTopicSummaries().filter((mock) => !dbTopics.some((topic) => topic.id === mock.id)),
  ];

  return (
    <PageContainer>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Admin · Topics</h1>
        <Link className="text-link" href="/admin/topics/new">+ Create Topic</Link>
      </div>

      <Card>
        <SectionTitle>빠른 작업</SectionTitle>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <Link className="text-link" href="/topics">사용자 토픽 목록 보기</Link>
          <Link className="text-link" href="/admin/topics/new">새 토픽 생성</Link>
        </div>
      </Card>

      <div className="list">
        {topics.map((topic) => (
          <Card key={topic.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{topic.title}</strong>
              <small style={{ color: "#6b7280" }}>{topic.status}</small>
            </div>
            <p style={{ margin: "0.45rem 0", color: "#6b7280" }}>{topic.description}</p>
            <div className="row">
              <Link className="text-link" href={`/topics/${topic.id}`}>상세 보기</Link>
              <Link className="text-link" href={`/admin/topics/${topic.id}/resolve`}>Resolve</Link>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
