# OI API Contract v1 (Draft)

Base URL: `/api/v1`

## 공통
- Auth: MVP는 `Bearer <token>` 가정
- 응답 포맷
```json
{ "ok": true, "data": {}, "error": null }
```

## 1) Auth
### POST `/auth/sign-in`
- req: `{ "email": "user@example.com" }`
- res: `{ "token": "jwt...", "user": { "id": "...", "nickname": "..." } }`

## 2) Topic
### GET `/topics`
- query: `status`, `cursor`, `limit`
- res: Topic 목록 + pagination

### POST `/topics`
- 권한: admin
- req: `{ "title": "...", "description": "...", "closeAt": "ISO", "options": ["YES","NO"] }`

### GET `/topics/:id`
- res: topic detail + sources + stats

## 3) TopicSource
### POST `/topics/:id/sources`
- 권한: admin
- req: `{ "url":"https://...", "title":"...", "publisher":"...", "publishedAt":"ISO" }`

## 4) Vote
### POST `/topics/:id/votes`
- req: `{ "choice":"YES" }`
- 제약: 사용자당 1표

## 5) Bet
### POST `/topics/:id/bets`
- req: `{ "choice":"YES", "amount":100 }`
- 제약: 잔액 >= amount

## 6) Comment
### GET `/topics/:id/comments`
### POST `/topics/:id/comments`
- req: `{ "content":"..." }`

## 7) Resolution
### POST `/topics/:id/resolution`
- 권한: admin
- req: `{ "result":"YES", "summary":"...", "evidenceUrls":["..."] }`

## 8) Report
### POST `/reports`
- req: `{ "targetType":"COMMENT", "targetId":"...", "reason":"ABUSE", "detail":"..." }`

## 에러 코드(초안)
- `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `INSUFFICIENT_BALANCE`, `CONFLICT_VOTE_EXISTS`
