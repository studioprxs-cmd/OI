import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, PageContainer, Pill, SectionTitle } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { localListReports } from "@/lib/report-local";

type ReportRow = {
  id: string;
  reason: string;
  detail: string | null;
  status: "OPEN" | "REVIEWING" | "CLOSED" | "REJECTED";
  createdAt: Date | string;
  reviewedAt: Date | string | null;
  topicId: string | null;
  topicTitle: string | null;
  commentId: string | null;
};

function statusTone(status: ReportRow["status"]): "neutral" | "success" | "danger" {
  if (status === "CLOSED") return "success";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

function statusHint(status: ReportRow["status"]): string {
  if (status === "OPEN") return "접수 완료 · 대기 중";
  if (status === "REVIEWING") return "검토 진행 중";
  if (status === "CLOSED") return "처리 완료";
  return "반려";
}

export default async function MyReportsPage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");

  const canUseDb = Boolean(process.env.DATABASE_URL);

  const reports: ReportRow[] = canUseDb
    ? await db.report
      .findMany({
        where: { reporterId: viewer.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          topic: { select: { id: true, title: true } },
          comment: { select: { id: true } },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          reason: row.reason,
          detail: row.detail,
          status: row.status,
          createdAt: row.createdAt,
          reviewedAt: row.reviewedAt,
          topicId: row.topicId,
          topicTitle: row.topic?.title ?? null,
          commentId: row.comment?.id ?? row.commentId,
        })),
      )
      .catch(() => [])
    : (await localListReports())
      .filter((report) => report.reporterId === viewer.id)
      .slice(0, 100)
      .map((report) => ({
        id: report.id,
        reason: report.reason,
        detail: report.detail,
        status: report.status,
        createdAt: report.createdAt,
        reviewedAt: report.reviewedAt,
        topicId: report.topicId,
        topicTitle: null,
        commentId: report.commentId,
      }));

  const openCount = reports.filter((item) => item.status === "OPEN" || item.status === "REVIEWING").length;

  return (
    <PageContainer>
      <div className="row" style={{ justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>내 신고 내역</h1>
        <div className="row" style={{ gap: "0.8rem" }}>
          <Link className="text-link" href="/me">내 활동</Link>
          <Link className="text-link" href="/topics">토픽으로 이동</Link>
        </div>
      </div>

      <Card>
        <SectionTitle>진행 현황</SectionTitle>
        <p style={{ margin: "0.55rem 0 0", color: "#6b7280" }}>
          총 {reports.length}건 · 처리 대기 {openCount}건
        </p>
      </Card>

      <div className="list">
        {reports.map((report) => (
          <Card key={report.id}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.6rem" }}>
              <div>
                <strong>{report.reason}</strong>
                <p style={{ margin: "0.35rem 0", color: "#6b7280" }}>{report.detail ?? "상세 설명 없음"}</p>
                <small style={{ color: "#6b7280" }}>
                  접수 {new Date(report.createdAt).toLocaleString("ko-KR")}
                  {report.reviewedAt ? ` · 검토 ${new Date(report.reviewedAt).toLocaleString("ko-KR")}` : ""}
                </small>
              </div>
              <Pill tone={statusTone(report.status)}>{report.status}</Pill>
            </div>

            <p style={{ margin: "0.55rem 0 0", color: "#374151" }}>{statusHint(report.status)}</p>

            {report.topicId ? (
              <p style={{ margin: "0.45rem 0 0" }}>
                <Link className="text-link" href={`/topics/${report.topicId}`}>
                  관련 토픽 보기{report.topicTitle ? ` · ${report.topicTitle}` : ""}
                </Link>
              </p>
            ) : null}

            {report.commentId ? (
              <p style={{ margin: "0.35rem 0 0", color: "#6b7280" }}>댓글 신고 ID: {report.commentId}</p>
            ) : null}
          </Card>
        ))}

        {reports.length === 0 ? (
          <Card>
            아직 접수한 신고가 없습니다. 토픽/댓글 상세 화면에서 신고 버튼을 이용해 제보할 수 있습니다.
          </Card>
        ) : null}
      </div>
    </PageContainer>
  );
}
