import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, PageContainer, Pill, SectionTitle } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";

type Props = {
  searchParams?: Promise<{ status?: string; q?: string }>;
};

const STATUS_ORDER = ["OPEN", "LOCKED", "RESOLVED", "CANCELED", "DRAFT"] as const;
const STATUS_WEIGHT: Record<string, number> = {
  OPEN: 4,
  LOCKED: 3,
  DRAFT: 2,
  RESOLVED: 1,
  CANCELED: 0,
};

export default async function AdminTopicsPage({ searchParams }: Props) {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");
  if (viewer.role !== "ADMIN") redirect("/");

  const canUseDb = Boolean(process.env.DATABASE_URL);
  const query = await searchParams;
  const selectedStatus = String(query?.status ?? "ALL").toUpperCase();
  const keyword = String(query?.q ?? "").trim().toLowerCase();

  const dbTopics = canUseDb
    ? await db.topic
        .findMany({
          orderBy: { createdAt: "desc" },
          take: 80,
        })
        .catch(() => [])
    : [];

  const topics = [
    ...dbTopics,
    ...mockTopicSummaries().filter((mock) => !dbTopics.some((topic) => topic.id === mock.id)),
  ];

  const openCount = topics.filter((topic) => topic.status === "OPEN").length;
  const lockedCount = topics.filter((topic) => topic.status === "LOCKED").length;
  const resolvedCount = topics.filter((topic) => topic.status === "RESOLVED").length;
  const canceledCount = topics.filter((topic) => topic.status === "CANCELED").length;
  const draftCount = topics.filter((topic) => topic.status === "DRAFT").length;

  const filteredTopics = topics
    .filter((topic) => {
      if (selectedStatus !== "ALL" && topic.status !== selectedStatus) return false;
      if (!keyword) return true;

      const haystack = [topic.id, topic.title, topic.description, topic.status].join(" ").toLowerCase();
      return haystack.includes(keyword);
    })
    .sort((a, b) => {
      const statusDiff = (STATUS_WEIGHT[b.status] ?? -1) - (STATUS_WEIGHT[a.status] ?? -1);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const pendingResolveCount = topics.filter((topic) => topic.status === "OPEN" || topic.status === "LOCKED").length;

  return (
    <PageContainer>
      <div className="row" style={{ justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Admin · Topics</h1>
        <div className="row" style={{ gap: "0.9rem" }}>
          <Link className="text-link" href="/admin/topics/new">+ Create Topic</Link>
          <Link className="text-link" href="/admin/topics?status=ALL">필터 초기화</Link>
        </div>
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
          <Pill>DRAFT {draftCount}</Pill>
        </div>
      </Card>

      <Card>
        <SectionTitle>처리 우선순위</SectionTitle>
        <div className="row" style={{ marginTop: "0.6rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <Pill tone={pendingResolveCount > 0 ? "danger" : "success"}>정산/상태 확인 필요 {pendingResolveCount}</Pill>
          <Pill tone={draftCount > 0 ? "neutral" : "success"}>초안 {draftCount}</Pill>
        </div>
        <p style={{ margin: "0.65rem 0 0", color: "#6b7280" }}>
          OPEN/LOCKED 토픽은 모더레이션/정산 대상일 수 있으니 우선적으로 확인하세요.
        </p>
      </Card>

      <Card>
        <SectionTitle>토픽 필터</SectionTitle>
        <div className="row" style={{ marginTop: "0.7rem", flexWrap: "wrap", gap: "0.55rem" }}>
          <Link className="text-link" href={`/admin/topics?status=ALL&q=${encodeURIComponent(keyword)}`}>
            ALL {topics.length}
          </Link>
          {STATUS_ORDER.map((status) => (
            <Link key={status} className="text-link" href={`/admin/topics?status=${status}&q=${encodeURIComponent(keyword)}`}>
              <Pill tone={selectedStatus === status ? "danger" : "neutral"}>
                {status} {topics.filter((topic) => topic.status === status).length}
              </Pill>
            </Link>
          ))}
        </div>

        <form method="get" className="row moderation-filter-form" style={{ marginTop: "0.75rem", gap: "0.55rem", flexWrap: "wrap" }}>
          <input type="hidden" name="status" value={selectedStatus} />
          <input
            name="q"
            defaultValue={query?.q ?? ""}
            placeholder="토픽 id/제목/설명 검색"
            style={{
              border: "1px solid rgba(15, 23, 42, 0.15)",
              borderRadius: "0.65rem",
              padding: "0.45rem 0.6rem",
              minWidth: "0",
              width: "100%",
              flex: "2 1 240px",
            }}
          />
          <button
            type="submit"
            style={{
              border: "1px solid rgba(15, 23, 42, 0.18)",
              borderRadius: "0.65rem",
              background: "#111827",
              color: "#fff",
              padding: "0.45rem 0.8rem",
              fontWeight: 600,
            }}
          >
            필터 적용
          </button>
        </form>
      </Card>

      <div className="list">
        {filteredTopics.map((topic) => (
          <Card key={topic.id}>
            <div className="row" style={{ justifyContent: "space-between", gap: "0.55rem", flexWrap: "wrap" }}>
              <strong>{topic.title}</strong>
              <div className="row" style={{ gap: "0.45rem" }}>
                {topic.status === "OPEN" ? <Pill tone="danger">우선 확인</Pill> : null}
                <small style={{ color: "#6b7280" }}>{topic.status}</small>
              </div>
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
        {filteredTopics.length === 0 ? <Card>조건에 맞는 토픽이 없습니다.</Card> : null}
      </div>
    </PageContainer>
  );
}
