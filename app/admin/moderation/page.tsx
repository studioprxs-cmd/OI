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
  status: StatusType;
  createdAt: Date | string;
  commentId: string | null;
  reporterNickname?: string;
  reporterEmail?: string;
  commentContent?: string;
  commentHidden?: boolean;
  topicId?: string | null;
  topicTitle?: string;
  topicStatus?: string;
};

type Props = {
  searchParams?: Promise<{ status?: string; type?: string; q?: string }>;
};

export default async function AdminModerationPage({ searchParams }: Props) {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");
  if (viewer.role !== "ADMIN") redirect("/");

  const canUseDb = Boolean(process.env.DATABASE_URL);
  const query = await searchParams;
  const selectedStatus = String(query?.status ?? "ALL").toUpperCase();
  const selectedType = String(query?.type ?? "ALL").toUpperCase();
  const keyword = String(query?.q ?? "").trim().toLowerCase();

  const reports: ReportView[] = canUseDb
    ? await db.report
      .findMany({
        orderBy: { createdAt: "desc" },
        include: {
          reporter: { select: { id: true, nickname: true, email: true } },
          topic: { select: { id: true, title: true, status: true } },
          comment: { select: { id: true, content: true, isHidden: true } },
        },
        take: 100,
      })
      .then((items) =>
        items.map((report) => ({
          id: report.id,
          reason: report.reason,
          detail: report.detail,
          status: report.status as StatusType,
          createdAt: report.createdAt,
          commentId: report.commentId,
          reporterNickname: report.reporter.nickname,
          reporterEmail: report.reporter.email,
          commentContent: report.comment?.content,
          commentHidden: report.comment?.isHidden,
          topicId: report.topicId,
          topicTitle: report.topic?.title,
          topicStatus: report.topic?.status,
        })),
      )
      .catch(() => [])
    : (await localListReports()).map((report) => ({
      id: report.id,
      reason: report.reason,
      detail: report.detail,
      status: report.status as StatusType,
      createdAt: report.createdAt,
      commentId: report.commentId,
      topicId: report.topicId,
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

  const filteredReports = reports.filter((report) => {
    if (selectedStatus !== "ALL" && report.status !== selectedStatus) return false;

    const reportType = report.commentId ? "COMMENT" : "TOPIC";
    if (selectedType !== "ALL" && selectedType !== reportType) return false;

    if (!keyword) return true;

    const haystack = [
      report.reason,
      report.detail,
      report.reporterNickname,
      report.reporterEmail,
      report.commentContent,
      report.topicTitle,
      report.topicId,
      report.id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(keyword);
  });

  return (
    <PageContainer>
      <div className="row" style={{ justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Admin · Moderation & Settlement</h1>
        <div className="row" style={{ gap: "0.9rem" }}>
          <Link className="text-link" href="/admin/topics">
            토픽 관리로 이동
          </Link>
          <Link className="text-link" href="/admin/moderation?status=ALL">
            필터 초기화
          </Link>
        </div>
      </div>

      <Card>
        <SectionTitle>신고 현황</SectionTitle>
        <div className="row" style={{ marginTop: "0.75rem", flexWrap: "wrap", gap: "0.55rem" }}>
          <Link className="text-link" href="/admin/moderation?status=ALL&type=ALL">
            ALL {reports.length}
          </Link>
          {STATUSES.map((status) => (
            <Link key={status} className="text-link" href={`/admin/moderation?status=${status}&type=${selectedType}`}>
              <Pill tone={selectedStatus === status ? "danger" : "neutral"}>
                {status} {counts[status]}
              </Pill>
            </Link>
          ))}
        </div>

        <form method="get" className="row" style={{ marginTop: "0.7rem", gap: "0.55rem", flexWrap: "wrap" }}>
          <input type="hidden" name="status" value={selectedStatus} />
          <select
            name="type"
            defaultValue={selectedType}
            style={{
              border: "1px solid rgba(15, 23, 42, 0.15)",
              borderRadius: "0.65rem",
              padding: "0.45rem 0.6rem",
              minWidth: "8rem",
            }}
          >
            <option value="ALL">전체 타입</option>
            <option value="COMMENT">댓글 신고</option>
            <option value="TOPIC">토픽 신고</option>
          </select>
          <input
            name="q"
            defaultValue={query?.q ?? ""}
            placeholder="신고/토픽/유저 검색"
            style={{
              border: "1px solid rgba(15, 23, 42, 0.15)",
              borderRadius: "0.65rem",
              padding: "0.45rem 0.6rem",
              minWidth: "15rem",
              flex: "1 1 220px",
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

      <Card>
        <SectionTitle>정산 현황</SectionTitle>
        <p style={{ margin: "0.55rem 0", color: "#6b7280" }}>
          정산 완료 베팅 {settlement._count.id}건 · 총 베팅 {Number(settlement._sum.amount ?? 0).toLocaleString("ko-KR")} pt · 총 지급{" "}
          {Number(settlement._sum.payoutAmount ?? 0).toLocaleString("ko-KR")} pt
        </p>
      </Card>

      <div className="list">
        {filteredReports.map((report) => (
          <Card key={report.id}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.8rem" }}>
              <div>
                <strong>{report.reason}</strong>
                <p style={{ margin: "0.35rem 0", color: "#6b7280" }}>{report.detail ?? "상세 설명 없음"}</p>
                <small style={{ color: "#6b7280" }}>
                  {new Date(report.createdAt).toLocaleString("ko-KR")} · 상태 {report.status}
                  {report.reporterNickname ? ` · 신고자 ${report.reporterNickname}` : ""}
                  {report.reporterEmail ? ` (${report.reporterEmail})` : ""}
                </small>
                {report.topicId ? (
                  <p style={{ margin: "0.3rem 0 0" }}>
                    <Link href={`/topics/${report.topicId}`} className="text-link">
                      토픽 보기{report.topicTitle ? ` · ${report.topicTitle}` : ""}
                    </Link>
                    {report.topicStatus ? <span style={{ marginLeft: "0.4rem", color: "#6b7280" }}>({report.topicStatus})</span> : null}
                  </p>
                ) : null}
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
              <ReportActions
                reportId={report.id}
                initialStatus={report.status}
                hasComment={Boolean(report.commentId)}
                hasTopic={Boolean(report.topicId)}
              />
            </div>
          </Card>
        ))}
        {filteredReports.length === 0 ? <Card>조건에 맞는 신고가 없습니다.</Card> : null}
      </div>
    </PageContainer>
  );
}
