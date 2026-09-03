# GitHub Pages 배포

실행 주소: https://ycyoon.github.io/ai-star-scoreboard/

`github-pages/`는 React/Vite 기반 정적 프런트엔드입니다. GitHub Pages는
서버 코드를 실행하지 않으므로 로그인, 가입 승인, 공동 데이터 저장,
감사 이력은 Supabase Auth와 PostgreSQL이 담당합니다.

전체 백엔드 구조와 RLS 정책은 `supabase/schema.sql`에 포함되어 있습니다.
운영 데이터와 비밀키는 공개 저장소에 포함되지 않습니다.

```bash
npm ci
npm run build:github-pages
```

빌드 결과는 `dist-github/`에 생성됩니다. 이 결과물을 저장소의
`ai-star-scoreboard/` 경로에 게시합니다. 전체 소스는
`ai-star-scoreboard-source/` 경로에 함께 게시합니다.

Supabase Auth에는 아래 주소를 Site URL 및 허용 Redirect URL로 등록합니다.

```text
https://ycyoon.github.io/ai-star-scoreboard/
```
