-- 시환로그: 관리자 지역 등록 권한 + 변경 후보 승인 처리 함수 (0001, 0002 실행 후 실행)
-- 기존 테이블·데이터는 삭제하거나 초기화하지 않는다. 여러 번 실행해도 안전하다.

-- 1) 0001에는 regions 읽기 정책만 있어 관리자도 지역을 추가할 수 없었다 → 관리자 쓰기 허용
drop policy if exists regions_admin_write on public.regions;
create policy regions_admin_write on public.regions for all
  using (public.is_admin()) with check (public.is_admin());

-- 2) 변경 후보 처리. src/core/workflow.ts ReviewStore 규칙과 동일:
--    - 처리 가능한 상태: pending, on_hold
--    - approve: 확신 낮음(low)이면 불가 → approve_with_edit만 가능
--    - reject: 사유 필수, 공개 값 유지
--    - 후보 생성 이후 공개 값이 바뀌었으면 충돌(conflict)로 거부 (덮어쓰지 않음)
--    - 모든 처리는 change_history에 기록
--    승인된 값은 공식 홈페이지에서 가져온 후보이므로 status=official_site, 출처·확인 시각을 함께 저장한다.
create or replace function public.decide_candidate(
  p_id uuid, p_action text, p_value text default null, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.change_candidates;
  cur text;
  v text;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;

  select * into c from public.change_candidates where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if c.status not in ('pending', 'on_hold') then raise exception 'not_pending'; end if;

  if p_action = 'reject' then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required'; end if;
    update public.change_candidates set status = 'rejected', decided_by = auth.uid(), decided_at = now(), reason = p_reason where id = p_id;
    insert into public.change_history (candidate_id, place_id, field, action, before_value, after_value, reason, admin_id)
      values (c.id, c.place_id, c.field, 'rejected', c.old_value, c.old_value, p_reason, auth.uid());

  elsif p_action = 'hold' then
    update public.change_candidates set status = 'on_hold', decided_by = auth.uid(), decided_at = now(), reason = p_reason where id = p_id;
    insert into public.change_history (candidate_id, place_id, field, action, before_value, after_value, reason, admin_id)
      values (c.id, c.place_id, c.field, 'on_hold', c.old_value, c.old_value, p_reason, auth.uid());

  elsif p_action in ('approve', 'approve_with_edit') then
    if p_action = 'approve' then
      if c.confidence = 'low' then raise exception 'edit_required'; end if;
      v := c.new_value;
    else
      v := btrim(coalesce(p_value, ''));
      if v = '' then raise exception 'value_required'; end if;
    end if;

    select value into cur from public.place_facts where place_id = c.place_id and field = c.field for update;
    if cur is distinct from c.old_value then raise exception 'conflict'; end if;

    insert into public.place_facts (place_id, field, value, status, source_url, verified_at)
      values (c.place_id, c.field, v, 'official_site', c.source_url, c.checked_at)
      on conflict (place_id, field) do update
        set value = excluded.value, status = excluded.status, source_url = excluded.source_url, verified_at = excluded.verified_at;

    update public.change_candidates set status = 'approved', decided_by = auth.uid(), decided_at = now(),
      reason = case when p_action = 'approve_with_edit' then coalesce(p_reason, '수정 후 승인') else p_reason end
      where id = p_id;
    insert into public.change_history (candidate_id, place_id, field, action, before_value, after_value, reason, admin_id)
      values (c.id, c.place_id, c.field, case when p_action = 'approve' then 'approved' else 'approved_with_edit' end,
              c.old_value, v, p_reason, auth.uid());
    update public.places set updated_at = now() where id = c.place_id;

  else
    raise exception 'invalid_action';
  end if;
end $$;

revoke all on function public.decide_candidate(uuid, text, text, text) from public, anon;
grant execute on function public.decide_candidate(uuid, text, text, text) to authenticated;
