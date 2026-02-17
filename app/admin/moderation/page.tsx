import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminSectionTabs, Card, PageContainer, Pill, SectionTitle, StatePanel } from "@/components/ui";
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

  const settledWithNullPayoutCount = canUseDb
    ? await db.bet.count({ where: { settled: true, payoutAmount: null } }).catch(() => 0)
    : 0;

  const unresolvedSettledBacklogCount = canUseDb
    ? await db.bet
      .count({
        where: {
          settled: false,
          topic: { status: "RESOLVED" },
        },
      })
      .catch(() => 0)
    : 0;

  const resolvedWithoutResolutionCount = canUseDb
    ? await db.topic
      .count({
        where: {
          status: "RESOLVED",
          resolution: null,
        },
      })
      .catch(() => 0)
    : 0;

  const unresolvedSettledBacklogTopics = canUseDb
    ? await db.topic
      .findMany({
        where: {
          status: "RESOLVED",
          bets: {
            some: {
              settled: false,
            },
          },
        },
        select: {
          id: true,
          title: true,
          status: true,
          _count: {
            select: {
              bets: {
                where: {
                  settled: false,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
      })
      .catch(() => [])
    : [];

  const resolvedWithoutResolutionTopics = canUseDb
    ? await db.topic
      .findMany({
        where: {
          status: "RESOLVED",
          resolution: null,
        },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
      })
      .catch(() => [])
    : [];

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
  const nowTs = Date.now();
  const staleActionableCount = actionableReports.filter((report) => nowTs - new Date(report.createdAt).getTime() >= 24 * 60 * 60 * 1000).length;
  const superStaleActionableCount = actionableReports.filter((report) => nowTs - new Date(report.createdAt).getTime() >= 48 * 60 * 60 * 1000).length;
  const filteredOpenIds = filteredReports.filter((report) => report.status === "OPEN").map((report) => report.id);
  const filteredReviewingIds = filteredReports.filter((report) => report.status === "REVIEWING").map((report) => report.id);
  const totalSettledAmount = Number(settlement._sum.amount ?? 0);
  const totalPayoutAmount = Number(settlement._sum.payoutAmount ?? 0);
  const payoutRatio = totalSettledAmount > 0 ? Math.round((totalPayoutAmount / totalSettledAmount) * 100) : 0;
  const integrityIssueTotal = settledWithNullPayoutCount + unresolvedSettledBacklogCount + resolvedWithoutResolutionCount;
  const hasCriticalIntegrityIssue = settledWithNullPayoutCount > 0 || unresolvedSettledBacklogCount > 0;
  const queueRiskLevel = superStaleActionableCount > 0 ? "high" : staleActionableCount > 0 ? "medium" : "low";

  return (
    <PageContainer>
      <section className="admin-hero-shell">
        <div className="row admin-header-row">
          <h1 style={{ margin: 0 }}>Admin · Moderation & Settlement</h1>
          <div className="row admin-header-links">
            <Link className="text-link" href="/admin/topics">
              토픽 관리로 이동
            </Link>
            <Link className="text-link" href="/admin/moderation?status=ALL">
              필터 초기화
            </Link>
          </div>
        </div>

        <div className="admin-pulse-grid" style={{ marginTop: "0.75rem" }}>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">즉시 대응 큐</p>
            <strong className="admin-kpi-value">{actionableReports.length}건</strong>
            <span className="admin-kpi-meta">OPEN · REVIEWING 묶음</span>
          </div>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">SLA 위험</p>
            <strong className="admin-kpi-value">{superStaleActionableCount}건</strong>
            <span className="admin-kpi-meta">48시간 이상 미처리</span>
          </div>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">정산 무결성</p>
            <strong className="admin-kpi-value">{settledWithNullPayoutCount + unresolvedSettledBacklogCount + resolvedWithoutResolutionCount}건</strong>
            <span className="admin-kpi-meta">누락 · 백로그 · 불일치 합계</span>
          </div>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">배당률</p>
            <strong className="admin-kpi-value">{payoutRatio}%</strong>
            <span className="admin-kpi-meta">총 지급 / 총 베팅</span>
          </div>
        </div>
      </section>

      <AdminSectionTabs
        items={[
          { href: "/admin/topics", label: "토픽 운영", active: false },
          { href: "/admin/moderation", label: "신고/정산", badge: actionableReports.length, active: true },
          { href: "/admin/moderation?status=OPEN", label: "긴급 OPEN", badge: urgentReportCount, active: false },
        ]}
      />

      <StatePanel
        title={hasCriticalIntegrityIssue ? "정산/무결성 긴급 점검" : "정산 무결성 상태 안정"}
        description={hasCriticalIntegrityIssue
          ? `지급값 누락 또는 정산 백로그가 ${integrityIssueTotal}건 감지되었습니다. 우선 정산 데이터 정합성을 확인한 뒤 후속 처리하세요.`
          : integrityIssueTotal > 0
            ? `치명 이슈는 없지만 결과 레코드 불일치 ${integrityIssueTotal}건이 있습니다. 다음 배치 전 정리 권장.`
            : "누락·백로그·결과 불일치 이슈가 없습니다. 현재 정산 무결성 기준을 만족합니다."}
        tone={hasCriticalIntegrityIssue ? "warning" : integrityIssueTotal > 0 ? "warning" : "success"}
        actions={(
          <>
            <Link href="/admin/topics" className="btn btn-primary">토픽 정산 상태 점검</Link>
            <Link href="/admin/moderation?status=OPEN" className="btn btn-secondary">OPEN 신고 먼저 처리</Link>
          </>
        )}
      />

      <Card>
        <SectionTitle>모바일 빠른 실행</SectionTitle>
        <p style={{ margin: "0.5rem 0 0", color: "#4b6355" }}>
          엄지 동선 기준으로 자주 쓰는 운영 작업을 한 번에 배치했습니다.
        </p>
        <div className="admin-quick-action-grid" style={{ marginTop: "0.75rem" }}>
          <Link href="/admin/moderation?status=OPEN" className="admin-quick-action-btn">
            OPEN 즉시 처리 ({urgentReportCount})
          </Link>
          <Link href="/admin/moderation?status=REVIEWING" className="admin-quick-action-btn">
            REVIEWING 이어서 처리 ({counts.REVIEWING})
          </Link>
          <Link href="/admin/topics" className="admin-quick-action-btn">
            토픽 정산 점검
          </Link>
          <Link href="/admin/moderation?status=ALL&type=TOPIC" className="admin-quick-action-btn">
            토픽 신고 집중 보기
          </Link>
        </div>
      </Card>

      <Card>
        <SectionTitle>운영 컨트롤 타워</SectionTitle>
        <p style={{ margin: "0.5rem 0 0", color: "#4b6355" }}>
          모바일/운영 환경 기준으로 즉시 대응 큐와 정산 무결성 상태를 한 번에 점검합니다.
        </p>
        <div className="admin-kpi-grid" style={{ marginTop: "0.8rem" }}>
          <div className="admin-kpi-tile">
            <p className="admin-kpi-label">즉시 처리</p>
            <strong className="admin-kpi-value">{actionableReports.length}건</strong>
            <span className="admin-kpi-meta">OPEN + REVIEWING</span>
          </div>
          <div className="admin-kpi-tile">
            <p className="admin-kpi-label">24시간 초과</p>
            <strong className="admin-kpi-value">{staleActionableCount}건</strong>
            <span className="admin-kpi-meta">지연 처리 경고</span>
          </div>
          <div className="admin-kpi-tile">
            <p className="admin-kpi-label">48시간 초과</p>
            <strong className="admin-kpi-value">{superStaleActionableCount}건</strong>
            <span className="admin-kpi-meta">SLA 위험</span>
          </div>
          <div className="admin-kpi-tile">
            <p className="admin-kpi-label">정산 배당률</p>
            <strong className="admin-kpi-value">{payoutRatio}%</strong>
            <span className="admin-kpi-meta">총 지급 / 총 베팅</span>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>신고 현황</SectionTitle>
        <div className="chip-row-scroll" style={{ marginTop: "0.75rem" }} aria-label="신고 상태 필터">
          <Link
            className={`filter-chip${selectedStatus === "ALL" ? " is-active" : ""}`}
            href="/admin/moderation?status=ALL&type=ALL"
          >
            ALL {reports.length}
          </Link>
          {STATUSES.map((status) => (
            <Link
              key={status}
              className={`filter-chip${selectedStatus === status ? " is-active" : ""}`}
              href={`/admin/moderation?status=${status}&type=${selectedType}`}
            >
              {status} {counts[status]}
            </Link>
          ))}
        </div>

        <form method="get" className="row moderation-filter-form" style={{ marginTop: "0.7rem", gap: "0.55rem", flexWrap: "wrap" }}>
          <input type="hidden" name="status" value={selectedStatus} />
          <select
            name="type"
            defaultValue={selectedType}
            className="input moderation-filter-type"
          >
            <option value="ALL">전체 타입</option>
            <option value="COMMENT">댓글 신고</option>
            <option value="TOPIC">토픽 신고</option>
          </select>
          <input
            name="q"
            defaultValue={query?.q ?? ""}
            placeholder="신고/토픽/유저 검색"
            className="input moderation-filter-search"
          />
          <button
            type="submit"
            className="btn btn-primary moderation-filter-submit"
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
          <Pill tone={queueRiskLevel === "high" ? "danger" : queueRiskLevel === "medium" ? "neutral" : "success"}>
            SLA 위험도 {queueRiskLevel === "high" ? "높음" : queueRiskLevel === "medium" ? "주의" : "안정"}
          </Pill>
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
          정산 완료 베팅 {settlement._count.id}건 · 총 베팅 {totalSettledAmount.toLocaleString("ko-KR")} pt · 총 지급 {totalPayoutAmount.toLocaleString("ko-KR")} pt
        </p>
        <div className="row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
          <Pill tone={settledWithNullPayoutCount > 0 ? "danger" : "success"}>정산값 누락 {settledWithNullPayoutCount}</Pill>
          <Pill tone={unresolvedSettledBacklogCount > 0 ? "danger" : "success"}>정산 대기 백로그 {unresolvedSettledBacklogCount}</Pill>
          <Pill tone={resolvedWithoutResolutionCount > 0 ? "danger" : "success"}>해결-결과 불일치 {resolvedWithoutResolutionCount}</Pill>
        </div>
        <div className="admin-integrity-strip" style={{ marginTop: "0.7rem" }}>
          <span className={settledWithNullPayoutCount > 0 ? "is-danger" : "is-ok"}>지급값 누락</span>
          <span className={unresolvedSettledBacklogCount > 0 ? "is-danger" : "is-ok"}>백로그</span>
          <span className={resolvedWithoutResolutionCount > 0 ? "is-danger" : "is-ok"}>결과 레코드</span>
          <span className="is-neutral">모바일 우선 점검 추천</span>
        </div>
      </Card>

      {(unresolvedSettledBacklogTopics.length > 0 || resolvedWithoutResolutionTopics.length > 0) ? (
        <Card>
          <SectionTitle>정산 무결성 이슈 상세</SectionTitle>
          <div className="integrity-grid" style={{ marginTop: "0.65rem" }}>
            {unresolvedSettledBacklogTopics.length > 0 ? (
              <div className="integrity-card">
                <strong>RESOLVED 상태인데 미정산 베팅이 남은 토픽</strong>
                <ul className="simple-list" style={{ marginTop: "0.45rem" }}>
                  {unresolvedSettledBacklogTopics.map((topic) => (
                    <li key={topic.id}>
                      <Link href={`/admin/topics/${topic.id}/resolve`} className="text-link">
                        {topic.title}
                      </Link>
                      <small style={{ color: "#6b7280" }}> · 미정산 {topic._count.bets}건</small>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {resolvedWithoutResolutionTopics.length > 0 ? (
              <div className="integrity-card">
                <strong>결과 레코드 없이 RESOLVED 처리된 토픽</strong>
                <ul className="simple-list" style={{ marginTop: "0.45rem" }}>
                  {resolvedWithoutResolutionTopics.map((topic) => (
                    <li key={topic.id}>
                      <Link href={`/admin/topics/${topic.id}/resolve`} className="text-link">
                        {topic.title}
                      </Link>
                      <small style={{ color: "#6b7280" }}> · {new Date(topic.createdAt).toLocaleDateString("ko-KR")}</small>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

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
          <StatePanel
            title="즉시 확인 권장"
            description={`OPEN/REVIEWING 신고 ${actionableReports.length}건이 대기 중입니다.`}
            tone={actionableReports.length > 0 ? "warning" : "success"}
            actions={
              actionableReports.length > 0
                ? <Link href="/admin/moderation?status=OPEN" className="btn btn-primary">OPEN 신고 먼저 보기</Link>
                : null
            }
          />
        ) : null}

        {filteredReports.map((report) => (
          <Card key={report.id}>
            <article className="moderation-report-card">
              <div className="moderation-report-headline">
                <div>
                  <h3 className="moderation-report-title">{report.reason}</h3>
                  <p className="moderation-report-detail">{report.detail ?? "상세 설명 없음"}</p>
                  <small className="moderation-report-meta">
                    {new Date(report.createdAt).toLocaleString("ko-KR")} · 상태 {report.status}
                    {report.reporterNickname ? ` · 신고자 ${report.reporterNickname}` : ""}
                    {report.reporterEmail ? ` (${report.reporterEmail})` : ""}
                  </small>
                  {report.topicId ? (
                    <p className="moderation-report-context">
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
                <p className="moderation-report-comment">
                  코멘트: {report.commentContent}
                  {report.commentHidden ? " (숨김 처리됨)" : ""}
                </p>
              ) : null}

              <div className="moderation-report-actions">
                <ReportActions
                  reportId={report.id}
                  initialStatus={report.status}
                  hasComment={Boolean(report.commentId)}
                  hasTopic={Boolean(report.topicId)}
                  commentHidden={Boolean(report.commentHidden)}
                  topicStatus={report.topicStatus}
                />
              </div>
            </article>
          </Card>
        ))}
        {filteredReports.length === 0 ? (
          <StatePanel
            title="조건에 맞는 신고가 없습니다"
            description="필터를 완화하거나 상태를 ALL로 바꿔 다시 확인해보세요."
            actions={<Link href="/admin/moderation?status=ALL&type=ALL" className="btn btn-secondary">필터 초기화</Link>}
          />
        ) : null}
      </div>

      <div className="admin-mobile-dock" aria-label="모바일 운영 빠른 실행">
        <Link href="/admin/moderation?status=OPEN" className="admin-quick-action-btn">OPEN {urgentReportCount}</Link>
        <Link href="/admin/moderation?status=REVIEWING" className="admin-quick-action-btn">REVIEW {counts.REVIEWING}</Link>
        <Link href="/admin/topics" className="admin-quick-action-btn">정산 점검</Link>
      </div>
      <div className="admin-mobile-dock-spacer" aria-hidden />
    </PageContainer>
  );
}
