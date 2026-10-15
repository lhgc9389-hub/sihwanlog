# 시환로그
검색은 제가 합니다! — 아기랑 가볼 만한 곳, 할인 혜택과 편의시설을 대신 찾아 정리하는 육아 나들이 검색 서비스.

처음이라면 `TUTORIAL.md`부터 읽어 보세요.

## 내 노트북에서 홈페이지 열기
1. 터미널(PowerShell)에서 이 폴더로 이동합니다.
2. 처음 한 번만: `npm install`
3. 실행: `npm run dev`
4. 브라우저 주소창에 **http://localhost:3000** 입력
5. 끝낼 때는 터미널에서 `Ctrl + C`

> 3000번이 이미 쓰이고 있으면 터미널에 3001 같은 다른 주소가 나옵니다. 터미널에 표시된 `Local:` 주소로 접속하세요.

## 그 밖의 명령어
| 명령어 | 하는 일 |
|---|---|
| `npm test` | 자동 테스트 실행 (핵심 로직 15개 + 검색·필터 8개 + 데이터 연결 11개) |
| `npm run build` | 배포용으로 빌드해 오류가 없는지 확인 |
| `npm run typecheck` | 타입 검사 |

## 폴더 안내
- `src/app` — 웹 화면 (홈 `/`, 장소 상세 `/places/[id]`)
- `src/components` — 장소 카드, 검색·필터, 배지
- `src/lib` — 장소 데이터 형식, 검색·필터 로직
- `src/data/sample-places.ts` — **예시 데이터** (가상의 장소, 실제 정보 아님)
- `src/core` — 공식 홈페이지 확인·변경 감지·승인 규칙 (기존, 아직 웹 화면과 연결 안 됨)
- `supabase/migrations` — DB 설계 (아직 실제 Supabase에서 실행 전)
- `backup-before-web` — 웹사이트 작업 전 `package.json`/`tsconfig.json`/`package-lock.json` 백업

## 실제 장소 데이터(Supabase) 연결
설정이 없으면 예시 데이터가, 설정이 있으면 Supabase의 **공개된 장소(is_published)**가 화면에 나옵니다.
1. Supabase SQL Editor에서 `supabase/migrations/0001_init.sql` → `0002_place_sources.sql` 순서로 실행
2. (선택) `supabase/seed_connection_test.sql` 실행 → 연결 확인용 테스트 장소 1곳 생성
3. `.env.example`을 복사해 `.env.local`로 이름을 바꾸고 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 입력
4. `npm run dev`를 껐다가 다시 실행 → 홈에 '연결 확인용 테스트 장소'가 보이면 연결 성공

- 키는 서버에서만 읽습니다(이름에 `NEXT_PUBLIC_`을 붙이지 마세요). `service_role` 키는 넣지 마세요.
- 편의시설·무료입장·할인은 상태가 공식 홈페이지 확인 / 공식 문의 확인 / 운영자 방문 확인 **이고** 확인일이 있을 때만 '있음'으로 보여주고 필터에 포함합니다. 확인일이 180일보다 오래되면 '재확인 필요'로 표시합니다.
- 항목 이름과 값 형식은 `supabase/migrations/0002_place_sources.sql` 주석을 참고하세요.

## 현재 상태
- ✅ 홈페이지(슬로건·지역 선택·키워드 검색·필터 6종), 장소 카드, 장소 상세 페이지
- ✅ 확인되지 않은 편의시설은 필터 결과에서 제외, '확인 필요'로 표시
- ✅ Supabase 조회 코드 (서버 전용, 항목별 출처·확인일·확인 상태 표시) — 코드와 테스트는 완료, **실제 Supabase 연결은 아직 확인 전**
- ⚠ 실제 장소 데이터는 아직 없음 (지금 화면은 예시 데이터)
- ❌ 관리자 화면, 로그인, 주간 자동 확인, 공공데이터 API 연동, 배포는 아직 없음
