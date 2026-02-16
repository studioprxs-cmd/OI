# OI UI Style Update (v1.1)

기준: `DESIGN_GUIDE_v1.md`
목표: 클레이 감성 커뮤니티 대시보드 구조로 레이아웃 전환

## 1) 레이아웃 시스템

### 글로벌 프레임
- **TopNav**: 상단 고정 글로벌 네비게이션
  - 좌측: 브랜드 락업(oi + 오늘의 이슈)
  - 중앙: 1차 이동(Home/Topics/Admin)
  - 우측: 검색 + 프로필 칩
- **SideRail**: 좌측 아이콘 레일
  - 대시보드/토픽/관리 빠른 이동
- 콘텐츠 영역은 `content-grid`
  - 메인 컬럼(히어로 + 피드)
  - 우측 위젯 컬럼(Trending/New Members 등)

### 반응형
- `<=1080px`: 우측 위젯을 하단으로 드롭(1열)
- `<=900px`: SideRail을 상단 가로형 바로 전환
- `<=640px`: KPI 3열 → 1열 스택

---

## 2) 토큰 (CSS 변수)

- `--primary: #1F6D4E`
- `--mint: #7DDFA9`
- `--lime: #B7F26D`
- `--bg: #F5F7F5`
- `--panel: #FFFFFF`
- `--text: #1F2937`
- `--muted: #64748B`
- `--line: #DBE4DC`
- `--line-strong: #BFD0C2`
- `--radius-lg: 20px`
- `--radius-md: 14px`
- `--shadow-soft: 0 8px 24px rgba(21, 45, 32, 0.08)`

---

## 3) 신규 컴포넌트 규칙

## `TopNav`
- sticky top, 가벼운 blur 배경
- nav active 상태는 mint/green 기반 pill

## `SideRail`
- icon-only 버튼, active는 mint 배경
- 데스크톱 sticky, 모바일 가로형 변환

## `WidgetCard`
- 우측 보조정보 컨테이너
- `title + body` 단순 구조

## `FeedCard`
- 피드 공통 카드(홈/토픽목록/토픽상세 공용)
- 슬롯
  - `title`
  - `description`
  - `meta`
  - `badge`
  - `content`
  - `footer`

---

## 4) 페이지 적용 원칙

### `/`
- Hero branding block + KPI
- 인기/최신 피드 섹션
- 우측 Trending/New Members 위젯

### `/topics`
- 동일 Hero 톤(compact)
- FeedCard 목록으로 전환
- 우측 가이드 위젯

### `/topics/[id]`
- 상세 헤더/통계/액션/댓글 모두 FeedCard로 정렬
- 우측 요약/가이드 위젯 유지

---

## 5) 기능 보존 원칙

- 데이터 fetch/정렬/집계 로직은 기존과 동일
- 라우팅 구조(`/topics`, `/topics/[id]`, `/admin/...`) 유지
- UI 구조/시각 스타일만 개편

---

## 6) 스크린샷 가이드 (PR/커밋 첨부용)

로컬 실행 후 아래 뷰포트로 캡처:

1. 홈(`/`) 데스크톱 1440px
2. 토픽 목록(`/topics`) 데스크톱 1440px
3. 토픽 상세(`/topics/[id]`) 데스크톱 1440px
4. 홈 모바일 390px

예시 명명 규칙:
- `docs/screenshots/2026-02-16-home-desktop.png`
- `docs/screenshots/2026-02-16-topics-desktop.png`
- `docs/screenshots/2026-02-16-topic-detail-desktop.png`
- `docs/screenshots/2026-02-16-home-mobile.png`
