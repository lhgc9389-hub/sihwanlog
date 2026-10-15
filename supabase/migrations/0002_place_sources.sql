-- 시환로그: 장소별 대표 출처 URL·확인 상태 추가 (0001_init.sql 실행 후 실행)
-- 기존 데이터는 지우거나 바꾸지 않는다. 여러 번 실행해도 안전하다.
-- ⚠ 아직 실제 Supabase에서 실행·검증되지 않았습니다.

alter table public.places add column if not exists source_url text;  -- 장소 정보를 확인한 대표 출처 (공식 홈페이지, 공공데이터 등)
alter table public.places add column if not exists verify_status public.verify_status not null default 'needs_check';

-- place_facts.field 에 쓰는 이름 (웹 화면이 읽는 항목)
--   요금:      adult_fee, child_fee (숫자만, 예: 5000), infant_free (문장, 예: 만 36개월 이하 무료)
--   운영:      opening_hours, closed_days
--   편의시설:  free_entry, discount, nursing_room, diaper_station, stroller, parking
--              값 형식: '있음', '없음', '있음(1층)', '있음: 다둥이 카드 30%'
--   방문 팁:   visit_tips (한 줄에 하나)
-- 화면 규칙: status 가 official_site / official_inquiry / visited 이고 verified_at 이 있어야 '확인된 정보'.
--            그 외에는 '확인 필요' 등으로 표시하고 편의시설 필터에서 제외한다.
--            verified_at 이 180일보다 오래되면 '오래되어 재확인 필요'로 표시한다.
