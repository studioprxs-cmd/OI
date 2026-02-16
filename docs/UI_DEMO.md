# OI UI Demo Guide

## 데모 페이지 목록
1. `/` - Home Dashboard
   - KPI 카드 (Open Topics / Total Votes / Total Bets)
   - Trending Topics
   - Latest Topics
2. `/topics` - Topic 목록
   - 전체 토픽 리스트 (DB + mock fallback)
3. `/topics/[id]` - Topic 상세
   - 헤더 + 상태
   - 통계 카드 (YES/NO/Pool)
   - Action Panel
   - 댓글 작성/댓글 섹션
4. `/admin/topics` - Admin Topic 관리 목록
   - 빠른 작업 링크 (Create/Resolve/Detail)
5. `/admin/topics/new` - Admin 토픽 생성
6. `/admin/topics/[id]/resolve` - Admin Resolve 처리

## Mock fallback 동작
- DB 조회 실패 또는 데이터가 부족할 때 `lib/mock-data.ts`의 샘플 토픽이 자동 노출됩니다.
- 데모 시 최소한의 화면 구성이 항상 유지됩니다.

## 로컬 실행
```bash
cd oi
npm install
npm run dev
```
- 브라우저에서 `http://localhost:3000` 접속

## 스크린샷 촬영 가이드(수동)
1. Home: `http://localhost:3000/`
2. Topics: `http://localhost:3000/topics`
3. Topic Detail 예시:
   - DB 데이터가 있으면 해당 id 사용
   - 없으면 mock id 사용: `mock-ai-device-2026`
   - 예: `http://localhost:3000/topics/mock-ai-device-2026`
4. Admin List: `http://localhost:3000/admin/topics`

권장 캡처: 1366x768 이상, 라이트 모드 기본 상태
