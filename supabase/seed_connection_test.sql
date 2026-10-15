-- 시환로그: 연결 확인용 테스트 장소 1곳 (0001, 0002 실행 후 선택 실행)
-- 실제 장소가 아닙니다. is_test_data = true 라서 화면에 '예시 데이터'로 표시됩니다.
-- 요금·편의시설 정보는 넣지 않습니다 (모두 '확인 필요'로 보여야 정상).
-- 확인이 끝나면 맨 아래 delete 문으로 지우세요.

insert into public.regions (sido, sigungu) values ('테스트시', '연결확인구')
on conflict (sido, sigungu) do nothing;

insert into public.places (slug, name, region_id, description, is_published, is_test_data)
select 'connection-test', '연결 확인용 테스트 장소', id, 'Supabase 연결이 되면 이 장소가 보여요.', true, true
from public.regions where sido = '테스트시' and sigungu = '연결확인구'
on conflict (slug) do nothing;

-- 확인 후 삭제:
-- delete from public.places where slug = 'connection-test';
-- delete from public.regions where sido = '테스트시' and sigungu = '연결확인구';
