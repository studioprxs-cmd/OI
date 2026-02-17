import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminMarketComposer } from "./AdminMarketComposer";

import { AdminSectionTabs, Card, PageContainer, Pill, SectionTitle } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { getMarketProducts, MARKET_ZONES } from "@/lib/market/catalog";

export default async function AdminMarketPage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/auth/signin");
  if (viewer.role !== "ADMIN") redirect("/");

  const products = getMarketProducts();
  const activeCount = products.filter((product) => product.isActive).length;

  return (
    <PageContainer>
      <section className="admin-hero-shell">
        <p className="admin-hero-eyebrow">Market Operations</p>
        <h1 className="admin-hero-title">Admin · Market Catalog</h1>
        <p className="admin-hero-subtitle">P1 마켓 MVP 운영용 상품 등록/상태 점검 화면입니다. 모바일에서 한 손으로 존별 상품 품질을 빠르게 관리하세요.</p>
      </section>

      <AdminSectionTabs
        items={[
          { href: "/admin/topics", label: "토픽 운영", active: false },
          { href: "/admin/moderation", label: "신고/정산", active: false },
          { href: "/admin/market", label: "마켓 운영", badge: products.length, active: true },
        ]}
      />

      <Card>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <SectionTitle>상품 등록</SectionTitle>
          <Pill tone="success">Active {activeCount}/{products.length}</Pill>
        </div>
        <p className="admin-card-intro">브랜드 그린 톤과 CTA 일관성을 유지하며 즉시 판매 가능한 카탈로그를 확장합니다.</p>
        <AdminMarketComposer />
      </Card>

      <Card>
        <SectionTitle>카탈로그 스냅샷</SectionTitle>
        <div className="admin-market-list" style={{ marginTop: "0.7rem" }}>
          {products.map((product) => (
            <article key={product.id} className="admin-market-item">
              <img src={product.imageUrl} alt="" />
              <div>
                <p className="admin-market-zone">{MARKET_ZONES[product.zone]}</p>
                <strong>{product.name}</strong>
                <p>{product.description}</p>
                <small>
                  {product.pricePoints.toLocaleString("ko-KR")}pt · 재고 {product.stock === null ? "무제한" : product.stock.toLocaleString("ko-KR")} · {product.isActive ? "판매중" : "비활성"}
                </small>
              </div>
            </article>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>운영 바로가기</SectionTitle>
        <div className="admin-link-grid" style={{ marginTop: "0.72rem" }}>
          <Link className="admin-quick-link" href="/market">사용자 마켓 화면</Link>
          <Link className="admin-quick-link" href="/admin/topics">토픽 운영</Link>
          <Link className="admin-quick-link" href="/admin/moderation">모더레이션/정산</Link>
        </div>
      </Card>
    </PageContainer>
  );
}
