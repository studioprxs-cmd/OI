import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminSectionTabs, Card, PageContainer, Pill, SectionTitle, StatePanel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mockTopicSummaries } from "@/lib/mock-data";

import { TopicQuickActions } from "./TopicQuickActions";

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
        orderBy: { createdAt: "desc" },
        take: 5,
      })
      .catch(() => [])
    : [];

  const settledWithNullPayoutCount = canUseDb
    ? await db.bet.count({ where: { settled: true, payoutAmount: null } }).catch(() => 0)
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

  const settlement = canUseDb
    ? await db.bet
      .aggregate({
        _count: { id: true },
        _sum: { amount: true, payoutAmount: true },
        where: { settled: true },
      })
      .catch(() => ({ _count: { id: 0 }, _sum: { amount: 0, payoutAmount: 0 } }))
    : { _count: { id: 0 }, _sum: { amount: 0, payoutAmount: 0 } };

  const totalSettledAmount = Number(settlement._sum.amount ?? 0);
  const totalPayoutAmount = Number(settlement._sum.payoutAmount ?? 0);
  const payoutRatio = totalSettledAmount > 0 ? Math.round((totalPayoutAmount / totalSettledAmount) * 100) : 0;
  const hasPayoutRatioOutlier = settlement._count.id >= 5 && (payoutRatio < 90 || payoutRatio > 110);

  const statusCounts = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, topics.filter((topic) => topic.status === status).length]),
  ) as Record<(typeof STATUS_ORDER)[number], number>;

  const nowTs = Date.now();

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

      const aTs = new Date(a.createdAt).getTime();
      const bTs = new Date(b.createdAt).getTime();
      const aAgeMs = nowTs - aTs;
      const bAgeMs = nowTs - bTs;
      const prioritizeAgingA = a.status === "OPEN" || a.status === "LOCKED";
      const prioritizeAgingB = b.status === "OPEN" || b.status === "LOCKED";

      if (prioritizeAgingA && prioritizeAgingB) {
        if (bAgeMs !== aAgeMs) return bAgeMs - aAgeMs;
      }

      return bTs - aTs;
    });

  const pendingResolveCount = topics.filter((topic) => topic.status === "OPEN" || topic.status === "LOCKED").length;
  const staleOpenCount = topics.filter((topic) => topic.status === "OPEN" && Date.now() - new Date(topic.createdAt).getTime() >= 24 * 60 * 60 * 1000).length;
  const integrityIssueTotal = unresolvedSettledBacklogCount + resolvedWithoutResolutionCount + settledWithNullPayoutCount + nonPositiveBetAmountCount + (hasPayoutRatioOutlier ? 1 : 0);
  const priorityTopics = filteredTopics
    .filter((topic) => {
      const ageHours = Math.floor((Date.now() - new Date(topic.createdAt).getTime()) / (1000 * 60 * 60));
      return topic.status === "LOCKED" || topic.status === "OPEN" || (topic.status === "RESOLVED" && ageHours <= 24);
    })
    .slice(0, 5);
  const spotlightTopics = priorityTopics.slice(0, 3);
  const staleLockedCount = topics.filter((topic) => topic.status === "LOCKED" && Date.now() - new Date(topic.createdAt).getTime() >= 24 * 60 * 60 * 1000).length;
  const nextActionLabel = staleOpenCount > 0
    ? `24h+ OPEN ${staleOpenCount}건부터 우선 정리`
    : statusCounts.LOCKED > 0
      ? `LOCKED ${statusCounts.LOCKED}건 정산/해결 처리`
      : pendingResolveCount > 0
        ? `OPEN/LOCKED ${pendingResolveCount}건 순차 정리`
        : "긴급 토픽 없음 · 신규 생성/품질 관리 권장";
  const topicQueueStressScore = Math.min(100, (statusCounts.OPEN * 11) + (staleOpenCount * 24) + (staleLockedCount * 12));
  const topicIntegrityRiskScore = Math.min(100, (unresolvedSettledBacklogCount * 35) + (resolvedWithoutResolutionCount * 20) + (settledWithNullPayoutCount * 40) + (nonPositiveBetAmountCount * 25) + (hasPayoutRatioOutlier ? 20 : 0));
  const topicConfidence = topicIntegrityRiskScore === 0 ? "높음" : topicIntegrityRiskScore <= 30 ? "보통" : "낮음";
  const dataModeLabel = canUseDb ? "Live DB" : "Local fallback";
  const oldestPendingTopicHours = topics.length > 0
    ? Math.max(
      ...topics
        .filter((topic) => topic.status === "OPEN" || topic.status === "LOCKED")
        .map((topic) => Math.floor((Date.now() - new Date(topic.createdAt).getTime()) / (1000 * 60 * 60))),
    )
    : 0;

  const northStarCards = [
    {
      id: "topic-latency",
      label: "Topic latency",
      value: `${Math.max(oldestPendingTopicHours, 0)}h`,
      caption: staleOpenCount > 0 ? "24h+ OPEN 지연 존재 · 즉시 분류 필요" : "토픽 큐 응답 리듬 안정",
      progress: Math.min(100, Math.max(12, Math.round((oldestPendingTopicHours / 48) * 100))),
      tone: staleOpenCount > 0 ? "danger" : staleLockedCount > 0 ? "warning" : "ok",
      href: "/admin/topics?status=OPEN",
      cta: "인입 큐 열기",
    },
    {
      id: "topic-integrity",
      label: "Integrity posture",
      value: `${topicIntegrityRiskScore}`,
      caption: integrityIssueTotal > 0 ? `무결성 이슈 ${integrityIssueTotal}건` : "정산 무결성 안정",
      progress: Math.min(100, Math.max(8, topicIntegrityRiskScore)),
      tone: integrityIssueTotal > 0 ? "danger" : "ok",
      href: "/admin/topics?status=RESOLVED",
      cta: "무결성 워치 열기",
    },
    {
      id: "topic-throughput",
      label: "Topic throughput",
      value: `${statusCounts.RESOLVED}/${topics.length}`,
      caption: topics.length > 0 ? `해결률 ${Math.round((statusCounts.RESOLVED / topics.length) * 100)}%` : "토픽 없음",
      progress: topics.length > 0 ? Math.max(10, Math.round((statusCounts.RESOLVED / topics.length) * 100)) : 100,
      tone: pendingResolveCount > statusCounts.RESOLVED ? "warning" : "ok",
      href: "/admin/topics?status=ALL",
      cta: "리스트 품질 점검",
    },
  ] as const;

  const queueLaneItems = [
    {
      id: "topic-open-lane",
      label: "Intake",
      title: "OPEN",
      value: statusCounts.OPEN,
      meta: staleOpenCount > 0 ? `24h+ ${staleOpenCount}건` : "신규 토픽 점검",
      tone: statusCounts.OPEN > 0 ? "danger" : "ok",
      href: "/admin/topics?status=OPEN",
    },
    {
      id: "topic-locked-lane",
      label: "Settle",
      title: "LOCKED",
      value: statusCounts.LOCKED,
      meta: staleLockedCount > 0 ? `24h+ ${staleLockedCount}건` : "정산/결과 확정",
      tone: statusCounts.LOCKED > 0 ? "warning" : "ok",
      href: "/admin/topics?status=LOCKED",
    },
    {
      id: "topic-resolved-lane",
      label: "Verify",
      title: "RESOLVED",
      value: statusCounts.RESOLVED,
      meta: integrityIssueTotal > 0 ? `무결성 ${integrityIssueTotal}건` : "무결성 유지",
      tone: integrityIssueTotal > 0 ? "danger" : "ok",
      href: "/admin/topics?status=RESOLVED",
    },
  ] as const;

  const operationsChecklist = [
    {
      label: "OPEN 토픽 우선 분류",
      value: `${statusCounts.OPEN}건`,
      tone: statusCounts.OPEN > 0 ? "danger" : "ok",
      hint: "신규 이슈를 빠르게 검수하고 필요 시 LOCKED로 전환",
    },
    {
      label: "LOCKED 정산 처리",
      value: `${statusCounts.LOCKED}건`,
      tone: statusCounts.LOCKED > 0 ? "warning" : "ok",
      hint: "베팅 정산과 결과 기록을 묶어서 완료",
    },
    {
      label: "정산 무결성 점검",
      value: `${integrityIssueTotal}건`,
      tone: integrityIssueTotal > 0 ? "danger" : "ok",
      hint: "RESOLVED 미정산/결과 누락을 우선 복구",
    },
  ] as const;

  const experienceSignals = [
    {
      id: "nav-consistency",
      label: "Nav consistency",
      value: selectedStatus === "ALL" && !keyword ? "Clean" : "Filtered",
      hint: selectedStatus === "ALL" && !keyword ? "기본 토픽 큐 모드" : `status=${selectedStatus}${keyword ? " · keyword" : ""}`,
      tone: selectedStatus === "ALL" && !keyword ? "ok" : "neutral",
    },
    {
      id: "thumb-flow",
      label: "Thumb flow",
      value: `${pendingResolveCount} targets`,
      hint: nextActionLabel,
      tone: pendingResolveCount > 0 ? "warning" : "ok",
    },
    {
      id: "state-clarity",
      label: "State clarity",
      value: integrityIssueTotal > 0 ? "Alert" : "Stable",
      hint: canUseDb ? "Live guardrails on" : "Fallback data mode",
      tone: integrityIssueTotal > 0 ? "danger" : canUseDb ? "ok" : "neutral",
    },
  ] as const;

  const settlementGuardrails = [
    {
      key: "resolved-backlog",
      label: "RESOLVED 미정산 없음",
      count: unresolvedSettledBacklogCount,
      helper: "RESOLVED 토픽 + settled=false 베팅",
      tone: unresolvedSettledBacklogCount > 0 ? "danger" : "ok",
    },
    {
      key: "resolution-missing",
      label: "결과 레코드 연결",
      count: resolvedWithoutResolutionCount,
      helper: "status=RESOLVED + resolution=null",
      tone: resolvedWithoutResolutionCount > 0 ? "warning" : "ok",
    },
    {
      key: "payout-null",
      label: "settled 지급값 누락 없음",
      count: settledWithNullPayoutCount,
      helper: "settled=true + payoutAmount null",
      tone: settledWithNullPayoutCount > 0 ? "danger" : "ok",
    },
    {
      key: "non-positive-amount",
      label: "비정상 금액 없음",
      count: nonPositiveBetAmountCount,
      helper: "bet.amount <= 0",
      tone: nonPositiveBetAmountCount > 0 ? "danger" : "ok",
    },
    {
      key: "payout-ratio-band",
      label: "배당률 밴드 정상",
      count: hasPayoutRatioOutlier ? 1 : 0,
      helper: "정산 5건 이상 시 payout ratio 90~110%",
      tone: hasPayoutRatioOutlier ? "warning" : "ok",
    },
    {
      key: "queue-latency",
      label: "OPEN 지연 24h 이하",
      count: staleOpenCount,
      helper: "24시간 이상 OPEN 토픽",
      tone: staleOpenCount > 0 ? "warning" : "ok",
    },
  ] as const;

  const settlementReadinessScore = Math.max(0, 100 - (unresolvedSettledBacklogCount * 24) - (resolvedWithoutResolutionCount * 16) - (settledWithNullPayoutCount * 28) - (nonPositiveBetAmountCount * 18) - (hasPayoutRatioOutlier ? 14 : 0) - (staleOpenCount * 7));
  const settlementReadinessTone = settlementReadinessScore < 60 ? "danger" : settlementReadinessScore < 85 ? "warning" : "ok";
  const settlementReadinessLabel = settlementReadinessScore < 60 ? "긴급 점검 필요" : settlementReadinessScore < 85 ? "주의" : "안정";
  const queueSlaLabel = staleOpenCount > 0 || staleLockedCount > 0
    ? staleOpenCount > 0
      ? "위험"
      : "주의"
    : "정상";

  const topicResponseCadence = [
    {
      id: "topic-critical-cadence",
      label: "Critical",
      metric: `${staleOpenCount}건`,
      hint: "24h+ OPEN 토픽",
      href: "/admin/topics?status=OPEN",
      tone: staleOpenCount > 0 ? "danger" : "ok",
    },
    {
      id: "topic-active-cadence",
      label: "Active",
      metric: `${staleLockedCount}건`,
      hint: "24h+ LOCKED 토픽",
      href: "/admin/topics?status=LOCKED",
      tone: staleLockedCount > 0 ? "warning" : "ok",
    },
    {
      id: "topic-healthy-cadence",
      label: "Healthy",
      metric: `${Math.max(pendingResolveCount - staleOpenCount - staleLockedCount, 0)}건`,
      hint: "24h 이내 처리 큐",
      href: "/admin/topics?status=ALL",
      tone: pendingResolveCount > 0 ? "neutral" : "ok",
    },
  ] as const;

  const executionTimeline = [
    {
      id: "topic-now",
      label: "Now",
      title: "OPEN 인입 큐 정리",
      detail: `OPEN ${statusCounts.OPEN}건 · 24h+ ${staleOpenCount}건`,
      href: "/admin/topics?status=OPEN",
      tone: statusCounts.OPEN > 0 || staleOpenCount > 0 ? "danger" : "ok",
    },
    {
      id: "topic-next",
      label: "Next",
      title: "LOCKED 정산/결과 확정",
      detail: `LOCKED ${statusCounts.LOCKED}건`,
      href: "/admin/topics?status=LOCKED",
      tone: statusCounts.LOCKED > 0 ? "warning" : "ok",
    },
    {
      id: "topic-later",
      label: "Later",
      title: "RESOLVED 무결성 검증",
      detail: `무결성 이슈 ${integrityIssueTotal}건`,
      href: "/admin/topics?status=RESOLVED",
      tone: integrityIssueTotal > 0 ? "danger" : "ok",
    },
  ] as const;

  const integrityWatchItems = [
    {
      key: "resolved-backlog-watch",
      label: "RESOLVED 미정산",
      count: unresolvedSettledBacklogCount,
      description: "RESOLVED 토픽인데 settled=false 베팅이 남은 상태",
      href: "/admin/topics?status=RESOLVED",
      actionLabel: "백로그 정산 진행",
      tone: unresolvedSettledBacklogCount > 0 ? "danger" : "ok",
    },
    {
      key: "resolution-missing-watch",
      label: "결과 레코드 누락",
      count: resolvedWithoutResolutionCount,
      description: "status=RESOLVED + resolution=null 데이터",
      href: "/admin/topics?status=RESOLVED",
      actionLabel: "결과 레코드 복구",
      tone: resolvedWithoutResolutionCount > 0 ? "warning" : "ok",
    },
    {
      key: "payout-null-watch",
      label: "지급값 누락",
      count: settledWithNullPayoutCount,
      description: "settled=true인데 payoutAmount가 비어 있는 데이터",
      href: "/admin/topics?status=RESOLVED",
      actionLabel: "정산값 복구",
      tone: settledWithNullPayoutCount > 0 ? "danger" : "ok",
    },
    {
      key: "amount-watch",
      label: "비정상 금액",
      count: nonPositiveBetAmountCount,
      description: "bet.amount <= 0인 비정상 베팅 데이터",
      href: "/admin/topics?status=ALL",
      actionLabel: "금액 데이터 검증",
      tone: nonPositiveBetAmountCount > 0 ? "danger" : "ok",
    },
    {
      key: "ratio-watch",
      label: "배당률 밴드 이탈",
      count: hasPayoutRatioOutlier ? 1 : 0,
      description: `정산 ${settlement._count.id}건 기준 payout ratio ${payoutRatio}%`,
      href: "/admin/topics?status=RESOLVED",
      actionLabel: "정산 레저 재검토",
      tone: hasPayoutRatioOutlier ? "warning" : "ok",
    },
    {
      key: "open-aging-watch",
      label: "OPEN 지연 토픽",
      count: staleOpenCount,
      description: "24시간 이상 OPEN으로 남아 있는 토픽",
      href: "/admin/topics?status=OPEN",
      actionLabel: "우선 트리아지",
      tone: staleOpenCount > 0 ? "warning" : "ok",
    },
  ] as const;

  const topTopicIntegrityIncident = integrityWatchItems
    .slice()
    .sort((a, b) => b.count - a.count)[0];

  const settlementActionPack = [
    {
      id: "topic-pack-backlog",
      label: "Backlog repair",
      count: unresolvedSettledBacklogCount,
      value: `${unresolvedSettledBacklogCount}건`,
      hint: "RESOLVED 미정산 우선 복구",
      href: "/admin/topics?status=RESOLVED",
      tone: unresolvedSettledBacklogCount > 0 ? "danger" : "ok",
    },
    {
      id: "topic-pack-resolution",
      label: "Resolution sync",
      count: resolvedWithoutResolutionCount,
      value: `${resolvedWithoutResolutionCount}건`,
      hint: "결과 레코드 누락 연결",
      href: "/admin/topics?status=RESOLVED",
      tone: resolvedWithoutResolutionCount > 0 ? "warning" : "ok",
    },
    {
      id: "topic-pack-payout",
      label: "Payout ledger",
      count: settledWithNullPayoutCount + (hasPayoutRatioOutlier ? 1 : 0),
      value: `${settledWithNullPayoutCount + (hasPayoutRatioOutlier ? 1 : 0)}건`,
      hint: `누락 지급 ${settledWithNullPayoutCount} · 배당률 ${payoutRatio}%`,
      href: "/admin/topics?status=RESOLVED",
      tone: settledWithNullPayoutCount > 0 || hasPayoutRatioOutlier ? "danger" : "ok",
    },
    {
      id: "topic-pack-latency",
      label: "Latency sweep",
      count: staleOpenCount + staleLockedCount,
      value: `${staleOpenCount + staleLockedCount}건`,
      hint: "24h+ OPEN/LOCKED 체류 정리",
      href: "/admin/topics?status=OPEN",
      tone: staleOpenCount + staleLockedCount > 0 ? "warning" : "ok",
    },
  ] as const;

  return (
    <PageContainer>
      <section className="admin-hero-shell">
        <div className="row admin-header-row">
          <div>
            <p className="admin-hero-eyebrow">Topic Operations</p>
            <h1 className="admin-hero-title">Admin · Topics</h1>
            <p className="admin-hero-subtitle">토픽 생애주기와 정산 위험 신호를 한 화면에서 확인하고 우선순위대로 정리하세요.</p>
          </div>
          <div className="row admin-header-links">
            <Link className="text-link" href="/admin/topics/new">+ Create Topic</Link>
            <Link className="text-link" href="/admin/topics?status=ALL">필터 초기화</Link>
          </div>
        </div>

        <div className="admin-pulse-grid" style={{ marginTop: "0.75rem" }}>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">처리 필요</p>
            <strong className="admin-kpi-value">{pendingResolveCount}건</strong>
            <span className="admin-kpi-meta">OPEN + LOCKED</span>
          </div>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">오픈 지연</p>
            <strong className="admin-kpi-value">{staleOpenCount}건</strong>
            <span className="admin-kpi-meta">24시간 이상 OPEN</span>
          </div>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">무결성 이슈</p>
            <strong className="admin-kpi-value">{integrityIssueTotal}건</strong>
            <span className="admin-kpi-meta">백로그 · 누락 지급 · 결과 불일치 · 비정상 금액 · 배당률</span>
          </div>
          <div className="admin-pulse-card">
            <p className="admin-kpi-label">정산 배당률</p>
            <strong className="admin-kpi-value">{payoutRatio}%</strong>
            <span className="admin-kpi-meta">총 지급 / 총 베팅</span>
          </div>
        </div>
      </section>

      <AdminSectionTabs
        items={[
          { href: "/admin/topics", label: "토픽 운영", badge: pendingResolveCount, active: true },
          { href: "/admin/moderation", label: "신고/정산", active: false },
          { href: "/admin/topics/new", label: "새 토픽", active: false },
        ]}
      />

      <Card className="admin-segment-nav-card">
        <div className="admin-segment-nav-head">
          <p className="admin-jump-nav-label">Queue mode</p>
          <Pill tone={selectedStatus === "ALL" ? "success" : "neutral"}>{selectedStatus}</Pill>
        </div>
        <div className="admin-segment-nav-grid" aria-label="토픽 상태 빠른 전환">
          <Link href={`/admin/topics?status=ALL&q=${encodeURIComponent(keyword)}`} className={`admin-segment-nav-item${selectedStatus === "ALL" ? " is-active" : ""}`}>
            <span>All queue</span>
            <strong>{topics.length}</strong>
          </Link>
          <Link href={`/admin/topics?status=OPEN&q=${encodeURIComponent(keyword)}`} className={`admin-segment-nav-item is-danger${selectedStatus === "OPEN" ? " is-active" : ""}`}>
            <span>OPEN</span>
            <strong>{statusCounts.OPEN}</strong>
          </Link>
          <Link href={`/admin/topics?status=LOCKED&q=${encodeURIComponent(keyword)}`} className={`admin-segment-nav-item is-warning${selectedStatus === "LOCKED" ? " is-active" : ""}`}>
            <span>LOCKED</span>
            <strong>{statusCounts.LOCKED}</strong>
          </Link>
          <Link href={`/admin/topics?status=RESOLVED&q=${encodeURIComponent(keyword)}`} className={`admin-segment-nav-item is-ok${selectedStatus === "RESOLVED" ? " is-active" : ""}`}>
            <span>RESOLVED</span>
            <strong>{statusCounts.RESOLVED}</strong>
          </Link>
        </div>
      </Card>

      <Card className="admin-thumb-rail-card">
        <p className="admin-jump-nav-label">Thumb rail · Next action</p>
        <div className="admin-thumb-rail-scroll" aria-label="토픽 운영 바로가기">
          <Link href="/admin/topics?status=OPEN" className="admin-thumb-chip is-danger">OPEN {statusCounts.OPEN}</Link>
          <Link href="/admin/topics?status=LOCKED" className="admin-thumb-chip">LOCKED {statusCounts.LOCKED}</Link>
          <a href="#topic-priority" className="admin-thumb-chip">우선순위</a>
          <a href="#topic-integrity-watch" className="admin-thumb-chip">무결성 워치</a>
          <a href="#topic-list" className="admin-thumb-chip">리스트로 이동</a>
        </div>
        <p className="admin-thumb-rail-note">{nextActionLabel}</p>
      </Card>

      <Card className="admin-integrity-command-bar" aria-label="토픽 정산 무결성 즉시 명령">
        <div className="admin-integrity-command-head">
          <p className="admin-jump-nav-label">Integrity command bar</p>
          <Pill tone={integrityIssueTotal > 0 ? "danger" : "success"}>{integrityIssueTotal > 0 ? `위험 ${integrityIssueTotal}건` : "모든 가드레일 정상"}</Pill>
        </div>
        <div className="admin-integrity-command-grid">
          <Link href="/admin/topics?status=RESOLVED" className={`admin-integrity-command-item is-${unresolvedSettledBacklogCount > 0 ? "danger" : "ok"}`}>
            <span>RESOLVED 백로그</span>
            <strong>{unresolvedSettledBacklogCount}건</strong>
            <small>미정산 건 즉시 복구</small>
          </Link>
          <Link href="/admin/topics?status=RESOLVED" className={`admin-integrity-command-item is-${settledWithNullPayoutCount > 0 ? "danger" : "ok"}`}>
            <span>지급값 누락</span>
            <strong>{settledWithNullPayoutCount}건</strong>
            <small>payoutAmount 누락 확인</small>
          </Link>
          <Link href="/admin/topics?status=RESOLVED" className={`admin-integrity-command-item is-${resolvedWithoutResolutionCount > 0 ? "warning" : "ok"}`}>
            <span>결과 레코드</span>
            <strong>{resolvedWithoutResolutionCount}건</strong>
            <small>resolution 연결 상태</small>
          </Link>
          <Link href="#topic-integrity-watch" className={`admin-integrity-command-item is-${hasPayoutRatioOutlier ? "warning" : "ok"}`}>
            <span>배당률 밴드</span>
            <strong>{payoutRatio}%</strong>
            <small>90~110% 운영 밴드</small>
          </Link>
        </div>
      </Card>

      <Card className="admin-context-bar">
        <div className="admin-context-grid">
          {experienceSignals.map((item) => (
            <article key={item.id} className={`admin-context-item is-${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.hint}</small>
            </article>
          ))}
        </div>
      </Card>

      <Card className="admin-incident-digest-card">
        <div className="admin-incident-digest-head">
          <div>
            <p className="admin-jump-nav-label">Incident digest</p>
            <h2 className="admin-command-title">현재 가장 큰 토픽 무결성 리스크</h2>
          </div>
          <Pill tone={topTopicIntegrityIncident && topTopicIntegrityIncident.count > 0 ? "danger" : "success"}>
            {topTopicIntegrityIncident && topTopicIntegrityIncident.count > 0 ? "Action needed" : "All clear"}
          </Pill>
        </div>
        <div className="admin-incident-digest-body">
          <div>
            <strong>{topTopicIntegrityIncident?.label ?? "토픽 무결성 경고 없음"}</strong>
            <p>{topTopicIntegrityIncident?.description ?? "토픽 무결성 지표가 정상 범위를 유지합니다."}</p>
          </div>
          <div className="admin-incident-digest-meta">
            <span className="admin-watch-count">{topTopicIntegrityIncident?.count ?? 0}</span>
            <Link href={topTopicIntegrityIncident?.href ?? "/admin/topics?status=RESOLVED"} className="btn btn-secondary">즉시 점검</Link>
          </div>
        </div>
      </Card>

      <Card className="admin-recovery-card">
        <div className="admin-recovery-head">
          <div>
            <p className="admin-jump-nav-label">Settlement action pack</p>
            <h2 className="admin-command-title">엄지 우선 복구 패키지</h2>
          </div>
          <Pill tone={integrityIssueTotal > 0 ? "danger" : "success"}>{integrityIssueTotal > 0 ? `복구 ${integrityIssueTotal}건` : "복구 대상 없음"}</Pill>
        </div>
        <p className="admin-card-intro">리스크가 큰 순서대로 카드가 정렬됩니다. 모바일에서 위에서 아래로 누르며 복구하세요.</p>
        <div className="admin-recovery-grid" style={{ marginTop: "0.68rem" }}>
          {settlementActionPack
            .slice()
            .sort((a, b) => b.count - a.count)
            .map((item) => (
              <Link key={item.id} href={item.href} className={`admin-recovery-item is-${item.tone}`}>
                <span className="admin-recovery-label">{item.label}</span>
                <strong className="admin-recovery-value">{item.value}</strong>
                <small>{item.hint}</small>
                <span className="admin-recovery-cta">즉시 처리 →</span>
              </Link>
            ))}
        </div>
      </Card>

      <Card className="admin-northstar-card">
        <div className="admin-northstar-head">
          <div>
            <p className="admin-jump-nav-label">Ops north star</p>
            <h2 className="admin-command-title">토픽 운영 핵심 지표</h2>
          </div>
          <Pill tone={integrityIssueTotal > 0 ? "danger" : "success"}>{integrityIssueTotal > 0 ? "Attention" : "Stable"}</Pill>
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

      <Card className="admin-jump-nav-card admin-jump-nav-card-sticky">
        <p className="admin-jump-nav-label">Quick jump</p>
        <div className="admin-jump-nav" aria-label="토픽 운영 섹션 바로가기">
          <a href="#topic-priority" className="admin-jump-nav-item">우선순위</a>
          <a href="#topic-execution" className="admin-jump-nav-item">실행 타임라인</a>
          <a href="#topic-integrity-watch" className="admin-jump-nav-item">무결성 워치</a>
          <a href="#topic-list" className="admin-jump-nav-item">토픽 리스트</a>
        </div>
      </Card>

      <Card className="admin-surface-card admin-surface-card-priority">
        <SectionTitle>토픽 운영 온도계</SectionTitle>
        <p className="admin-card-intro">큐 체류 시간과 정산 무결성을 점수화해 모바일에서 즉시 대응 우선순위를 고정합니다.</p>
        <div className="ops-health-strip" style={{ marginTop: "0.72rem" }}>
          <div className={`ops-health-item ${topicQueueStressScore >= 60 ? "is-danger" : topicQueueStressScore >= 30 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Queue Stress</span>
            <strong className="ops-health-value">{topicQueueStressScore}</strong>
            <small>OPEN {statusCounts.OPEN} · 24h+ OPEN {staleOpenCount}</small>
          </div>
          <div className={`ops-health-item ${topicIntegrityRiskScore >= 45 ? "is-danger" : topicIntegrityRiskScore > 0 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Integrity Risk</span>
            <strong className="ops-health-value">{topicIntegrityRiskScore}</strong>
            <small>미정산 백로그 {unresolvedSettledBacklogCount} · 결과 누락 {resolvedWithoutResolutionCount}</small>
          </div>
          <div className={`ops-health-item ${topicConfidence === "낮음" ? "is-danger" : topicConfidence === "보통" ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Settlement Confidence</span>
            <strong className="ops-health-value">{topicConfidence}</strong>
            <small>토픽 정산 신뢰도 상태</small>
          </div>
        </div>
      </Card>

      <Card className="admin-command-card">
        <div className="admin-command-head">
          <div>
            <p className="admin-command-kicker">Topic command rail</p>
            <h2 className="admin-command-title">지금 처리할 핵심 3단계</h2>
          </div>
          <Pill tone={canUseDb ? "success" : "neutral"}>{dataModeLabel}</Pill>
        </div>
        {!canUseDb ? (
          <p className="admin-command-warning">DATABASE_URL 미설정 상태라 로컬 fallback 데이터 기준으로 표시됩니다. 운영 점검 전 배포 환경 변수 확인을 권장합니다.</p>
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
            <p className="admin-jump-nav-label">Topic lanes</p>
            <h2 className="admin-command-title">한 손 우선순위 처리 레인</h2>
          </div>
          <Pill tone={pendingResolveCount > 0 ? "danger" : "success"}>Actionable {pendingResolveCount}</Pill>
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

      <StatePanel
        title={integrityIssueTotal > 0 ? "토픽 정산 무결성 점검 필요" : "토픽 정산 무결성 안정"}
        description={integrityIssueTotal > 0
          ? `정산 누락/결과 불일치 이슈 ${integrityIssueTotal}건이 감지되었습니다. 토픽 해소 전 데이터 정합성을 먼저 정리하세요.`
          : "토픽 정산 무결성 이슈가 없습니다. 현재 운영 기준이 안정적으로 유지되고 있습니다."}
        tone={integrityIssueTotal > 0 ? "warning" : "success"}
        actions={(
          <>
            <Link className="btn btn-primary" href="/admin/moderation">모더레이션/정산 대시보드</Link>
            <Link className="btn btn-secondary" href="/admin/topics?status=RESOLVED">RESOLVED 토픽 점검</Link>
          </>
        )}
      />

      <Card id="topic-priority" className="admin-surface-card admin-surface-card-priority">
        <SectionTitle>오늘의 우선순위</SectionTitle>
        <div className="row" style={{ marginTop: "0.65rem", flexWrap: "wrap", gap: "0.45rem" }}>
          <Pill tone={pendingResolveCount > 0 ? "danger" : "success"}>처리 필요 {pendingResolveCount}</Pill>
          <Pill tone={staleOpenCount > 0 ? "danger" : "neutral"}>24h+ OPEN {staleOpenCount}</Pill>
          <Pill tone={statusCounts.LOCKED > 0 ? "danger" : "neutral"}>LOCKED {statusCounts.LOCKED}</Pill>
          <Pill tone={integrityIssueTotal > 0 ? "danger" : "success"}>무결성 이슈 {integrityIssueTotal}</Pill>
        </div>
        <p className="admin-muted-note">Next best action: {nextActionLabel}</p>
      </Card>

      <Card id="topic-execution" className="admin-timeline-card">
        <SectionTitle>Execution timeline</SectionTitle>
        <p className="admin-card-intro">Now → Next → Later 순서로 토픽 운영 흐름을 고정해 모바일에서도 우선순위를 놓치지 않게 합니다.</p>
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
        <SectionTitle>Queue SLA snapshot</SectionTitle>
        <p className="admin-card-intro">OPEN/LOCKED 체류 시간을 3단계로 분리해 모바일에서도 지연 징후를 빠르게 확인합니다.</p>
        <div className="ops-health-strip" style={{ marginTop: "0.68rem" }}>
          <div className={`ops-health-item ${staleOpenCount > 0 ? "is-danger" : staleLockedCount > 0 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">SLA 상태</span>
            <strong className="ops-health-value">{queueSlaLabel}</strong>
            <small>24h+ OPEN {staleOpenCount} · 24h+ LOCKED {staleLockedCount}</small>
          </div>
          <div className={`ops-health-item ${statusCounts.OPEN > 0 ? "is-danger" : "is-ok"}`}>
            <span className="ops-health-label">OPEN backlog</span>
            <strong className="ops-health-value">{statusCounts.OPEN}건</strong>
            <small>신규/미해결 인입 큐</small>
          </div>
          <div className={`ops-health-item ${statusCounts.LOCKED > 0 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">LOCKED settle</span>
            <strong className="ops-health-value">{statusCounts.LOCKED}건</strong>
            <small>정산/결과 확정 대기</small>
          </div>
        </div>
      </Card>

      <Card className="admin-cadence-card">
        <SectionTitle>Response cadence</SectionTitle>
        <p className="admin-card-intro">토픽 대응 우선순위를 Critical → Active → Healthy 흐름으로 고정합니다.</p>
        <div className="admin-cadence-grid" style={{ marginTop: "0.68rem" }}>
          {topicResponseCadence.map((item) => (
            <Link key={item.id} href={item.href} className={`admin-cadence-item is-${item.tone}`}>
              <span className="admin-cadence-label">{item.label}</span>
              <strong>{item.metric}</strong>
              <small>{item.hint}</small>
            </Link>
          ))}
        </div>
      </Card>

      <Card id="topic-integrity-watch" className="admin-surface-card admin-guardrail-card">
        <SectionTitle>Settlement integrity watch</SectionTitle>
        <p className="admin-muted-note">정산 전 필수 체크 3가지를 고정해 토픽 상태와 결과 정합성을 빠르게 검증합니다.</p>
        <div className="ops-health-strip" style={{ marginTop: "0.68rem" }}>
          <div className={`ops-health-item is-${settlementReadinessTone}`}>
            <span className="ops-health-label">Readiness score</span>
            <strong className="ops-health-value">{settlementReadinessScore}</strong>
            <small>{settlementReadinessLabel} · 무결성 이슈 {integrityIssueTotal}건</small>
          </div>
          <div className={`ops-health-item ${statusCounts.LOCKED > 0 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Locked queue</span>
            <strong className="ops-health-value">{statusCounts.LOCKED}건</strong>
            <small>정산/결과 확정 대기 토픽</small>
          </div>
          <div className={`ops-health-item ${staleOpenCount > 0 ? "is-danger" : "is-ok"}`}>
            <span className="ops-health-label">Open latency</span>
            <strong className="ops-health-value">{staleOpenCount}건</strong>
            <small>24시간 이상 OPEN 토픽</small>
          </div>
        </div>
        <div className="admin-guardrail-grid" style={{ marginTop: "0.65rem" }}>
          {settlementGuardrails.map((item) => (
            <article key={item.key} className={`admin-guardrail-item is-${item.tone}`}>
              <strong>{item.label}</strong>
              <small>{item.helper}</small>
              <span>{item.count === 0 ? "PASS" : `${item.count}건`}</span>
            </article>
          ))}
        </div>
        <div className="admin-watch-grid" style={{ marginTop: "0.68rem" }}>
          {integrityWatchItems.map((item) => (
            <Link key={item.key} href={item.href} className={`admin-watch-card is-${item.tone}`}>
              <span className="admin-watch-count">{item.count}</span>
              <strong className="admin-watch-title">{item.label}</strong>
              <small className="admin-watch-description">{item.description}</small>
              <span className="admin-watch-action">{item.actionLabel} →</span>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="admin-settlement-sla-card">
        <SectionTitle>Settlement SLA</SectionTitle>
        <p className="admin-muted-note">정산 신뢰도를 유지하기 위한 운영 기준입니다. 기준을 넘기면 즉시 RESOLVED/LOCKED 큐로 이동해 복구하세요.</p>
        <div className="admin-settlement-sla-grid" style={{ marginTop: "0.66rem" }}>
          <article className={`admin-settlement-sla-item ${unresolvedSettledBacklogCount > 0 ? "is-danger" : "is-ok"}`}>
            <span className="admin-settlement-sla-label">RESOLVED 미정산</span>
            <strong className="admin-settlement-sla-value">{unresolvedSettledBacklogCount}건</strong>
            <small>목표 0건 · 초과 시 즉시 정산 재실행</small>
          </article>
          <article className={`admin-settlement-sla-item ${resolvedWithoutResolutionCount > 0 ? "is-warning" : "is-ok"}`}>
            <span className="admin-settlement-sla-label">결과 레코드 누락</span>
            <strong className="admin-settlement-sla-value">{resolvedWithoutResolutionCount}건</strong>
            <small>목표 0건 · RESOLVED 전 resolution 연결 필수</small>
          </article>
          <article className={`admin-settlement-sla-item ${staleLockedCount > 0 ? "is-warning" : "is-ok"}`}>
            <span className="admin-settlement-sla-label">LOCKED 체류 24h+</span>
            <strong className="admin-settlement-sla-value">{staleLockedCount}건</strong>
            <small>목표 0건 · 장기 LOCKED는 우선 Resolve</small>
          </article>
        </div>
      </Card>

      <Card id="topic-spotlight">
        <SectionTitle>모바일 스포트라이트</SectionTitle>
        <p className="admin-muted-note">엄지 한 번으로 지금 처리해야 할 토픽으로 이동합니다.</p>
        {spotlightTopics.length > 0 ? (
          <div className="admin-spotlight-grid" style={{ marginTop: "0.65rem" }}>
            {spotlightTopics.map((topic) => {
              const ageHours = Math.floor((Date.now() - new Date(topic.createdAt).getTime()) / (1000 * 60 * 60));
              return (
                <Link key={topic.id} href={`/admin/topics/${topic.id}/resolve`} className="admin-spotlight-link">
                  <span className="admin-spotlight-status">{topic.status}</span>
                  <strong className="admin-spotlight-title">{topic.title}</strong>
                  <small className="admin-spotlight-meta">경과 {Math.max(ageHours, 0)}시간 · Resolve 바로가기</small>
                </Link>
              );
            })}
          </div>
        ) : (
          <AdminEmptyState
            icon="✓"
            tone="success"
            statusLabel="Clear"
            kicker="Spotlight clear"
            title="스포트라이트 대상이 없습니다"
            description="긴급 처리할 OPEN/LOCKED 토픽이 없습니다. 신규 토픽 품질 점검을 진행하세요."
          />
        )}
      </Card>

      {unresolvedSettledBacklogTopics.length > 0 ? (
        <Card>
          <SectionTitle>정산 누락 우선 확인 토픽</SectionTitle>
          <ul className="simple-list" style={{ marginTop: "0.6rem" }}>
            {unresolvedSettledBacklogTopics.map((topic) => (
              <li key={topic.id}>
                <Link className="text-link" href={`/admin/topics/${topic.id}/resolve`}>
                  {topic.title}
                </Link>
                <small style={{ color: "#6b7280" }}> · 미정산 {topic._count.bets}건</small>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>운영 내비게이션</SectionTitle>
        <div className="admin-link-grid" style={{ marginTop: "0.72rem" }}>
          <Link className="admin-quick-link" href="/topics">사용자 토픽 목록 보기</Link>
          <Link className="admin-quick-link" href="/admin/topics/new">새 토픽 생성</Link>
          <Link className="admin-quick-link" href="/admin/moderation">모더레이션/정산 현황</Link>
        </div>
      </Card>

      <Card className="admin-mode-switcher-card">
        <div className="admin-filter-summary-head">
          <SectionTitle>Queue mode switch</SectionTitle>
          <Pill tone={pendingResolveCount > 0 ? "danger" : "success"}>Actionable {pendingResolveCount}</Pill>
        </div>
        <p className="admin-card-intro">토픽 운영 단계를 상황별 모드로 나눠서 한 손으로 빠르게 우선순위를 전환하세요.</p>
        <div className="admin-mode-switcher-grid" style={{ marginTop: "0.65rem" }}>
          <Link href="/admin/topics?status=OPEN" className="admin-mode-switcher-item is-danger">
            <span>Intake focus</span>
            <strong>OPEN {statusCounts.OPEN}</strong>
            <small>신규 토픽 즉시 분류</small>
          </Link>
          <Link href="/admin/topics?status=LOCKED" className="admin-mode-switcher-item is-warning">
            <span>Settlement focus</span>
            <strong>LOCKED {statusCounts.LOCKED}</strong>
            <small>정산/결과 확정 처리</small>
          </Link>
          <Link href="/admin/topics?status=RESOLVED" className="admin-mode-switcher-item is-ok">
            <span>Integrity focus</span>
            <strong>이슈 {integrityIssueTotal}건</strong>
            <small>RESOLVED 무결성 검증</small>
          </Link>
        </div>
      </Card>

      <Card id="topic-filter">
        <SectionTitle>토픽 필터</SectionTitle>
        <div className="chip-row-scroll" style={{ marginTop: "0.72rem" }} aria-label="토픽 상태 필터">
          <Link
            className={`filter-chip${selectedStatus === "ALL" ? " is-active" : ""}`}
            href={`/admin/topics?status=ALL&q=${encodeURIComponent(keyword)}`}
          >
            ALL {topics.length}
          </Link>
          {STATUS_ORDER.map((status) => (
            <Link
              key={status}
              className={`filter-chip${selectedStatus === status ? " is-active" : ""}`}
              href={`/admin/topics?status=${status}&q=${encodeURIComponent(keyword)}`}
            >
              {status} {statusCounts[status]}
            </Link>
          ))}
        </div>

        <form method="get" className="row moderation-filter-form" style={{ marginTop: "0.75rem", gap: "0.55rem", flexWrap: "wrap" }}>
          <input type="hidden" name="status" value={selectedStatus} />
          <input
            className="input moderation-filter-search"
            name="q"
            defaultValue={query?.q ?? ""}
            placeholder="토픽 id/제목/설명 검색"
          />
          <button
            type="submit"
            className="btn btn-primary moderation-filter-submit"
          >
            필터 적용
          </button>
        </form>
      </Card>

      <div id="topic-list" className="list">
        {selectedStatus === "ALL" && !keyword ? (
          <StatePanel
            title="오늘의 실행 루틴"
            description={`OPEN/LOCKED ${pendingResolveCount}건을 우선 정리하고, RESOLVED 무결성 이슈 ${integrityIssueTotal}건을 이어서 점검하세요.`}
            tone={pendingResolveCount > 0 || integrityIssueTotal > 0 ? "warning" : "success"}
            actions={
              pendingResolveCount > 0
                ? <Link className="btn btn-primary" href="/admin/topics?status=OPEN">OPEN 토픽 먼저 보기</Link>
                : <Link className="btn btn-secondary" href="/admin/topics/new">새 토픽 만들기</Link>
            }
          />
        ) : null}
        {filteredTopics.map((topic) => {
          const createdAt = new Date(topic.createdAt);
          const ageHours = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60));
          const isAgingOpen = topic.status === "OPEN" && ageHours >= 24;

          return (
            <Card key={topic.id}>
              <article className="admin-list-card">
                <div className="admin-list-card-head">
                  <div className="admin-list-card-title-wrap">
                    <p className="admin-list-card-kicker">{topic.id}</p>
                    <h3 className="admin-list-card-title">{topic.title}</h3>
                  </div>
                  <div className="row" style={{ gap: "0.45rem" }}>
                    {isAgingOpen ? <Pill tone="danger">24h+ 지연</Pill> : null}
                    {topic.status === "OPEN" ? <Pill tone="danger">우선 확인</Pill> : null}
                    <Pill tone={topic.status === "RESOLVED" ? "success" : "neutral"}>{topic.status}</Pill>
                  </div>
                </div>

                <p className="admin-list-card-description">{topic.description}</p>

                <div className="admin-list-card-meta-row">
                  <span>생성 {createdAt.toLocaleDateString("ko-KR")}</span>
                  <span>경과 {Math.max(ageHours, 0)}시간</span>
                </div>

                <div className="row admin-topic-link-row">
                  <Link className="text-link" href={`/topics/${topic.id}`}>상세 보기</Link>
                  <Link className="text-link" href={`/admin/topics/${topic.id}/resolve`}>
                    {topic.status === "RESOLVED" ? "정산 결과 보기" : "Resolve"}
                  </Link>
                </div>

                <div style={{ marginTop: "0.74rem" }}>
                  <TopicQuickActions topicId={topic.id} topicStatus={topic.status} />
                </div>
              </article>
            </Card>
          );
        })}
        {filteredTopics.length === 0 ? (
          <AdminEmptyState
            icon="⌕"
            tone="warning"
            statusLabel="Filtered"
            kicker="No topic match"
            title="조건에 맞는 토픽이 없습니다"
            description="검색어를 줄이거나 상태를 ALL로 전환해 다시 확인하세요."
            tips={[
              "OPEN 또는 LOCKED로 빠르게 전환해 운영 큐부터 점검",
              "검색어 대신 상태 필터만 적용해 누락 토픽 확인",
            ]}
            actions={<Link className="btn btn-secondary" href="/admin/topics?status=ALL">필터 초기화</Link>}
          />
        ) : null}
      </div>

      <div className="admin-mobile-dock" aria-label="모바일 토픽 운영 빠른 실행">
        <Link href="/admin/topics?status=OPEN" className={`admin-quick-action-btn${selectedStatus === "OPEN" ? " is-active" : ""}`}>OPEN {statusCounts.OPEN}</Link>
        <Link href="/admin/topics?status=LOCKED" className={`admin-quick-action-btn${selectedStatus === "LOCKED" ? " is-active" : ""}`}>LOCKED {statusCounts.LOCKED}</Link>
        <Link href={integrityIssueTotal > 0 ? "#topic-integrity-watch" : "/admin/topics/new"} className="admin-quick-action-btn">
          {integrityIssueTotal > 0 ? `정산 ${integrityIssueTotal}건` : "새 토픽"}
        </Link>
      </div>
      <div className="admin-mobile-dock-spacer" aria-hidden />
    </PageContainer>
  );
}
