import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, PageContainer, Pill, SectionTitle, StatePanel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

const BETTING_GAIN_TYPES = ["BET_SETTLE", "BET_REFUND"] as const;

function formatPoint(value: number) {
  return `${value.toLocaleString("ko-KR")}P`;
}

export default async function WalletPage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");

  if (!process.env.DATABASE_URL) {
    return (
      <PageContainer>
        <div className="market-layout">
          <section className="hero-block compact market-hero">
            <p className="hero-eyebrow">BETTING WALLET</p>
            <h1>포인트 지갑</h1>
            <p>베팅으로 획득한 포인트 내역을 확인하는 공간입니다.</p>
          </section>

          <StatePanel
            title="지갑 내역을 불러올 수 없습니다"
            description="DATABASE_URL이 없는 실행 환경이라 실제 지갑 트랜잭션 조회가 비활성화되었습니다."
            tone="warning"
            actions={<Link href="/oing" className="btn btn-primary">오잉으로 이동</Link>}
          />
        </div>
      </PageContainer>
    );
  }

  const [items, aggregate] = await Promise.all([
    db.walletTransaction.findMany({
      where: {
        userId: viewer.id,
        type: { in: [...BETTING_GAIN_TYPES] },
        amount: { gt: 0 },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        relatedBetId: true,
        note: true,
        createdAt: true,
      },
    }),
    db.walletTransaction.aggregate({
      where: {
        userId: viewer.id,
        type: { in: [...BETTING_GAIN_TYPES] },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const totalEarned = aggregate._sum.amount ?? 0;
  const totalCount = aggregate._count._all ?? 0;

  return (
    <PageContainer>
      <div className="market-layout">
        <section className="hero-block compact market-hero">
          <p className="hero-eyebrow">BETTING WALLET</p>
          <h1>포인트 지갑</h1>
          <p>베팅 정산/환급으로 획득한 포인트 히스토리를 한눈에 확인하세요.</p>
        </section>

        <Card>
          <SectionTitle>요약</SectionTitle>
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            <Pill tone="success">누적 획득 {formatPoint(totalEarned)}</Pill>
            <Pill tone="neutral">총 {totalCount}건</Pill>
            <Link href="/oing" className="text-link">오잉에서 더 참여하기</Link>
          </div>
        </Card>

        <div className="list">
          {items.length === 0 ? (
            <Card>아직 베팅으로 획득한 포인트 내역이 없습니다. 오잉에서 베팅 후 결과 정산을 기다려보세요.</Card>
          ) : (
            items.map((item) => {
              const isSettle = item.type === "BET_SETTLE";
              return (
                <Card key={item.id}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.65rem" }}>
                    <div>
                      <strong>{isSettle ? "베팅 정산" : "베팅 환급"}</strong>
                      <p style={{ margin: "0.35rem 0", color: "#5f6f66" }}>
                        +{formatPoint(item.amount)} · 잔액 {formatPoint(item.balanceAfter)}
                      </p>
                      <small style={{ color: "#75857b" }}>{new Date(item.createdAt).toLocaleString("ko-KR")}</small>
                      {item.relatedBetId ? (
                        <p style={{ margin: "0.35rem 0 0" }}>
                          <code style={{ fontSize: "0.76rem", color: "#2d4738" }}>bet #{item.relatedBetId.slice(0, 8)}</code>
                        </p>
                      ) : null}
                      {item.note ? <p style={{ margin: "0.3rem 0 0", color: "#6f7f75" }}>{item.note}</p> : null}
                    </div>
                    <Pill tone={isSettle ? "success" : "neutral"}>{item.type}</Pill>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </PageContainer>
  );
}
