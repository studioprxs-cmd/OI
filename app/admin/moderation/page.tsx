import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, PageContainer, Pill, SectionTitle } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { localListReports } from "@/lib/report-local";

import { ReportActions } from "./ReportActions";

const STATUSES = ["OPEN", "REVIEWING", "CLOSED", "REJECTED"] as const;

type StatusType = (typeof STATUSES)[number];

type ReportView = {
  id: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: Date | string;
  commentId: string | null;
  commentContent?: string;
  commentHidden?: boolean;
};

export default async function AdminModerationPage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");
  if (viewer.role !== "ADMIN") redirect("/");

  const canUseDb = Boolean(process.env.DATABASE_URL);

  const reports: ReportView[] = canUseDb
    ? await db.report
      .findMany({
        orderBy: { createdAt: "desc" },
        include: {
          comment: { select: { id: true, content: true, isHidden: true } },
        },
        take: 100,
      })
      .then((items) =>
        items.map((report) => ({
          id: report.id,
          reason: report.reason,
          detail: report.detail,
          status: report.status,
          createdAt: report.createdAt,
          commentId: report.commentId,
          commentContent: report.comment?.content,
          commentHidden: report.comment?.isHidden,
        })),
      )
      .catch(() => [])
    : (await localListReports()).map((report) => ({
      id: report.id,
      reason: report.reason,
      detail: report.detail,
      status: report.status,
      createdAt: report.createdAt,
      commentId: report.commentId,
    }));

  const settlement = canUseDb
    ? await db.bet
      .aggregate({
        _count: { id: true },
        _sum: { amount: true, payoutAmount: true },
        where: { settled: true },
      })
      .catch(() => ({ _count: { id: 0 }, _sum: { amount: 0, payoutAmount: 0 } }))
    : { _count: { id: 0 }, _sum: { amount: 0, payoutAmount: 0 } };

  const counts = Object.fromEntries(
    STATUSES.map((status) => [status, reports.filter((report) => report.status === status).length]),
  ) as Record<StatusType, number>;

  return (
    <PageContainer>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Admin · Moderation & Settlement</h1>
        <Link className="text-link" href="/admin/topics">
          토픽 관리로 이동
        </Link>
      </div>

      <Card>
        <SectionTitle>신고 현황</SectionTitle>
        <div className="row" style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
          {STATUSES.map((status) => (
            <Pill key={status}>
              {status} {counts[status]}
            </Pill>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>정산 현황</SectionTitle>
        <p style={{ margin: "0.55rem 0", color: "#6b7280" }}>
          정산 완료 베팅 {settlement._count.id}건 · 총 베팅 {Number(settlement._sum.amount ?? 0).toLocaleString("ko-KR")} pt · 총 지급{" "}
          {Number(settlement._sum.payoutAmount ?? 0).toLocaleString("ko-KR")} pt
        </p>
      </Card>

      <div className="list">
        {reports.map((report) => (
          <Card key={report.id}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong>{report.reason}</strong>
                <p style={{ margin: "0.35rem 0", color: "#6b7280" }}>{report.detail ?? "상세 설명 없음"}</p>
                <small style={{ color: "#6b7280" }}>
                  {new Date(report.createdAt).toLocaleString("ko-KR")} · 상태 {report.status}
                </small>
              </div>
              {report.commentId ? <Pill>comment</Pill> : <Pill>topic</Pill>}
            </div>

            {report.commentContent ? (
              <p style={{ margin: "0.6rem 0 0", color: "#111827" }}>
                코멘트: {report.commentContent}
                {report.commentHidden ? " (숨김 처리됨)" : ""}
              </p>
            ) : null}

            <div style={{ marginTop: "0.6rem" }}>
              <ReportActions reportId={report.id} />
            </div>
          </Card>
        ))}
        {reports.length === 0 ? <Card>신고가 없습니다.</Card> : null}
      </div>
    </PageContainer>
  );
}
