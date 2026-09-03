# AI Star 성과 스코어보드 소스

실행 사이트: https://ycyoon.github.io/ai-star-scoreboard/

이 폴더에는 GitHub Pages 프런트엔드와 기존 공동 데이터베이스·로그인·가입 승인·수정 이력 API를 포함한 전체 애플리케이션 소스가 들어 있습니다.

## 구조

- `github-pages/`: GitHub Pages용 React/Vite 프런트엔드
- `app/`: 화면과 API 경로
- `lib/`: 집계, 인증, 권한, 외부 세션 연결
- `db/`, `drizzle/`: 데이터 구조와 마이그레이션
- `build/`, `scripts/`: 빌드 및 검증 설정

GitHub Pages는 정적 호스팅이므로 데이터베이스와 인증 API는 기존 Sites 서버에서 실행됩니다. 운영 비밀값과 실제 성과 데이터는 이 공개 저장소에 포함하지 않습니다.

## 빌드

```bash
npm ci
npm run build:github-pages
npm run build
npm test
```

GitHub Pages 결과물은 `dist-github/`에 생성됩니다.
