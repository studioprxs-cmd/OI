import { Card, PageContainer } from "@/components/ui";

type Props = {
  title: string;
  subtitle: string;
};

export function AdminPageSkeleton({ title, subtitle }: Props) {
  return (
    <PageContainer>
      <section className="admin-hero-shell admin-skeleton-shell" aria-hidden>
        <div className="admin-skeleton-eyebrow" />
        <div className="admin-skeleton-title" />
        <div className="admin-skeleton-subtitle" />
        <div className="admin-pulse-grid" style={{ marginTop: "0.78rem" }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`pulse-${index}`} className="admin-pulse-card admin-skeleton-block" />
          ))}
        </div>
      </section>

      <Card className="admin-skeleton-shell">
        <div className="admin-skeleton-chip-row">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={`chip-${index}`} className="admin-skeleton-chip" />
          ))}
        </div>
      </Card>

      <Card className="admin-skeleton-shell">
        <h2 className="admin-skeleton-heading">{title}</h2>
        <p className="admin-muted-note" style={{ marginTop: "0.4rem" }}>{subtitle}</p>
        <div className="admin-skeleton-grid" style={{ marginTop: "0.74rem" }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <article key={`card-${index}`} className="admin-skeleton-card">
              <span className="admin-skeleton-line short" />
              <span className="admin-skeleton-line" />
              <span className="admin-skeleton-line tiny" />
            </article>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
