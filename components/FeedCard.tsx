import { ReactNode } from "react";

type FeedCardProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
};

export function FeedCard({ title, description, meta, badge, footer, children }: FeedCardProps) {
  return (
    <article className="feed-card">
      <div className="feed-card-head">
        <div>
          <h3 className="feed-card-title">{title}</h3>
          {description ? <p className="feed-card-description">{description}</p> : null}
        </div>
        {badge ? <div>{badge}</div> : null}
      </div>

      {meta ? <p className="feed-card-meta">{meta}</p> : null}
      {children ? <div className="feed-card-content">{children}</div> : null}
      {footer ? <div className="feed-card-footer">{footer}</div> : null}
    </article>
  );
}
