"use client";

import Link from "next/link";

import { Card, PageContainer } from "@/components/ui";

type Props = {
  title: string;
  description: string;
  homeHref: string;
  reset: () => void;
};

export function AdminErrorState({ title, description, homeHref, reset }: Props) {
  return (
    <PageContainer>
      <Card className="admin-error-state" role="alert" aria-live="assertive">
        <span className="admin-error-icon" aria-hidden>⚠</span>
        <p className="admin-empty-kicker">Admin state error</p>
        <h1 className="admin-error-title">{title}</h1>
        <p className="admin-error-description">{description}</p>
        <p className="admin-error-help">일시적인 네트워크/동기화 지연일 수 있습니다. 안전 경로로 이동해 최신 상태를 다시 불러오세요.</p>
        <div className="admin-error-actions">
          <button type="button" className="btn btn-primary" onClick={reset}>다시 시도</button>
          <Link href={homeHref} className="btn btn-secondary">안전 경로로 이동</Link>
        </div>
      </Card>
    </PageContainer>
  );
}
