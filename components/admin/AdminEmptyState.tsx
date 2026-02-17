import { ReactNode } from "react";

type Props = {
  kicker: string;
  title: string;
  description: string;
  icon?: string;
  actions?: ReactNode;
  tips?: string[];
};

export function AdminEmptyState({ kicker, title, description, icon = "○", actions, tips = [] }: Props) {
  return (
    <section className="admin-empty-pattern" role="status" aria-live="polite">
      <span className="admin-empty-icon" aria-hidden>{icon}</span>
      <p className="admin-empty-kicker">{kicker}</p>
      <h3 className="admin-empty-title">{title}</h3>
      <p className="admin-empty-description">{description}</p>
      {tips.length > 0 ? (
        <ul className="admin-empty-tip-list">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ) : null}
      {actions ? <div className="admin-empty-actions">{actions}</div> : null}
    </section>
  );
}
