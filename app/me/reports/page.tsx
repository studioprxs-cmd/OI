import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, PageContainer, Pill, SectionTitle } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { localListReports } from "@/lib/report-local";

import { WithdrawReportButton } from "./WithdrawReportButton";

type ReportRow = {
  id: string;
  reason: string;
  detail: string | null;
  status: "OPEN" | "REVIEWING" | "CLOSED" | "REJECTED";
  createdAt: Date | string;
  reviewedAt: Date | string | null;
  topicId: string | null;
  topicTitle: string | null;
  topicStatus: string | null;
  commentId: string | null;
  commentHidden: boolean | null;
};

type Props = {
  searchParams?: Promise<{ status?: string }>;
};

const FILTERS = ["ALL", "OPEN", "REVIEWING", "CLOSED", "REJECTED"] as const;
type FilterType = (typeof FILTERS)[number];

function statusTone(status: ReportRow["status"]): "neutral" | "success" | "danger" {
  if (status === "CLOSED") return "success";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

function statusHint(status: ReportRow["status"]): string {
  if (status === "OPEN") return "접수 완료 · 운영팀 분류 대기";
  if (status === "REVIEWING") return "운영팀 검토 진행 중";
  if (status === "CLOSED") return "처리 완료";
  return "처리 반려";
}

function isActionable(status: ReportRow["status"]) {
  return status === "OPEN" || status === "REVIEWING";
}

function moderationOutcome(report: ReportRow): string | null {
  if (report.status !== "CLOSED") return null;

  const changes: string[] = [];

  if (report.commentId && report.commentHidden === true) {
    changes.push("신고한 댓글이 숨김 처리되었습니다");
  }

  if (report.topicStatus === "LOCKED") {
    changes.push("관련 토픽이 잠금 처리되었습니다");
  }

  if (report.topicStatus === "CANCELED") {
    changes.push("관련 토픽이 취소 처리되었습니다");
  }

  if (changes.length === 0) {
    return "운영팀 검토가 완료되었습니다.";
  }

  return changes.join(" · ");
}

function elapsedLabel(createdAt: Date | string): string {
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  const elapsedHours = Math.max(0, Math.floor(elapsedMs / (1000 * 60 * 60)));
  if (elapsedHours < 1) return "방금 접수";
  if (elapsedHours < 24) return `${elapsedHours}시간 경과`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}일 경과`;
}

export default async function MyReportsPage({ searchParams }: Props) {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");

  const canUseDb = Boolean(process.env.DATABASE_URL);
  const query = await searchParams;
  const selectedFilterRaw = String(query?.status ?? "ALL").toUpperCase();
  const selectedFilter: FilterType = FILTERS.includes(selectedFilterRaw as FilterType)
    ? (selectedFilterRaw as FilterType)
    : "ALL";

  const reports: ReportRow[] = canUseDb
    ? await db.report
      .findMany({
        where: { reporterId: viewer.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          topic: { select: { id: true, title: true, status: true } },
          comment: { select: { id: true, isHidden: true } },
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
          topicStatus: row.topic?.status ?? null,
          commentId: row.comment?.id ?? row.commentId,
          commentHidden: row.comment?.isHidden ?? null,
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
        topicStatus: null,
        commentId: report.commentId,
        commentHidden: null,
      }));

  const counts = {
    ALL: reports.length,
    OPEN: reports.filter((item) => item.status === "OPEN").length,
    REVIEWING: reports.filter((item) => item.status === "REVIEWING").length,
    CLOSED: reports.filter((item) => item.status === "CLOSED").length,
    REJECTED: reports.filter((item) => item.status === "REJECTED").length,
  } as const;

  const filteredReports = selectedFilter === "ALL" ? reports : reports.filter((item) => item.status === selectedFilter);
  const openCount = counts.OPEN + counts.REVIEWING;

  return (
    <PageContainer>
      <section className="my-reports-hero">
        <div className="row" style={{ justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
          <div>
            <p className="admin-hero-eyebrow">Trust center</p>
            <h1 className="my-reports-title">내 신고 내역</h1>
            <p className="my-reports-subtitle">신고 진행 상태와 처리 결과를 한 화면에서 확인할 수 있어요.</p>
          </div>
          <div className="row" style={{ gap: "0.8rem" }}>
            <Link className="text-link" href="/me">내 활동</Link>
            <Link className="text-link" href="/topics">토픽으로 이동</Link>
          </div>
        </div>

        <div className="my-reports-kpi-grid">
          <article className="my-reports-kpi-card">
            <span>전체 신고</span>
            <strong>{counts.ALL}</strong>
            <small>최근 접수 기준</small>
          </article>
          <article className="my-reports-kpi-card is-warning">
            <span>진행 중</span>
            <strong>{openCount}</strong>
            <small>OPEN + REVIEWING</small>
          </article>
          <article className="my-reports-kpi-card is-success">
            <span>처리 완료</span>
            <strong>{counts.CLOSED}</strong>
            <small>조치 완료 기준</small>
          </article>
          <article className="my-reports-kpi-card is-danger">
            <span>반려</span>
            <strong>{counts.REJECTED}</strong>
            <small>운영 기준 미충족</small>
          </article>
        </div>
      </section>

      <Card>
        <SectionTitle>상태 필터</SectionTitle>
        <div className="chip-row-scroll" style={{ marginTop: "0.65rem" }}>
          {FILTERS.map((filter) => (
            <Link
              key={filter}
              href={`/me/reports?status=${filter}`}
              className={`filter-chip${selectedFilter === filter ? " is-active" : ""}`}
            >
              {filter} {counts[filter]}
            </Link>
          ))}
        </div>
      </Card>

      <div className="list">
        {filteredReports.map((report) => (
          <Card key={report.id} className="my-report-card">
            <div className="my-report-head">
              <div>
                <p className="my-report-kicker">{elapsedLabel(report.createdAt)}</p>
                <h2 className="my-report-reason">{report.reason}</h2>
              </div>
              <Pill tone={statusTone(report.status)}>{report.status}</Pill>
            </div>

            <p className="my-report-detail">{report.detail ?? "상세 설명 없이 접수된 신고입니다."}</p>

            <div className="my-report-meta-row">
              <span>접수 {new Date(report.createdAt).toLocaleString("ko-KR")}</span>
              {report.reviewedAt ? <span>검토 {new Date(report.reviewedAt).toLocaleString("ko-KR")}</span> : null}
            </div>

            <p className="my-report-status-hint">{statusHint(report.status)}</p>

            {isActionable(report.status) ? (
              <div style={{ marginTop: "0.55rem" }}>
                <WithdrawReportButton reportId={report.id} />
              </div>
            ) : null}

            {moderationOutcome(report) ? (
              <p className="my-report-outcome">{moderationOutcome(report)}</p>
            ) : null}

            {report.topicId ? (
              <p style={{ margin: "0.5rem 0 0" }}>
                <Link className="text-link" href={`/topics/${report.topicId}`}>
                  관련 토픽 보기{report.topicTitle ? ` · ${report.topicTitle}` : ""}
                </Link>
              </p>
            ) : null}

            {report.commentId ? (
              <p className="my-report-comment-id">댓글 신고 ID: {report.commentId}</p>
            ) : null}
          </Card>
        ))}

        {filteredReports.length === 0 ? (
          <Card className="state-panel state-panel-success">
            <div className="state-panel-head">
              <h3 className="state-panel-title">해당 필터의 신고가 없습니다</h3>
              <p className="state-panel-description">새로운 이슈를 발견하면 토픽/댓글 화면의 신고 버튼으로 바로 제보할 수 있어요.</p>
            </div>
            <div className="state-panel-actions">
              <Link href="/topics" className="btn btn-primary">토픽 둘러보기</Link>
              <Link href="/me/reports?status=ALL" className="btn btn-secondary">전체 내역 보기</Link>
            </div>
          </Card>
        ) : null}
      </div>
    </PageContainer>
  );
}
