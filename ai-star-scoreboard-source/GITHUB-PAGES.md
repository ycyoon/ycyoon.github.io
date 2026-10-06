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

## 논문 공유와 인용 기록

`#papers`에서 제목, 학회·저널명, 저자, 참여 교수, 연도, 키워드, 초록,
BibTeX와 인용 기록을 관리합니다. 성과 집계와 독립된 공유 목록입니다.
기존 성과의 논문을 선택해 가져와도 실적은 중복 집계되지 않습니다.

기존 `supabase/schema.sql` 적용 후 `supabase/migrations/`의 SQL을 순서대로
적용합니다. 논문·인용은 승인 사용자에게만 공개되며 등록자와 관리자만
수정·삭제할 수 있습니다. 삭제는 목록에서 제외하는 방식이고 변경 이력은
`paper_activity`에 보존됩니다. 새 테이블의 Data API GRANT도 포함되어 있습니다.

자동 추출은 `supabase/functions/paper-metadata/` Edge Function을 사용합니다.
DOI(Crossref), arXiv, ACL Anthology, OpenReview 및 일부 출판사 메타데이터를
지원합니다. 제공처 제한이나 누락으로 추출하지 못한 정보는 직접 입력합니다.
키워드는 제공처가 제공한 키워드·분류이고, BibTeX는 제공처 또는 메타데이터로
생성되므로 저장 전 확인해야 합니다. 인용 기록은 사용자가 직접 기록하며
외부 인용 횟수를 자동 수집하는 기능이 아닙니다.

```bash
supabase functions deploy paper-metadata --project-ref agyvgwtsbsfqychbdekj
node --experimental-strip-types --test tests/paper-metadata.test.mjs
```

이 프로젝트의 ES256 토큰과 호환되도록 함수의 gateway `verify_jwt`는 false로
설정합니다. 함수 본문은 Supabase Auth `/user`로 토큰을 검증한 뒤 동일한
토큰으로 가입 승인 상태를 검사합니다. 인증 없는 메타데이터 조회는 허용하지
않습니다. 출판사 요청은 고정된 HTTPS 호스트만 허용하고 리디렉션을 차단합니다.
