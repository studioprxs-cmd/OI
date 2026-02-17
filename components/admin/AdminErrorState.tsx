"use client";

import Link from "next/link";

import { Card, PageContainer } from "@/components/ui";

type Props = {
  title: string;
  description: string;
  homeHref: string;
  reset: () => void;
  quickChecks?: string[];
};

const defaultQuickChecks = [
  "필터를 초기화하고 OPEN 큐부터 다시 불러오기",
  "네트워크 연결 및 관리자 세션 만료 여부 확인",
  "정산 화면(/admin/topics)에서 데이터 정상 응답 확인",
];

export function AdminErrorState({ title, description, homeHref, reset, quickChecks = defaultQuickChecks }: Props) {
  return (
    <PageContainer>
      <Card className="admin-error-state" role="alert" aria-live="assertive">
        <span className="admin-error-icon" aria-hidden>⚠</span>
        <p className="admin-empty-kicker">Admin state error</p>
        <h1 className="admin-error-title">{title}</h1>
        <p className="admin-error-description">{description}</p>
        <p className="admin-error-help">일시적인 네트워크/동기화 지연일 수 있습니다. 안전 경로로 이동해 최신 상태를 다시 불러오세요.</p>
        <ul className="admin-error-checklist" aria-label="복구 체크리스트">
          {quickChecks.map((check) => (
            <li key={check}>{check}</li>
          ))}
        </ul>
        <div className="admin-error-actions">
          <button type="button" className="btn btn-primary" onClick={reset}>다시 시도</button>
          <Link href={homeHref} className="btn btn-secondary">안전 경로로 이동</Link>
        </div>
      </Card>
    </PageContainer>
  );
}
