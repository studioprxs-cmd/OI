import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, PageContainer, Pill, SectionTitle } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { localListReports } from "@/lib/report-local";

import { BulkModerationActions } from "./BulkModerationActions";
import { ReportActions } from "./ReportActions";

const STATUSES = ["OPEN", "REVIEWING", "CLOSED", "REJECTED"] as const;
const ACTIONABLE_STATUSES = ["OPEN", "REVIEWING"] as const;

const STATUS_PRIORITY_WEIGHT: Record<(typeof STATUSES)[number], number> = {
  OPEN: 3,
  REVIEWING: 2,
  CLOSED: 1,
  REJECTED: 0,
};

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

  const filteredReports = reports
    .filter((report) => {
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
    })
    .sort((a, b) => {
      const statusDiff = STATUS_PRIORITY_WEIGHT[b.status] - STATUS_PRIORITY_WEIGHT[a.status];
      if (statusDiff !== 0) return statusDiff;

      const aTs = new Date(a.createdAt).getTime();
      const bTs = new Date(b.createdAt).getTime();
      return bTs - aTs;
    });

  const actionableReports = reports.filter((report) => (ACTIONABLE_STATUSES as readonly string[]).includes(report.status));
  const hiddenCommentReportCount = reports.filter((report) => report.commentHidden).length;
  const urgentReportCount = reports.filter((report) => report.status === "OPEN").length;
  const filteredOpenIds = filteredReports.filter((report) => report.status === "OPEN").map((report) => report.id);
  const filteredReviewingIds = filteredReports.filter((report) => report.status === "REVIEWING").map((report) => report.id);

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

        <form method="get" className="row moderation-filter-form" style={{ marginTop: "0.7rem", gap: "0.55rem", flexWrap: "wrap" }}>
          <input type="hidden" name="status" value={selectedStatus} />
          <select
            name="type"
            defaultValue={selectedType}
            style={{
              border: "1px solid rgba(15, 23, 42, 0.15)",
              borderRadius: "0.65rem",
              padding: "0.45rem 0.6rem",
              minWidth: "7.2rem",
              flex: "1 1 120px",
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
              minWidth: "0",
              width: "100%",
              flex: "2 1 220px",
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
        <SectionTitle>우선 처리 큐</SectionTitle>
        <div className="row" style={{ marginTop: "0.65rem", flexWrap: "wrap", gap: "0.45rem" }}>
          <Pill tone={actionableReports.length > 0 ? "danger" : "success"}>처리 필요 {actionableReports.length}</Pill>
          <Pill tone={urgentReportCount > 0 ? "danger" : "neutral"}>긴급 OPEN {urgentReportCount}</Pill>
          <Pill>숨김 댓글 {hiddenCommentReportCount}</Pill>
          <Pill>토픽 신고 {reports.filter((report) => !report.commentId).length}</Pill>
          <Pill>댓글 신고 {reports.filter((report) => Boolean(report.commentId)).length}</Pill>
        </div>
        <p style={{ margin: "0.65rem 0 0", color: "#6b7280" }}>
          기본적으로 OPEN/REVIEWING 상태를 먼저 처리하는 것을 권장합니다.
        </p>
      </Card>

      <Card>
        <SectionTitle>정산 현황</SectionTitle>
        <p style={{ margin: "0.55rem 0", color: "#6b7280" }}>
          정산 완료 베팅 {settlement._count.id}건 · 총 베팅 {Number(settlement._sum.amount ?? 0).toLocaleString("ko-KR")} pt · 총 지급{" "}
          {Number(settlement._sum.payoutAmount ?? 0).toLocaleString("ko-KR")} pt
        </p>
      </Card>

      <div className="list">
        <Card>
          <SectionTitle>일괄 트리아지</SectionTitle>
          <div style={{ marginTop: "0.6rem" }}>
            <BulkModerationActions
              openIds={filteredOpenIds}
              reviewingIds={filteredReviewingIds}
              filteredCount={filteredReports.length}
            />
          </div>
        </Card>

        <small style={{ color: "#6b7280" }}>정렬 기준: 상태 우선순위(OPEN → REVIEWING → CLOSED/REJECTED), 이후 최신순</small>
        {selectedStatus === "ALL" && selectedType === "ALL" && !keyword ? (
          <Card>
            <SectionTitle>즉시 확인 권장</SectionTitle>
            <p style={{ margin: "0.45rem 0 0", color: "#6b7280" }}>
              OPEN/REVIEWING 신고 {actionableReports.length}건이 대기 중입니다.
            </p>
          </Card>
        ) : null}

        {filteredReports.map((report) => (
          <Card key={report.id}>
            <div className="row moderation-report-head" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.8rem" }}>
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
              <div className="row" style={{ gap: "0.4rem" }}>
                {report.status === "OPEN" ? <Pill tone="danger">우선 처리</Pill> : null}
                {report.commentId ? <Pill>comment</Pill> : <Pill>topic</Pill>}
              </div>
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
                commentHidden={Boolean(report.commentHidden)}
                topicStatus={report.topicStatus}
              />
            </div>
          </Card>
        ))}
        {filteredReports.length === 0 ? <Card>조건에 맞는 신고가 없습니다.</Card> : null}
      </div>
    </PageContainer>
  );
}
