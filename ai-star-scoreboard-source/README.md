# AI Star 성과 스코어보드

6개년 정량성과, 논문 세부 등급, 공동사사 환산, 특허, 공개SW,
인재양성·배출을 공동 관리하는 웹앱입니다.

## 운영 구성

- **프런트엔드:** GitHub Pages (`github-pages/`)
- **로그인:** Supabase Auth 이메일 계정
- **공동 저장:** Supabase PostgreSQL
- **접근 승인:** 가입 요청 후 관리자 승인/거절
- **권한 보호:** PostgreSQL Row Level Security
- **변경 이력:** DB 트리거가 등록·수정·삭제 이력을 자동 기록
- **백업:** 기존 ChatGPT Sites 앱과 D1 데이터는 전환 검증이 끝날 때까지 유지

GitHub Pages는 정적 파일만 호스팅합니다. 로그인, 승인, 공동 데이터와
감사 이력은 브라우저가 Supabase에 직접 연결하고, 데이터베이스의 RLS가
승인되지 않은 접근을 차단합니다.

## 주요 소스

- `github-pages/src/main.tsx`: Supabase 세션 및 승인 상태 진입점
- `github-pages/src/auth-card.tsx`: 로그인·가입 화면
- `lib/supabase-client.ts`: 브라우저용 Supabase 클라이언트
- `lib/supabase-api.ts`: 기존 UI API 호출을 Supabase Data API로 연결
- `supabase/schema.sql`: 테이블, 제약조건, 인덱스, RPC, 트리거, RLS, 명시적 권한
- `app/`: 스코어보드 UI와 검증 중 유지하는 기존 Sites 백엔드

운영 데이터, 비밀번호, 서비스 역할 키는 Git에 저장하지 않습니다.
브라우저에는 RLS 사용을 전제로 한 Supabase publishable key만 포함됩니다.

## 로컬 빌드

Node.js 22 이상이 필요합니다.

```bash
npm ci
npm run build:github-pages
```

전체 Sites 백업 빌드까지 검증하려면 다음을 실행합니다.

```bash
npm run build
npm test
```

## Supabase Auth 설정

프로덕션 Site URL과 Redirect URL에 아래 주소를 정확히 등록합니다.

```text
https://ycyoon.github.io/ai-star-scoreboard/
```

이메일 확인은 활성화한 상태로 운영합니다. 기본 메일 전송 한도보다 많은
가입자가 필요하면 Supabase Auth에 별도 SMTP를 연결합니다.
