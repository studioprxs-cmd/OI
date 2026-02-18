import Link from "next/link";
import { redirect } from "next/navigation";

import { OiBadge, PageContainer, StatePanel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";

import { WalletActivityClient } from "./WalletActivityClient";

export default async function WalletPage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");

  return (
    <PageContainer>
      <div className="wallet-layout">
        <section className="hero-block compact wallet-hero">
          <OiBadge label="WALLET" />
          <p className="hero-eyebrow">Point Ledger</p>
          <h1>내 포인트 지갑</h1>
          <p>
            베팅/보상/정산 흐름을 한 화면에서 확인하세요. 최근 원장 내역을 빠르게 스캔하고,
            수익·소각 패턴을 보고 다음 참여 액션으로 바로 이어질 수 있게 구성했습니다.
          </p>
        </section>

        <WalletActivityClient />

        <StatePanel
          title="참여 루프 바로가기"
          description="활동 이력 확인 후 바로 오잉/토픽으로 진입해 참여를 이어가세요."
          tone="success"
          actions={(
            <div className="wallet-quick-links">
              <Link href="/oing" className="btn btn-primary">오잉 마켓 보드</Link>
              <Link href="/topics" className="btn btn-ghost">토픽 둘러보기</Link>
            </div>
          )}
        />
      </div>
    </PageContainer>
  );
}
