import Link from "next/link";

import { AdminSectionTabs, Card, PageContainer, Pill, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { getInflationSnapshot, getOpsIssueBurnSnapshot } from "@/lib/ops-dashboard";

async function loadIntegritySummary() {
  if (!process.env.DATABASE_URL) {
    return {
      userCount: 0,
      driftUsers: 0,
      duplicateSettleRefs: 0,
      duplicateRefundRefs: 0,
      duplicateVoteRefs: 0,
      snapshotAt: new Date().toISOString(),
    };
  }

  const [users, txAgg, duplicateSettle, duplicateRefund, duplicateVote] = await Promise.all([
    db.user.findMany({
      select: { id: true, pointBalance: true },
    }),
    db.walletTransaction.groupBy({
      by: ["userId"],
      _sum: { amount: true },
    }),
    db.walletTransaction
      .groupBy({
        by: ["relatedBetId"],
        where: { type: "BET_SETTLE", relatedBetId: { not: null } },
        _count: { relatedBetId: true },
      })
      .then((rows) => rows.filter((row) => (row._count.relatedBetId ?? 0) > 1).length),
    db.walletTransaction
      .groupBy({
        by: ["relatedBetId"],
        where: { type: "BET_REFUND", relatedBetId: { not: null } },
        _count: { relatedBetId: true },
      })
      .then((rows) => rows.filter((row) => (row._count.relatedBetId ?? 0) > 1).length),
    db.walletTransaction
      .groupBy({
        by: ["relatedVoteId"],
        where: { type: "VOTE_REWARD", relatedVoteId: { not: null } },
        _count: { relatedVoteId: true },
      })
      .then((rows) => rows.filter((row) => (row._count.relatedVoteId ?? 0) > 1).length),
  ]);

  const txMap = new Map(txAgg.map((row) => [row.userId, Number(row._sum.amount ?? 0)]));
  const driftUsers = users.filter((user) => user.pointBalance !== (txMap.get(user.id) ?? 0)).length;

  return {
    userCount: users.length,
    driftUsers,
    duplicateSettleRefs: duplicateSettle,
    duplicateRefundRefs: duplicateRefund,
    duplicateVoteRefs: duplicateVote,
    snapshotAt: new Date().toISOString(),
  };
}

function toneByRatio(ratio: number): "success" | "neutral" | "danger" {
  if (ratio >= 0.7) return "success";
  if (ratio >= 0.5) return "neutral";
  return "danger";
}

export default async function AdminOpsPage() {
  const [inflation7d, issueBurn14d, integrity] = await Promise.all([
    getInflationSnapshot(7),
    getOpsIssueBurnSnapshot(14),
    loadIntegritySummary(),
  ]);

  const burnRatio7dPercent = Math.round(inflation7d.totals.burnToIssueRatio * 100);
  const burnRatio14dPercent = Math.round(issueBurn14d.totals.burnToIssueRatio * 100);

  const duplicateRefTotal = integrity.duplicateSettleRefs + integrity.duplicateRefundRefs + integrity.duplicateVoteRefs;

  return (
    <PageContainer>
      <section className="admin-hero admin-hero-market">
        <div>
          <p className="admin-hero-kicker">OPS DASHBOARD · P1</p>
          <h1 className="admin-hero-title">포인트 발행/소각 · 원장 무결성 컨트롤 타워</h1>
          <p className="admin-hero-subtitle">
            운영 핵심 지표(7d/14d)와 원장 레퍼런스 중복, 유저 잔액 드리프트를 한 화면에서 빠르게 점검합니다.
          </p>
        </div>
        <div className="admin-hero-actions">
          <Pill tone={toneByRatio(inflation7d.totals.burnToIssueRatio)}>{`7d Burn/Issue ${burnRatio7dPercent}%`}</Pill>
          <Pill tone={duplicateRefTotal > 0 ? "danger" : "success"}>{duplicateRefTotal > 0 ? `중복 레퍼런스 ${duplicateRefTotal}건` : "레퍼런스 무결성 정상"}</Pill>
        </div>
      </section>

      <AdminSectionTabs
        items={[
          { href: "/admin/topics", label: "토픽 운영", active: false },
          { href: "/admin/moderation", label: "신고/정산", active: false },
          { href: "/admin/market", label: "마켓 운영", active: false },
          { href: "/admin/ops", label: "운영 지표", active: true },
        ]}
      />

      <Card>
        <SectionTitle>운영 북극성</SectionTitle>
        <div className="ops-health-strip" style={{ marginTop: "0.72rem" }}>
          <div className={`ops-health-item is-${burnRatio7dPercent >= 70 ? "ok" : burnRatio7dPercent >= 50 ? "warning" : "danger"}`}>
            <span className="ops-health-label">Burn / Issue (7d)</span>
            <strong className="ops-health-value">{burnRatio7dPercent}%</strong>
            <small>목표 70%+</small>
          </div>
          <div className={`ops-health-item is-${burnRatio14dPercent >= 70 ? "ok" : burnRatio14dPercent >= 50 ? "warning" : "danger"}`}>
            <span className="ops-health-label">Burn / Issue (14d)</span>
            <strong className="ops-health-value">{burnRatio14dPercent}%</strong>
            <small>중기 트렌드</small>
          </div>
          <div className={`ops-health-item ${integrity.driftUsers > 0 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Balance drift users</span>
            <strong className="ops-health-value">{integrity.driftUsers}명</strong>
            <small>잔액-원장 합 불일치</small>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>최근 7일 발행/소각</SectionTitle>
        <div style={{ display: "grid", gap: "0.45rem", marginTop: "0.75rem" }}>
          {inflation7d.days.map((day) => (
            <article key={day.dateKey} style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: "0.7rem" }}>
              <strong>{day.dateKey.slice(5)}</strong>
              <div style={{ display: "grid", gap: "0.25rem" }}>
                <span>발행 {day.issuedPoints.toLocaleString()}pt</span>
                <span>소각 {day.burnedPoints.toLocaleString()}pt</span>
                <small>순증감 {day.netPoints >= 0 ? "+" : ""}{day.netPoints.toLocaleString()}pt</small>
              </div>
            </article>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>원장 무결성 요약</SectionTitle>
        <p className="admin-muted-note" style={{ marginTop: "0.45rem" }}>
          snapshot: {integrity.snapshotAt}
        </p>
        <div className="ops-health-strip" style={{ marginTop: "0.72rem" }}>
          <div className={`ops-health-item ${duplicateRefTotal > 0 ? "is-danger" : "is-ok"}`}>
            <span className="ops-health-label">Duplicate refs</span>
            <strong className="ops-health-value">{duplicateRefTotal}건</strong>
            <small>SETTLE/REFUND/VOTE</small>
          </div>
          <div className={`ops-health-item ${integrity.driftUsers > 0 ? "is-warning" : "is-ok"}`}>
            <span className="ops-health-label">Drift users</span>
            <strong className="ops-health-value">{integrity.driftUsers}/{integrity.userCount}</strong>
            <small>잔액 동기화 필요</small>
          </div>
          <div className="ops-health-item is-ok">
            <span className="ops-health-label">Quick actions</span>
            <strong className="ops-health-value">Integrity API</strong>
            <small>
              <Link href="/api/admin/integrity/points" className="text-link">/api/admin/integrity/points</Link>
            </small>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
