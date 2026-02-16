# OI x Wise 스타일 미니 가이드 v1.1

오이 프로젝트 UI를 **Wise 스타일의 신뢰감 + OI의 친근함**으로 정렬하기 위한 실전 가이드.

---

## 1) 디자인 원칙 5가지
1. **Green is a signal, not a surface**  
   그린은 강조/상태/행동에만 사용
2. **Content-first layout**  
   장식보다 정보 위계(질문·마감·근거·결과) 우선
3. **Neutral-led UI**  
   배경/카드/텍스트는 뉴트럴 중심
4. **Soft trust tone**  
   둥근 형태는 유지하되 과한 캐릭터화 금지
5. **Explainability by design**  
   판정·증거·이의제기는 시각적으로도 투명하게

---

## 2) 컬러 토큰 (Wise 느낌 적용)

### Foundation
- `--bg`: `#F8FAFC`
- `--surface`: `#FFFFFF`
- `--border`: `#E2E8F0`
- `--text-primary`: `#1F2937`
- `--text-secondary`: `#475569`

### Brand & Action
- `--brand-primary`: `#1F6D4E`
- `--brand-primary-hover`: `#18563D`
- `--brand-soft`: `#DCFCE7`
- `--accent-mint`: `#7DDFA9`
- `--accent-lime`: `#B7F26D`

### Semantic
- `--success`: `#22C55E`
- `--warning`: `#F59E0B`
- `--danger`: `#EF4444`
- `--info`: `#0EA5E9`

### 사용 비율
- 뉴트럴 70%
- 브랜드 딥그린 20%
- 포인트(민트/라임/상태색) 10%

---

## 3) 컴포넌트 규칙

### 버튼
- Primary: `#1F6D4E` / 텍스트 White / radius 12 / semibold
- Secondary: White + 1px `#1F6D4E` 보더 / 텍스트 `#1F6D4E`
- Tertiary: 텍스트 버튼 + hover 시 `#F1F5F9` 배경

### 카드
- 배경 White
- 보더 `#E2E8F0` 1px
- 섀도우 최소 (0 2 8 / 6~8%)
- 패딩 16~20px, 섹션 간격 12~16px

### 배지
- BETTING: bg `#DCFCE7`, text `#166534`
- POLL: bg `#FEF9C3`, text `#854D0E`
- RESOLVED: bg `#E2E8F0`, text `#334155`

### 상태칩
- OPEN, CLOSING, CLOSED, RESOLVED, APPEAL로 상태 단순화
- 색상보다 텍스트 라벨 우선

---

## 4) 핵심 화면 스타일

### 홈 (Today Issues)
- 히어로 1개 + 토픽 카드 리스트
- 카드마다: 타입(BETTING/POLL), 마감 시간, 참여자 수, 신뢰 지표(검증 여부)
- CTA는 1개만 강하게(“참여하기”)

### 토픽 상세
고정 순서:
1) 질문
2) 마감 카운트다운
3) 규칙/판정 기준
4) 현재 참여 요약(비율/포인트)
5) 증거 로그
6) 이의제기 상태

### 운영센터
- 장식 제거, 표/로그 중심
- 타임라인형 감사 로그(누가/언제/무엇을 변경)
- 판정 근거 첨부가 없으면 확정 버튼 비활성

---

## 5) 타이포 & 아이콘
- 폰트: Pretendard(한글), Inter(숫자)
- 제목은 짧고 강하게, 본문은 2줄 내 요약 우선
- 아이콘은 1.5px~2px stroke, 라운드 캡
- 3D 마스코트는 브랜딩 영역(로고/온보딩)에만 제한

---

## 6) 문구 톤 (신뢰형)
- "확정" 대신: "결과 확정됨"
- "승리/패배"보다: "예측 적중/미적중"
- "운영자 판단"보다: "출처 기반 판정"
- 이의제기 안내는 항상 시간 제한(예: 24시간) 명시

---

## 7) 즉시 적용 체크리스트
- [ ] Primary 버튼 외에는 그린 면적 최소화
- [ ] 카드 1개당 핵심정보 4개 이하
- [ ] 토픽 상세 정보 순서 고정
- [ ] 증거 로그 링크/시간/출처 노출
- [ ] BETTING/POLL 배지 색과 라벨 모두 명확
- [ ] 접근성 대비(본문 4.5:1 이상)

---

## 8) 다음 액션
1. 홈/토픽상세 와이어프레임 1차에 이 가이드 적용
2. 컬러 토큰을 CSS/피그마 변수로 동기화
3. 모바일 우선으로 카드 간격/가독성 검증
4. 내부 테스트 후 대비·가독성 수치 보정

작성일: 2026-02-16
문서: OI x Wise Mini Visual Guide v1.1
