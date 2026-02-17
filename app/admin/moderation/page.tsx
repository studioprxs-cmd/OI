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

function getReportPriority(status: StatusType, elapsedHours: number): { label: string; tone: "danger" | "neutral" | "success" } {
  if (status === "OPEN" && elapsedHours >= 48) return { label: "Critical", tone: "danger" };
  if (status === "OPEN") return { label: "High", tone: "danger" };
  if (status === "REVIEWING" && elapsedHours >= 24) return { label: "Aging", tone: "neutral" };
  if (status === "REVIEWING") return { label: "Active", tone: "neutral" };
  return { label: "Closed", tone: "success" };
}

export default async function AdminModerationPage({ searchParams }: Props) {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");
  if (viewer.role !== "ADMIN") redirect("/");

  const canUseDb = Boolean(process.env.DATABASE_URL);
  const query = await searchParams;
  const selectedStatus = String(query?.status ?? "ALL").toUpperCase();
  const selectedType = String(query?.type ?? "ALL").toUpperCase();
  const keyword = String(query?.q ?? "").trim().toLowerCase();
  const rawKeyword = String(query?.q ?? "").trim();

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

  const nonPositiveBetAmountCount = canUseDb
    ? await db.bet
      .count({
        where: {
          amount: {
            lte: 0,
          },
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
  const activeFilterTokens = [
    selectedStatus !== "ALL" ? `상태 ${selectedStatus}` : null,
    selectedType !== "ALL" ? `타입 ${selectedType}` : null,
    rawKeyword ? `검색어 “${rawKeyword}”` : null,
  ].filter(Boolean) as string[];
  const closedCount = counts.CLOSED;
  const rejectedCount = counts.REJECTED;
  const resolvedReportCount = closedCount + rejectedCount;
  const totalSettledAmount = Number(settlement._sum.amount ?? 0);
  const totalPayoutAmount = Number(settlement._sum.payoutAmount ?? 0);
  const payoutRatio = totalSettledAmount > 0 ? Math.round((totalPayoutAmount / totalSettledAmount) * 100) : 0;
  const settlementGapAmount = totalSettledAmount - totalPayoutAmount;
  const settlementGapAbs = Math.abs(settlementGapAmount);
  const settlementBalanceLabel = settlementGapAbs === 0 ? "균형" : settlementGapAmount > 0 ? "미지급 여지" : "과지급 의심";
  const hasPayoutRatioOutlier = settlement._count.id >= 5 && (payoutRatio < 90 || payoutRatio > 110);
  const integrityIssueTotal = settledWithNullPayoutCount + unresolvedSettledBacklogCount + resolvedWithoutResolutionCount + nonPositiveBetAmountCount + (hasPayoutRatioOutlier ? 1 : 0);
  const hasCriticalIntegrityIssue = settledWithNullPayoutCount > 0 || unresolvedSettledBacklogCount > 0 || nonPositiveBetAmountCount > 0 || hasPayoutRatioOutlier;
  const queueRiskLevel = superStaleActionableCount > 0 ? "high" : staleActionableCount > 0 ? "medium" : "low";
  const oldestActionableHours = actionableReports.length > 0
    ? Math.max(...actionableReports.map((report) => Math.floor((nowTs - new Date(report.createdAt).getTime()) / (1000 * 60 * 60))))
    : 0;
  const integritySeverityLabel = hasCriticalIntegrityIssue ? "긴급" : integrityIssueTotal > 0 ? "주의" : "안정";
  const integrityRiskScore = Math.min(100, (settledWithNullPayoutCount * 40) + (unresolvedSettledBacklogCount * 25) + (resolvedWithoutResolutionCount * 15) + (nonPositiveBetAmountCount * 30) + (hasPayoutRatioOutlier ? 20 : 0));
  const queueStressScore = Math.min(100, (urgentReportCount * 10) + (superStaleActionableCount * 24) + (staleActionableCount * 8));
  const settlementConfidence = integrityRiskScore === 0 ? "높음" : integrityRiskScore <= 30 ? "보통" : "낮음";
  const priorityReports = filteredReports
    .filter((report) => {
      if (report.status !== "OPEN" && report.status !== "REVIEWING") return false;
      const elapsedHours = Math.floor((Date.now() - new Date(report.createdAt).getTime()) / (1000 * 60 * 60));
      return report.status === "OPEN" || elapsedHours >= 24;
    })
    .slice(0, 5);
  const spotlightReports = priorityReports.slice(0, 3);

  const integrityWatchItems = [
    {
      key: "null-payout",
      label: "지급값 누락",
      count: settledWithNullPayoutCount,
      description: "settled=true인데 payoutAmount가 비어 있는 건",
      href: "/admin/topics?status=RESOLVED",
      actionLabel: "RESOLVED 토픽 점검",
      tone: settledWithNullPayoutCount > 0 ? "danger" : "ok",
    },
    {
      key: "settlement-backlog",
      label: "정산 백로그",
      count: unresolvedSettledBacklogCount,
      description: "RESOLVED 상태지만 미정산 베팅이 남은 건",
      href: "/admin/topics?status=RESOLVED",
      actionLabel: "백로그 우선 처리",
      tone: unresolvedSettledBacklogCount > 0 ? "danger" : "ok",
    },
    {
      key: "resolution-mismatch",
      label: "결과 레코드 불일치",
      count: resolvedWithoutResolutionCount,
      description: "RESOLVED 상태인데 resolution 레코드가 없는 건",
      href: "/admin/topics?status=RESOLVED",
      actionLabel: "결과 레코드 복구",
      tone: resolvedWithoutResolutionCount > 0 ? "warning" : "ok",
    },
    {
      key: "non-positive-amount",
      label: "비정상 베팅 금액",
      count: nonPositiveBetAmountCount,
      description: "amount <= 0인 베팅 데이터",
      href: "/admin/topics?status=ALL",
      actionLabel: "베팅 데이터 점검",
      tone: nonPositiveBetAmountCount > 0 ? "danger" : "ok",
    },
    {
      key: "payout-ratio-outlier",
      label: "배당률 밴드 이탈",
      count: hasPayoutRatioOutlier ? 1 : 0,
      description: "정산 5건 이상에서 payout ratio가 90~110% 범위를 벗어난 상태",
      href: "/admin/moderation?status=ALL",
      actionLabel: "정산 레저 재검토",
      tone: hasPayoutRatioOutlier ? "warning" : "ok",
    },
  ] as const;

  const nextActionLabel = urgentReportCount > 0
    ? `OPEN 신고 ${urgentReportCount}건부터 처리`
    : counts.REVIEWING > 0
      ? `REVIEWING 신고 ${counts.REVIEWING}건 정리`
      : integrityIssueTotal > 0
        ? `정산 무결성 이슈 ${integrityIssueTotal}건 점검`
        : "긴급 작업 없음 · 모니터링 유지";
  const queueSlaLabel = superStaleActionableCount > 0
    ? "위험"
    : staleActionableCount > 0
      ? "주의"
      : "정상";
  const dataModeLabel = canUseDb ? "Live DB" : "Local fallback";
  const operationsChecklist = [
    {
      label: "OPEN 큐 1차 트리아지",
      value: `${urgentReportCount}건`,
      tone: urgentReportCount > 0 ? "danger" : "ok",
      hint: "신규 신고를 즉시 REVIEWING 또는 종료로 이동",
    },
    {
      label: "48h+ 지연 처리",
      value: `${superStaleActionableCount}건`,
      tone: superStaleActionableCount > 0 ? "danger" : staleActionableCount > 0 ? "warning" : "ok",
      hint: "SLA 위험 신고를 우선 닫아 큐 체류시간 축소",
    },
    {
      label: "정산 무결성 잠금",
      value: `${integrityIssueTotal}건`,
      tone: hasCriticalIntegrityIssue ? "danger" : integrityIssueTotal > 0 ? "warning" : "ok",
      hint: "누락 지급/백로그/결과 레코드/비정상 금액 정합성 확인",
    },
  ] as const;

  const settlementGuardrails = [
    {
      key: "payout-null",
      label: "정산값 누락 없음",
      count: settledWithNullPayoutCount,
      helper: "settled=true + payoutAmount null",
      tone: settledWithNullPayoutCount > 0 ? "danger" : "ok",
    },
    {
      key: "resolved-backlog",
      label: "RESOLVED 정산 백로그 없음",
      count: unresolvedSettledBacklogCount,
      helper: "토픽은 RESOLVED인데 베팅 미정산",
      tone: unresolvedSettledBacklogCount > 0 ? "danger" : "ok",
    },
    {
      key: "resolution-link",
      label: "결과 레코드 연결 완료",
      count: resolvedWithoutResolutionCount,
      helper: "RESOLVED + resolution null",
      tone: resolvedWithoutResolutionCount > 0 ? "warning" : "ok",
    },
    {
      key: "bet-amount",
      label: "비정상 베팅 금액 없음",
      count: nonPositiveBetAmountCount,
      helper: "bet.amount <= 0",
      tone: nonPositiveBetAmountCount > 0 ? "danger" : "ok",
    },
    {
      key: "payout-band",
      label: "배당률 정상 밴드",
      count: hasPayoutRatioOutlier ? 1 : 0,
      helper: "정산 5건 이상 시 payout ratio 90~110%",
      tone: hasPayoutRatioOutlier ? "warning" : "ok",
    },
  ] as const;

  const settlementGuardrailPassCount = settlementGuardrails.filter((item) => item.count === 0).length;
  const settlementGuardrailLabel = settlementGuardrailPassCount === settlementGuardrails.length
    ? "모든 가드레일 통과"
    : `${settlementGuardrails.length - settlementGuardrailPassCount}개 점검 필요`;

  const executionTimeline = [
    {
      id: "now",
      label: "Now",
      title: "긴급 큐 즉시 정리",
      detail: `OPEN ${urgentReportCount}건 · 48h+ ${superStaleActionableCount}건`,
      href: "/admin/moderation?status=OPEN",
      tone: urgentReportCount > 0 || superStaleActionableCount > 0 ? "danger" : "ok",
    },
    {
      id: "next",
      label: "Next",
      title: "정산 무결성 잠금",
      detail: `무결성 이슈 ${integrityIssueTotal}건`,
      href: "/admin/topics?status=RESOLVED",
      tone: hasCriticalIntegrityIssue ? "danger" : integrityIssueTotal > 0 ? "warning" : "ok",
    },
    {
      id: "later",
      label: "Later",
      title: "완료 기록 품질 확인",
      detail: `종결 신고 ${resolvedReportCount}건`,
      href: "/admin/moderation?status=ALL",
      tone: "ok",
    },
  ] as const;

  const responseCadence = [
    {
      id: "critical",
      label: "Critical",
      metric: `${superStaleActionableCount}건`,
      hint: "48h+ OPEN/REVIEWING 신고",
      href: "/admin/moderation?status=OPEN",
      tone: superStaleActionableCount > 0 ? "danger" : "ok",
    },
    {
      id: "active",
      label: "Active",
      metric: `${staleActionableCount}건`,
      hint: "24h+ 지연 신고",
      href: "/admin/moderation?status=REVIEWING",
      tone: staleActionableCount > 0 ? "warning" : "ok",
    },
    {
      id: "healthy",
      label: "Healthy",
      metric: `${Math.max(actionableReports.length - staleActionableCount, 0)}건`,
      hint: "24h 이내 처리 중",
      href: "/admin/moderation?status=ALL",
      tone: actionableReports.length > 0 ? "neutral" : "ok",
    },
  ] as const;

  const queueLaneItems = [
    {
      id: "lane-open",
      label: "Intake",
      title: "OPEN",
      value: counts.OPEN,
      meta: "신규 신고 즉시 분류",
      tone: counts.OPEN > 0 ? "danger" : "ok",
      href: "/admin/moderation?status=OPEN",
    },
    {
      id: "lane-reviewing",
      label: "Investigate",
      title: "REVIEWING",
      value: counts.REVIEWING,
      meta: "근거 확인 · 처리 결정",
      tone: counts.REVIEWING > 0 ? "warning" : "ok",
      href: "/admin/moderation?status=REVIEWING",
    },
    {
      id: "lane-resolved",
      label: "Resolve",
      title: "CLOSED + REJECTED",
      value: resolvedReportCount,
      meta: "완료 기록 품질 확인",
      tone: "ok",
      href: "/admin/moderation?status=ALL",
    },
  ] as const;

  const northStarCards = [
    {
      id: "moderation-latency",
      label: "Moderation latency",
      value: `${Math.max(oldestActionableHours, 0)}h`,
      caption: superStaleActionableCount > 0 ? "48h+ 지연 존재 · 즉시 정리 필요" : "모바일 SLA 흐름 안정",
      progress: Math.min(100, Math.max(12, Math.round((oldestActionableHours / 48) * 100))),
      tone: superStaleActionableCount > 0 ? "danger" : staleActionableCount > 0 ? "warning" : "ok",
      href: "/admin/moderation?status=OPEN",
      cta: "지연 큐 열기",
    },
    {
      id: "integrity-posture",
      label: "Integrity posture",
      value: `${integrityRiskScore}`,
      caption: integrityIssueTotal > 0 ? `무결성 이슈 ${integrityIssueTotal}건` : "정산 무결성 안정",
      progress: Math.min(100, Math.max(8, integrityRiskScore)),
      tone: hasCriticalIntegrityIssue ? "danger" : integrityIssueTotal > 0 ? "warning" : "ok",
      href: "/admin/topics?status=RESOLVED",
      cta: "정산 가드레일 확인",
    },
    {
      id: "queue-thruput",
      label: "Queue throughput",
      value: `${resolvedReportCount}/${reports.length}`,
      caption: reports.length > 0 ? `종결률 ${Math.round((resolvedReportCount / reports.length) * 100)}%` : "신고 없음",
      progress: reports.length > 0 ? Math.max(10, Math.round((resolvedReportCount / reports.length) * 100)) : 100,
      tone: resolvedReportCount >= actionableReports.length ? "ok" : "warning",
      href: "/admin/moderation?status=ALL",
      cta: "종결 품질 점검",
    },
  ] as const;

  return (
    <PageContainer>
      <section className="admin-hero-shell">
        <div className="row admin-header-row">
          <div>
            <p className="admin-hero-eyebrow">Operations Console</p>
            <h1 className="admin-hero-title">Admin · Moderation & Settlement</h1>
            <p className="admin-hero-subtitle">신고 큐와 정산 무결성을 모바일 우선 동선으로 빠르게 점검하고 처리하세요.</p>
          </div>
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
            <span className="admin-kpi-meta">최장 대기 {oldestActionableHours}h · 48시간 이상 미처리</span>
          </div>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">정산 무결성</p>
            <strong className="admin-kpi-value">{settledWithNullPayoutCount + unresolvedSettledBacklogCount + resolvedWithoutResolutionCount}건</strong>
            <span className="admin-kpi-meta">{integritySeverityLabel} · 누락 · 백로그 · 불일치 · 비정상 금액 · 배당률</span>
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

      <Card className="admin-thumb-rail-card">
        <p className="admin-jump-nav-label">Thumb rail · Next action</p>
        <div className="admin-thumb-rail-scroll" aria-label="엄지 운영 바로가기">
          <Link href="/admin/moderation?status=OPEN" className="admin-thumb-chip is-danger">OPEN {urgentReportCount}</Link>
          <Link href="/admin/moderation?status=REVIEWING" className="admin-thumb-chip">REVIEW {counts.REVIEWING}</Link>
          <a href="#urgent-inbox" className="admin-thumb-chip">긴급 인박스</a>
          <a href="#integrity-watch" className="admin-thumb-chip">무결성 워치</a>
          <a href="#report-list" className="admin-thumb-chip">리스트로 이동</a>
        </div>
        <p className="admin-thumb-rail-note">{nextActionLabel}</p>
      </Card>

      <Card className="admin-northstar-card">
        <div className="admin-northstar-head">
          <div>
            <p className="admin-jump-nav-label">Ops north star</p>
            <h2 className="admin-command-title">모바일 운영 핵심 지표</h2>
          </div>
          <Pill tone={hasCriticalIntegrityIssue ? "danger" : "success"}>{hasCriticalIntegrityIssue ? "Attention" : "Stable"}</Pill>
        </div>
        <div className="admin-northstar-grid" style={{ marginTop: "0.65rem" }}>
          {northStarCards.map((item) => (
            <Link key={item.id} href={item.href} className={`admin-northstar-item is-${item.tone}`}>
              <span className="admin-northstar-label">{item.label}</span>
              <strong className="admin-northstar-value">{item.value}</strong>
              <small>{item.caption}</small>
              <div className="admin-northstar-meter" aria-hidden>
                <span style={{ width: `${item.progress}%` }} />
              </div>
              <span className="admin-northstar-cta">{item.cta} →</span>
            </Link>
          ))}
        </div>
      </Card>

      {hasCriticalIntegrityIssue ? (
        <Card className="admin-critical-banner" role="alert" aria-live="polite">
          <div>
            <p className="admin-critical-banner-kicker">Critical integrity signal</p>
            <strong>정산 무결성 긴급 점검 필요 · {integrityIssueTotal}건</strong>
            <p>누락 지급, 미정산 백로그, 비정상 금액 또는 배당률 밴드 이탈이 감지되었습니다.</p>
          </div>
          <div className="admin-critical-banner-actions">
            <Link href="/admin/topics?status=RESOLVED" className="btn btn-danger">정산 이슈 우선 처리</Link>
            <Link href="/admin/moderation?status=OPEN" className="btn btn-secondary">OPEN 큐 정리</Link>
          </div>
        </Card>
      ) : null}

      <Card id="integrity-watch" className="admin-surface-card admin-surface-card-priority">
        <SectionTitle>Integrity incident board</SectionTitle>
        <p className="admin-card-intro">정산 무결성 위험을 심각도별로 분류해 즉시 조치가 필요한 항목부터 처리할 수 있게 정렬했습니다.</p>
        <div className="admin-watch-grid" style={{ marginTop: "0.68rem" }}>
          {integrityWatchItems
            .slice()
            .sort((a, b) => b.count - a.count)
            .map((item) => (
              <Link key={`${item.key}-incident`} href={item.href} className={`admin-watch-card is-${item.tone}`}>
                <span className="admin-watch-count">{item.count}</span>
                <strong className="admin-watch-title">{item.label}</strong>
                <small className="admin-watch-description">{item.description}</small>
                <span className="admin-watch-action">{item.count > 0 ? "즉시 조치" : "정상 유지"} →</span>
              </Link>
            ))}
        </div>
      </Card>

      <Card className="admin-surface-card admin-surface-card-priority">
        <SectionTitle>운영 온도계</SectionTitle>
        <p className="admin-card-intro">큐 체류 시간과 정산 무결성을 점수로 요약해 즉시 대응 우선순위를 고정합니다.</p>
        <div className="ops-health-strip" style={{ marginTop: "0.72rem" }}>
          <div className={`ops-health-item ${queueStressScore >= 60 ? "is-danger" : queueStressScore >= 30 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Queue Stress</span>
            <strong className="ops-health-value">{queueStressScore}</strong>
            <small>OPEN {urgentReportCount} · 48h+ {superStaleActionableCount}</small>
          </div>
          <div className={`ops-health-item ${integrityRiskScore >= 45 ? "is-danger" : integrityRiskScore > 0 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Integrity Risk</span>
            <strong className="ops-health-value">{integrityRiskScore}</strong>
            <small>누락/백로그/불일치/비정상 금액/배당률 기반 산출</small>
          </div>
          <div className={`ops-health-item ${settlementConfidence === "낮음" ? "is-danger" : settlementConfidence === "보통" ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Settlement Confidence</span>
            <strong className="ops-health-value">{settlementConfidence}</strong>
            <small>운영 기준 정산 신뢰도</small>
          </div>
        </div>
      </Card>

      <Card className="admin-command-card">
        <div className="admin-command-head">
          <div>
            <p className="admin-command-kicker">Ops command rail</p>
            <h2 className="admin-command-title">지금 해야 할 3가지</h2>
          </div>
          <Pill tone={canUseDb ? "success" : "neutral"}>{dataModeLabel}</Pill>
        </div>
        {!canUseDb ? (
          <p className="admin-command-warning">DATABASE_URL 미설정 상태라 로컬 fallback 데이터 기준으로 노출됩니다. 운영 점검 전 배포 환경 변수 확인을 권장합니다.</p>
        ) : null}
        <div className="admin-command-grid">
          {operationsChecklist.map((item, index) => (
            <article key={item.label} className={`admin-command-item is-${item.tone}`}>
              <span className="admin-command-step">P{index + 1}</span>
              <strong>{item.label}</strong>
              <p>{item.hint}</p>
              <span className="admin-command-value">{item.value}</span>
            </article>
          ))}
        </div>
      </Card>

      <Card className="admin-lane-card">
        <div className="admin-lane-head">
          <div>
            <p className="admin-jump-nav-label">Queue lanes</p>
            <h2 className="admin-command-title">한 손 운영을 위한 처리 레인</h2>
          </div>
          <Pill tone={actionableReports.length > 0 ? "danger" : "success"}>Actionable {actionableReports.length}</Pill>
        </div>
        <div className="admin-lane-grid" style={{ marginTop: "0.62rem" }}>
          {queueLaneItems.map((lane) => (
            <Link key={lane.id} href={lane.href} className={`admin-lane-item is-${lane.tone}`}>
              <span className="admin-lane-label">{lane.label}</span>
              <strong className="admin-lane-title">{lane.title}</strong>
              <span className="admin-lane-value">{lane.value}건</span>
              <small>{lane.meta}</small>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="admin-jump-nav-card admin-jump-nav-card-sticky">
        <p className="admin-jump-nav-label">Quick jump</p>
        <div className="admin-jump-nav" aria-label="운영 섹션 바로가기">
          <a href="#queue-priority" className="admin-jump-nav-item">우선 처리 큐</a>
          <a href="#urgent-inbox" className="admin-jump-nav-item">긴급 인박스</a>
          <a href="#integrity-watch" className="admin-jump-nav-item">무결성 워치</a>
          <a href="#report-list" className="admin-jump-nav-item">신고 리스트</a>
        </div>
      </Card>

      <Card className="admin-timeline-card">
        <SectionTitle>Execution timeline</SectionTitle>
        <p className="admin-card-intro">지금/다음/마감 전 순서로 운영 우선순위를 고정해 한 손으로 빠르게 이동할 수 있게 구성했습니다.</p>
        <div className="admin-timeline-grid" style={{ marginTop: "0.68rem" }}>
          {executionTimeline.map((item) => (
            <Link key={item.id} href={item.href} className={`admin-timeline-item is-${item.tone}`}>
              <span className="admin-timeline-label">{item.label}</span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="admin-cadence-card">
        <SectionTitle>Response cadence</SectionTitle>
        <p className="admin-card-intro">신고 대응 속도를 3단계로 분리해 지연 위험을 모바일에서 즉시 감지하고 우선순위를 고정합니다.</p>
        <div className="admin-cadence-grid" style={{ marginTop: "0.68rem" }}>
          {responseCadence.map((item) => (
            <Link key={item.id} href={item.href} className={`admin-cadence-item is-${item.tone}`}>
              <span className="admin-cadence-label">{item.label}</span>
              <strong>{item.metric}</strong>
              <small>{item.hint}</small>
            </Link>
          ))}
        </div>
      </Card>

      <StatePanel
        title={hasCriticalIntegrityIssue ? "정산/무결성 긴급 점검" : "정산 무결성 상태 안정"}
        description={hasCriticalIntegrityIssue
          ? `지급값 누락 또는 정산 백로그가 ${integrityIssueTotal}건 감지되었습니다. 우선 정산 데이터 정합성을 확인한 뒤 후속 처리하세요.`
          : integrityIssueTotal > 0
            ? `치명 이슈는 없지만 결과 레코드 불일치 ${integrityIssueTotal}건이 있습니다. 다음 배치 전 정리 권장.`
            : "누락·백로그·결과 불일치·비정상 금액 이슈가 없습니다. 현재 정산 무결성 기준을 만족합니다."}
        tone={hasCriticalIntegrityIssue ? "warning" : integrityIssueTotal > 0 ? "warning" : "success"}
        actions={(
          <>
            <Link href="/admin/topics" className="btn btn-primary">토픽 정산 상태 점검</Link>
            <Link href="/admin/moderation?status=OPEN" className="btn btn-secondary">OPEN 신고 먼저 처리</Link>
          </>
        )}
      />

      <Card className="admin-surface-card">
        <SectionTitle>모바일 빠른 실행</SectionTitle>
        <p className="admin-card-intro">엄지 동선 기준으로 자주 쓰는 운영 작업을 한 번에 배치했습니다.</p>
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

      <Card className="admin-ops-playbook-card">
        <SectionTitle>오늘의 운영 플레이북</SectionTitle>
        <p className="admin-card-intro">지금 가장 효과가 큰 순서로 3단계만 실행하세요. 모바일에서도 한눈에 우선순위가 보이도록 구성했습니다.</p>
        <ol className="admin-ops-playbook-list" style={{ marginTop: "0.72rem" }}>
          <li>
            <strong>Step 1 · 긴급 큐 정리</strong>
            <span>OPEN {urgentReportCount}건, 48h+ 지연 {superStaleActionableCount}건 우선 처리</span>
          </li>
          <li>
            <strong>Step 2 · 무결성 리스크 잠금</strong>
            <span>누락/백로그/불일치/비정상 금액/배당률 이탈 {integrityIssueTotal}건 확인 후 정산 일관성 복구</span>
          </li>
          <li>
            <strong>Step 3 · 큐 정상화 확인</strong>
            <span>REVIEWING {counts.REVIEWING}건과 숨김 댓글 신고 {hiddenCommentReportCount}건 재검토</span>
          </li>
        </ol>
        <p className="admin-muted-note" style={{ marginTop: "0.65rem" }}>Next best action: {nextActionLabel}</p>
      </Card>

      <Card>
        <SectionTitle>운영 컨트롤 타워</SectionTitle>
        <p className="admin-card-intro">모바일/운영 환경 기준으로 즉시 대응 큐와 정산 무결성 상태를 한 번에 점검합니다.</p>
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

      <Card className="admin-surface-card admin-flow-card">
        <SectionTitle>처리 파이프라인</SectionTitle>
        <p className="admin-card-intro">신고를 OPEN → REVIEWING → CLOSED/REJECTED 흐름으로 정리해 큐 체류 시간을 줄입니다.</p>
        <div className="admin-flow-grid" style={{ marginTop: "0.72rem" }}>
          <Link href="/admin/moderation?status=OPEN" className="admin-flow-step is-open">
            <span className="admin-flow-step-label">Step 1 · Intake</span>
            <strong className="admin-flow-step-value">OPEN {counts.OPEN}</strong>
            <small>신규 신고 즉시 트리아지</small>
          </Link>
          <Link href="/admin/moderation?status=REVIEWING" className="admin-flow-step is-reviewing">
            <span className="admin-flow-step-label">Step 2 · Investigate</span>
            <strong className="admin-flow-step-value">REVIEWING {counts.REVIEWING}</strong>
            <small>근거 확인 후 조치 확정</small>
          </Link>
          <Link href="/admin/moderation?status=ALL" className="admin-flow-step">
            <span className="admin-flow-step-label">Step 3 · Resolve</span>
            <strong className="admin-flow-step-value">완료 {counts.CLOSED + counts.REJECTED}</strong>
            <small>CLOSED / REJECTED 기록 점검</small>
          </Link>
        </div>
      </Card>

      <Card id="queue-priority" className="admin-surface-card admin-surface-card-priority">
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
        <p className="admin-muted-note">기본적으로 OPEN/REVIEWING 상태를 먼저 처리하는 것을 권장합니다.</p>
      </Card>

      <Card className="admin-surface-card">
        <SectionTitle>Queue SLA Snapshot</SectionTitle>
        <p className="admin-muted-note">모바일 운영 기준 3개 지표로 큐 온도를 바로 판단할 수 있습니다.</p>
        <div className="ops-health-strip" style={{ marginTop: "0.68rem" }}>
          <div className={`ops-health-item ${superStaleActionableCount > 0 ? "is-danger" : staleActionableCount > 0 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">SLA 상태</span>
            <strong className="ops-health-value">{queueSlaLabel}</strong>
            <small>24h+ {staleActionableCount} · 48h+ {superStaleActionableCount}</small>
          </div>
          <div className={`ops-health-item ${urgentReportCount > 0 ? "is-danger" : "is-ok"}`}>
            <span className="ops-health-label">OPEN 긴급</span>
            <strong className="ops-health-value">{urgentReportCount}건</strong>
            <small>즉시 트리아지 우선순위</small>
          </div>
          <div className={`ops-health-item ${integrityIssueTotal > 0 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">정산 무결성</span>
            <strong className="ops-health-value">{integrityIssueTotal}건</strong>
            <small>누락/백로그/불일치/비정상 금액/배당률 이탈 합계</small>
          </div>
        </div>
      </Card>

      <Card id="urgent-inbox" className="admin-surface-card admin-surface-card-priority">
        <SectionTitle>긴급 인박스</SectionTitle>
        <p className="admin-muted-note">즉시 처리 대상만 모아서 상단으로 끌어올렸습니다. 오래된 OPEN/REVIEWING 건부터 우선 확인하세요.</p>
        {priorityReports.length > 0 ? (
          <ul className="simple-list" style={{ marginTop: "0.55rem" }}>
            {priorityReports.map((report) => {
              const elapsedHours = Math.floor((Date.now() - new Date(report.createdAt).getTime()) / (1000 * 60 * 60));
              return (
                <li key={report.id}>
                  <Link href={`#report-${report.id}`} className="text-link">
                    [{report.status}] {report.reason}
                  </Link>
                  <small style={{ color: "#6b7280" }}> · 경과 {Math.max(elapsedHours, 0)}시간</small>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="admin-empty-pattern" role="status">
            <p className="admin-empty-kicker">Queue stable</p>
            <strong>긴급 처리 대상이 없습니다</strong>
            <p>OPEN 신규나 24시간 이상 지연된 REVIEWING 건이 없습니다. 현재 큐는 안정 상태입니다.</p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>모바일 스포트라이트</SectionTitle>
        <p className="admin-muted-note">엄지 한 번으로 가장 급한 신고 상세 영역으로 이동합니다.</p>
        {spotlightReports.length > 0 ? (
          <div className="admin-spotlight-grid" style={{ marginTop: "0.65rem" }}>
            {spotlightReports.map((report) => {
              const elapsedHours = Math.floor((Date.now() - new Date(report.createdAt).getTime()) / (1000 * 60 * 60));
              return (
                <Link key={report.id} href={`#report-${report.id}`} className="admin-spotlight-link">
                  <span className="admin-spotlight-status">{report.status}</span>
                  <strong className="admin-spotlight-title">{report.reason}</strong>
                  <small className="admin-spotlight-meta">경과 {Math.max(elapsedHours, 0)}시간 · {report.commentId ? "댓글" : "토픽"} 신고</small>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="admin-empty-pattern" role="status">
            <p className="admin-empty-kicker">Spotlight clear</p>
            <strong>스포트라이트 대상이 없습니다</strong>
            <p>긴급/지연 신고가 비어 있습니다. 현재 큐 상태는 안정적입니다.</p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>정산 현황</SectionTitle>
        <p className="admin-muted-note">
          정산 완료 베팅 {settlement._count.id}건 · 총 베팅 {totalSettledAmount.toLocaleString("ko-KR")} pt · 총 지급 {totalPayoutAmount.toLocaleString("ko-KR")} pt
        </p>
        <div className={`settlement-ledger-card ${settlementGapAbs === 0 ? "is-balanced" : settlementGapAmount > 0 ? "is-warning" : "is-danger"}`}>
          <div>
            <p className="settlement-ledger-label">Settlement ledger</p>
            <strong className="settlement-ledger-value">
              {settlementGapAmount > 0 ? "+" : settlementGapAmount < 0 ? "-" : "±"}
              {settlementGapAbs.toLocaleString("ko-KR")}pt
            </strong>
            <small>총 베팅 - 총 지급 기준 차이</small>
          </div>
          <Pill tone={settlementGapAbs === 0 ? "success" : settlementGapAmount > 0 ? "neutral" : "danger"}>{settlementBalanceLabel}</Pill>
        </div>
        <div className="row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
          <Pill tone={settledWithNullPayoutCount > 0 ? "danger" : "success"}>정산값 누락 {settledWithNullPayoutCount}</Pill>
          <Pill tone={unresolvedSettledBacklogCount > 0 ? "danger" : "success"}>정산 대기 백로그 {unresolvedSettledBacklogCount}</Pill>
          <Pill tone={resolvedWithoutResolutionCount > 0 ? "danger" : "success"}>해결-결과 불일치 {resolvedWithoutResolutionCount}</Pill>
          <Pill tone={nonPositiveBetAmountCount > 0 ? "danger" : "success"}>비정상 베팅 금액 {nonPositiveBetAmountCount}</Pill>
          <Pill tone={hasPayoutRatioOutlier ? "danger" : "success"}>배당률 밴드 {hasPayoutRatioOutlier ? "이탈" : "정상"}</Pill>
        </div>
        {hasPayoutRatioOutlier ? (
          <p className="admin-muted-note" style={{ marginTop: "0.55rem" }}>
            payout ratio {payoutRatio}%가 권장 밴드(90~110%)를 벗어났습니다. 최근 정산 배치와 결과 레코드를 재검토하세요.
          </p>
        ) : null}
        <div className="admin-integrity-strip" style={{ marginTop: "0.7rem" }}>
          <span className={settledWithNullPayoutCount > 0 ? "is-danger" : "is-ok"}>지급값 누락</span>
          <span className={unresolvedSettledBacklogCount > 0 ? "is-danger" : "is-ok"}>백로그</span>
          <span className={resolvedWithoutResolutionCount > 0 ? "is-danger" : "is-ok"}>결과 레코드</span>
          <span className={nonPositiveBetAmountCount > 0 ? "is-danger" : "is-ok"}>비정상 금액</span>
          <span className={hasPayoutRatioOutlier ? "is-danger" : "is-ok"}>배당률 밴드</span>
          <span className="is-neutral">모바일 우선 점검 추천</span>
        </div>
      </Card>

      <Card className="admin-surface-card admin-guardrail-card">
        <SectionTitle>Settlement guardrails</SectionTitle>
        <p className="admin-muted-note">정산 배치 전 반드시 확인할 5가지 무결성 체크포인트입니다.</p>
        <div className="admin-guardrail-grid" style={{ marginTop: "0.65rem" }}>
          {settlementGuardrails.map((item) => (
            <article key={item.key} className={`admin-guardrail-item is-${item.tone}`}>
              <strong>{item.label}</strong>
              <small>{item.helper}</small>
              <span>{item.count === 0 ? "PASS" : `${item.count}건`}</span>
            </article>
          ))}
        </div>
        <p className="admin-muted-note" style={{ marginTop: "0.6rem" }}>가드레일 상태: {settlementGuardrailLabel}</p>
      </Card>

      {/* integrity-watch moved near top for faster mobile triage */}

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

      <Card className="admin-filter-summary-card">
        <div className="admin-filter-summary-head">
          <SectionTitle>현재 필터 컨텍스트</SectionTitle>
          <Pill tone={filteredReports.length > 0 ? "neutral" : "danger"}>결과 {filteredReports.length}건</Pill>
        </div>
        {activeFilterTokens.length > 0 ? (
          <div className="chip-row-scroll" style={{ marginTop: "0.6rem" }}>
            {activeFilterTokens.map((token) => (
              <span key={token} className="filter-chip is-active">{token}</span>
            ))}
          </div>
        ) : (
          <p className="admin-muted-note" style={{ marginTop: "0.55rem" }}>필터 없음 · 기본 전체 큐 보기</p>
        )}
      </Card>

      <div id="report-list" className="list">
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

        <small className="admin-list-footnote">정렬 기준: 상태 우선순위(OPEN → REVIEWING → CLOSED/REJECTED), 이후 최신순</small>
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

        {filteredReports.map((report) => {
          const createdAt = new Date(report.createdAt);
          const elapsedHours = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
          const isStale = (report.status === "OPEN" || report.status === "REVIEWING") && elapsedHours >= 24;
          const priority = getReportPriority(report.status, elapsedHours);

          return (
            <Card key={report.id} className={`admin-report-card admin-report-card-priority-${priority.tone}${report.status === "OPEN" ? " is-open" : ""}${isStale ? " is-stale" : ""}`}>
              <article id={`report-${report.id}`} className="moderation-report-card admin-list-card">
                <div className="moderation-report-headline admin-list-card-head">
                  <div>
                    <p className="admin-list-card-kicker">신고 #{report.id.slice(0, 8)}</p>
                    <h3 className="moderation-report-title admin-list-card-title">{report.reason}</h3>
                    <p className="moderation-report-detail admin-list-card-description">{report.detail ?? "상세 설명 없음"}</p>
                    <small className="moderation-report-meta admin-list-card-meta-row">
                      <span>{createdAt.toLocaleString("ko-KR")}</span>
                      <span>경과 {Math.max(elapsedHours, 0)}시간</span>
                      {report.reporterNickname ? <span>신고자 {report.reporterNickname}</span> : null}
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
                    <Pill tone={priority.tone}>{priority.label}</Pill>
                    {isStale ? <Pill tone="danger">24h+ 지연</Pill> : null}
                    {report.status === "OPEN" ? <Pill tone="danger">우선 처리</Pill> : null}
                    <Pill>{report.commentId ? "comment" : "topic"}</Pill>
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
          );
        })}
        {filteredReports.length === 0 ? (
          <div className="admin-empty-pattern" role="status">
            <p className="admin-empty-kicker">No matches</p>
            <strong>조건에 맞는 신고가 없습니다</strong>
            <p>필터를 완화하거나 상태를 ALL로 바꿔 다시 확인해보세요.</p>
            <div>
              <Link href="/admin/moderation?status=ALL&type=ALL" className="btn btn-secondary">필터 초기화</Link>
            </div>
          </div>
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
