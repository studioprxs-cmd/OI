import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, PageContainer, Pill, SectionTitle } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { localListReports } from "@/lib/report-local";

type ReportStatus = "OPEN" | "REVIEWING" | "CLOSED" | "REJECTED";

function statusTone(status: ReportStatus): "neutral" | "success" | "danger" {
  if (status === "CLOSED") return "success";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

export default async function MyPage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");

  const canUseDb = Boolean(process.env.DATABASE_URL);

  const recentReports = canUseDb
    ? await db.report
      .findMany({
        where: { reporterId: viewer.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          topic: { select: { id: true, title: true } },
          comment: { select: { id: true } },
        },
      })
      .catch(() => [])
    : (await localListReports())
      .filter((report) => report.reporterId === viewer.id)
      .slice(0, 5)
      .map((report) => ({
        ...report,
        topic: null,
        comment: report.commentId ? { id: report.commentId } : null,
      }));

  const statusCounts = recentReports.reduce<Record<ReportStatus, number>>(
    (acc, report) => {
      acc[report.status as ReportStatus] += 1;
      return acc;
    },
    { OPEN: 0, REVIEWING: 0, CLOSED: 0, REJECTED: 0 },
  );

  return (
    <PageContainer>
      <div className="row" style={{ justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>내 활동</h1>
        <Link className="text-link" href="/topics">
          토픽으로 이동
        </Link>
      </div>

      <Card>
        <SectionTitle>계정 정보</SectionTitle>
        <p style={{ margin: "0.55rem 0", color: "#374151" }}>
          {viewer.nickname} · {viewer.email}
        </p>
        <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          <Pill>{viewer.role}</Pill>
          <Link className="text-link" href="/me/reports">
            신고 내역 전체 보기
          </Link>
        </div>
      </Card>

      <Card>
        <SectionTitle>최근 신고 상태 (5건 기준)</SectionTitle>
        <div className="row" style={{ gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
          <Pill tone="neutral">OPEN {statusCounts.OPEN}</Pill>
          <Pill tone="neutral">REVIEWING {statusCounts.REVIEWING}</Pill>
          <Pill tone="success">CLOSED {statusCounts.CLOSED}</Pill>
          <Pill tone="danger">REJECTED {statusCounts.REJECTED}</Pill>
        </div>
      </Card>

      <div className="list">
        {recentReports.length === 0 ? (
          <Card>최근 신고 내역이 없습니다.</Card>
        ) : (
          recentReports.map((report) => (
            <Card key={report.id}>
              <div className="row" style={{ justifyContent: "space-between", gap: "0.6rem", alignItems: "flex-start" }}>
                <div>
                  <strong>{report.reason}</strong>
                  <p style={{ margin: "0.35rem 0", color: "#6b7280" }}>{report.detail ?? "상세 설명 없음"}</p>
                  <small style={{ color: "#6b7280" }}>{new Date(report.createdAt).toLocaleString("ko-KR")}</small>
                  {report.topicId ? (
                    <p style={{ margin: "0.35rem 0 0" }}>
                      <Link className="text-link" href={`/topics/${report.topicId}`}>
                        관련 토픽 보기{report.topic?.title ? ` · ${report.topic.title}` : ""}
                      </Link>
                    </p>
                  ) : null}
                </div>
                <Pill tone={statusTone(report.status as ReportStatus)}>{report.status}</Pill>
              </div>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}
