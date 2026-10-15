# 시환로그 만들기 — 초보자 튜토리얼
슬로건: **검색은 제가 합니다!**

## 먼저 알아둘 것 (정직한 현황)
| 구분 | 상태 |
|---|---|
| 변경 감지·승인 규칙, 공식 홈페이지 가져오기·추출, 주간 실행기 (`src/core`) | ✅ 테스트 15개 통과 (Claude 작업 환경에서 실행 확인) |
| DB 스키마·보안 규칙 (`supabase/migrations/0001_init.sql`) | ⚠ 작성만 됨. 실제 Supabase에서 실행 전 |
| 방문자 사이트, 관리자 화면, 로그인 | ❌ 아직 없음 (Claude Code가 만들 단계) |
| 매주 월요일 06:00 자동 실행 | ❌ 아직 연결 안 됨 |
| Vercel 배포 | ❌ 아직 안 함 |

Claude 대화창은 인터넷이 막혀 있어 Next.js·Supabase를 설치할 수 없었습니다. 그래서 인터넷이 되는 **내 노트북에서 Claude Code로** 나머지를 만듭니다.

## 1단계. 프로그램 설치 (최초 1회, 약 20분)
1. **Node.js**: nodejs.org → 왼쪽 **LTS** 버튼으로 다운로드 → 설치(계속 '다음').
2. **Git**: git-scm.com → Download → 설치(기본값).
3. **VS Code**(선택, 파일 보기용): code.visualstudio.com.
4. 확인: 터미널을 열고 아래 입력 (Windows는 시작 메뉴에서 "PowerShell", Mac은 Spotlight에서 "터미널")
   ```
   node -v
   git --version
   ```
   버전 숫자가 나오면 성공.

## 2단계. 프로젝트 폴더 준비
1. 내려받은 `sihwanlog` 폴더를 바탕화면 등 원하는 곳에 둡니다.
2. 터미널에서 그 폴더로 이동: `cd 폴더경로` (폴더를 터미널 창에 끌어다 놓으면 경로가 입력됩니다. 앞에 `cd ` 붙이기).
3. 코어 테스트 확인:
   ```
   npm install
   npm test
   ```
   `# pass 15`가 보이면 정상입니다.

## 3단계. 계정 만들기 (무료로 시작)
- **GitHub** (github.com): 코드 보관. 회원가입 → 로그인.
- **Supabase** (supabase.com): **Start your project** → GitHub로 로그인 → **New project** → 이름 `sihwanlog`, 데이터베이스 비밀번호 설정(따로 메모), Region은 **Northeast Asia (Seoul)** → **Create new project**.
- **Vercel** (vercel.com): **Sign Up** → **Continue with GitHub**.

💰 비용: 셋 다 무료 플랜으로 시작 가능. 무료 플랜 한계 예: Supabase 무료 프로젝트는 일정 기간 활동이 없으면 일시정지될 수 있고 백업 기능이 제한적, Vercel 무료(Hobby)는 상업적 이용 제한 조항이 있으니 광고·수익 연결 전에 요금 정책을 꼭 확인하세요. (정확한 현재 조건은 각 사이트 Pricing 페이지에서 확인)

## 4단계. Claude Code로 사이트 만들기
1. Claude Code 설치 안내: Claude 앱/사이트의 Claude Code 문서(docs.claude.com)를 따라 설치·로그인.
2. 터미널에서 프로젝트 폴더로 이동한 뒤 `claude` 입력.
3. `docs/CLAUDE_CODE_PROMPT.md`의 **프롬프트 시작~끝** 사이를 복사해 붙여넣고 Enter.
4. 중간에 Claude Code가 허락을 물으면 내용을 읽고 승인합니다. 모르겠는 건 "이게 뭐예요?"라고 물어보세요.
5. 단계가 끝날 때마다 "실행해 확인한 것 / 아직 못 한 것"을 보고하게 되어 있습니다. 못 한 것이 남아 있으면 "이어서 진행해"라고 하세요.

