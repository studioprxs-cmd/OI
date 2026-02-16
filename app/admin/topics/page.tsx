import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, PageContainer, Pill, SectionTitle } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";

export default async function AdminTopicsPage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");
  if (viewer.role !== "ADMIN") redirect("/");

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

  const openCount = topics.filter((topic) => topic.status === "OPEN").length;
  const lockedCount = topics.filter((topic) => topic.status === "LOCKED").length;
  const resolvedCount = topics.filter((topic) => topic.status === "RESOLVED").length;
  const canceledCount = topics.filter((topic) => topic.status === "CANCELED").length;

  return (
    <PageContainer>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Admin · Topics</h1>
        <Link className="text-link" href="/admin/topics/new">+ Create Topic</Link>
      </div>

      <Card>
        <SectionTitle>빠른 작업</SectionTitle>
        <div className="row" style={{ marginTop: "0.75rem", flexWrap: "wrap", gap: "0.7rem" }}>
          <Link className="text-link" href="/topics">사용자 토픽 목록 보기</Link>
          <Link className="text-link" href="/admin/topics/new">새 토픽 생성</Link>
          <Link className="text-link" href="/admin/moderation">모더레이션/정산 현황</Link>
        </div>
        <div className="row" style={{ marginTop: "0.7rem", flexWrap: "wrap", gap: "0.45rem" }}>
          <Pill tone="success">OPEN {openCount}</Pill>
          <Pill>LOCKED {lockedCount}</Pill>
          <Pill tone="danger">RESOLVED {resolvedCount}</Pill>
          <Pill>CANCELED {canceledCount}</Pill>
        </div>
      </Card>

      <div className="list">
        {topics.map((topic) => (
          <Card key={topic.id}>
            <div className="row" style={{ justifyContent: "space-between", gap: "0.55rem", flexWrap: "wrap" }}>
              <strong>{topic.title}</strong>
              <small style={{ color: "#6b7280" }}>{topic.status}</small>
            </div>
            <p style={{ margin: "0.45rem 0", color: "#6b7280" }}>{topic.description}</p>
            <div className="row" style={{ flexWrap: "wrap", gap: "0.7rem" }}>
              <Link className="text-link" href={`/topics/${topic.id}`}>상세 보기</Link>
              <Link className="text-link" href={`/admin/topics/${topic.id}/resolve`}>
                {topic.status === "RESOLVED" ? "정산 결과 보기" : "Resolve"}
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
