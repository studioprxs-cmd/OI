import { ReactNode } from "react";

type Props = {
  kicker: string;
  title: string;
  description: string;
  icon?: string;
  actions?: ReactNode;
};

export function AdminEmptyState({ kicker, title, description, icon = "○", actions }: Props) {
  return (
    <section className="admin-empty-pattern" role="status" aria-live="polite">
      <span className="admin-empty-icon" aria-hidden>{icon}</span>
      <p className="admin-empty-kicker">{kicker}</p>
      <strong>{title}</strong>
      <p>{description}</p>
      {actions ? <div className="admin-empty-actions">{actions}</div> : null}
    </section>
  );
}