## 5단계. Supabase에 데이터베이스 만들기
1. Supabase 프로젝트 화면 왼쪽 **SQL Editor** → **New query**.
2. `supabase/migrations/0001_init.sql` 내용을 전부 붙여넣고 **Run**.
3. 오류가 나면 오류 문구를 그대로 Claude Code에 붙여넣으세요 (이 SQL은 아직 검증 전입니다).
4. 연결 정보: **Project Settings → API**에서 Project URL, anon key를 확인. Claude Code가 `.env.local` 파일 작성을 안내합니다. ⚠ `service_role` 키는 절대 공개하거나 GitHub에 올리지 마세요.

## 6단계. 관리자 계정 만들기
1. Supabase 왼쪽 **Authentication → Users → Add user → Create new user**: 내 이메일과 비밀번호 입력, **Auto Confirm User** 체크.
2. 생성된 사용자의 **User UID**를 복사.
3. **SQL Editor**에서 실행: `insert into public.admins (user_id) values ('복사한-UID');`
4. 이 계정으로만 관리자 페이지에 들어갈 수 있습니다. 비밀번호를 잊었다면 Users 목록에서 해당 사용자의 메뉴(⋯)로 비밀번호 재설정.

## 7단계. 내 컴퓨터에서 실행해 보기
Claude Code가 만든 사이트는 보통 `npm run dev` 실행 후 브라우저에서 `http://localhost:3000` 으로 확인합니다. 정확한 명령은 Claude Code가 안내합니다.

## 8단계. GitHub에 올리고 Vercel로 공개
1. GitHub에서 **New repository** (Private 권장) 생성 → Claude Code에 "GitHub에 올려줘"라고 요청.
2. Vercel → **Add New… → Project** → 방금 만든 저장소 **Import**.
3. **Environment Variables**에 `.env.local`과 같은 값을 입력 → **Deploy**.
4. 완료되면 `xxxx.vercel.app` 주소가 생깁니다.

## 9단계. 자동 확인(매주 월요일 06:00) 검증
- 연결 방법은 Claude Code가 구현합니다 (Supabase Cron 또는 Vercel Cron 중 선택).
- 진짜 작동하는지 확인: 관리자 화면의 **수동 실행** 버튼 → 실행 기록에 결과가 남는지 확인 → 다음 월요일 이후 실행 로그에 자동 실행 기록이 생겼는지 확인.
- 그 전까지는 "자동 실행 확인 전"으로 생각하세요.

## 10단계. 장소 추가하는 법 (운영)
1. 관리자 로그인 → **장소 추가** → 이름·주소·공식 홈페이지 URL 입력.
2. 요금·운영시간 등은 공식 홈페이지에서 확인한 값만 입력하고 출처 URL과 확인일을 기록. 모르면 비워두거나 **확인 필요**로 둡니다.
3. 다음 주간 확인에서 달라진 점이 **승인 대기**에 뜨면 현재값/새 값/출처를 비교해 **승인 · 거절(사유 필수) · 수정 후 승인 · 보류**.
4. 가격·무료입장은 항상 직접 승인해야 반영됩니다.

## 자주 겪는 오류
- `command not found: node` → 설치 후 터미널을 완전히 껐다 다시 열기.
- `npm install` 실패 → 인터넷 연결 확인 후 재시도, 계속되면 오류 전체를 Claude Code에 붙여넣기.
- 관리자 페이지가 로그인 후에도 막힘 → 6단계 3번(admins 등록) 확인.
- 자동 확인에서 "접속 실패(blocked_by_site)" → 사이트가 자동 접근을 막은 것. 우회하지 않고 직접 확인하여 수정합니다.
- 자동 확인에서 "추출 실패" → 자바스크립트로 그려지는 페이지·PDF 공지일 수 있음. 수동 확인 대상.

## 백업·복구
- 코드: GitHub에 push하면 백업.
- 데이터: Supabase **Database → Backups** 확인(플랜별 제공 범위 다름). 무료 플랜이라면 주기적으로 **Table Editor**에서 CSV 내보내기를 권장.

## 점검 체크리스트
□ `npm test` 통과 □ SQL 실행 성공 □ 관리자 로그인 □ 비로그인으로 관리자 주소 접근 시 차단 □ 후보 승인 전 공개 값 유지 □ 거절 시 기존 값 유지 □ 수동 실행 기록 □ 모바일 화면 확인 □ 테스트 데이터 표시 확인
