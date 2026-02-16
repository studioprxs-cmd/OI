import { ReactNode } from "react";

type WidgetCardProps = {
  title: string;
  children: ReactNode;
};

export function WidgetCard({ title, children }: WidgetCardProps) {
  return (
    <section className="widget-card">
      <h3 className="widget-title">{title}</h3>
      <div className="widget-body">{children}</div>
    </section>
  );
}
