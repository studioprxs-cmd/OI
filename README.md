# OI (오늘의 이슈) MVP

초기 골격 + 문서 + Prisma 스키마 + 최소 동작 API/페이지가 포함된 MVP 저장소입니다.

## 구조
- `docs/` : PRD, 운영정책, API 계약
- `app/` : Next.js App Router
- `components/` : 재사용 UI 컴포넌트
- `lib/` : 공통 유틸/도메인 로직 (Prisma, session auth)
- `prisma/` : DB 스키마/시드

## 실행
1. 의존성 설치
   - `npm install`
2. 환경변수 설정 (`.env`)
   - `.env.example` 복사 후 값 수정
   - `DATABASE_URL=postgresql://...`
3. Prisma 클라이언트 생성 + 마이그레이션
   - `npm run prisma:generate`
   - `npm run prisma:migrate -- --name init`
4. 시드 데이터 입력
   - `npm run prisma:seed`
5. 개발 서버 실행
   - `npm run dev`

## 주요 엔드포인트
- `GET /api/health`
- `GET /api/topics`
- `POST /api/topics` (admin guard, `type: BETTING|POLL` 검증)
- `GET /api/topics/[id]`
- `PATCH /api/admin/topics/[id]/status` (admin topic quick action: LOCK/REOPEN/CANCEL + cancel refund)
- `POST /api/topics/[id]/votes`
- `POST /api/topics/[id]/bets`
- `GET /api/topics/[id]/comments`
- `POST /api/topics/[id]/comments`
- `POST /api/topics/[id]/resolve` (admin guard, Resolution upsert)

## Auth (MVP)
- 이메일/비밀번호 기반 회원가입/로그인/로그아웃
- 비밀번호는 `User.passwordHash`(scrypt)로 저장
- 세션은 HttpOnly 쿠키(`oi_session`) + `AUTH_SECRET` 서명 기반
- 인증 API
  - `POST /api/auth/signup`
  - `POST /api/auth/signin`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- UI 페이지
  - `/auth/signin`
  - `/auth/signup`

## 간단 UI
- `/topics` : 토픽 목록 (관리자 생성 링크 포함)
- `/topics/[id]` : 토픽 상세 (투표 비율 + 베팅 풀 통계 + 댓글)
- `/admin/topics/new` : 관리자 토픽 생성 폼 (BETTING/POLL 선택 + 검증)
- `/admin/topics/[id]/resolve` : 관리자 해결/정산 스텁 페이지

## Sprint 체크리스트 (MVP-0)
- [x] PRD v1 작성
- [x] 운영 정책 v1 작성
- [x] API 계약 v1 초안 작성
- [x] Next.js+TS 기본 폴더 골격 생성
- [x] Prisma 스키마 초안 작성
- [x] 기본 미니멀 UI 스타일/재사용 컴포넌트 적용
- [x] Admin Topic Create 페이지(`/admin/topics/new`) + BETTING/POLL 검증
- [x] Resolution workflow (resolve page + API)
- [x] Topic 상세 통계(YES/NO 비율 + 총 베팅 풀)
- [x] Topics 페이지/폼 로딩 및 에러 상태 추가
- [x] Auth(회원가입/로그인/로그아웃) 구현
- [x] Topic 목록/상세 API 구현
- [x] Vote/Bet API + 포인트 차감 최소 검증
- [ ] Comment/Report 모더레이션 플로우
- [ ] Resolution + 정산 배치 구현
- [x] Admin Topics 빠른 상태 변경(LOCK/REOPEN/CANCEL + CANCEL 환불) UX/API
