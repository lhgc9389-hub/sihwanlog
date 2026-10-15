-- 시환로그 DB 스키마 (검색은 제가 합니다!)
-- ⚠ 이 파일은 아직 실제 Supabase에서 실행·검증되지 않았습니다. 튜토리얼 5단계에서 실행하고 오류가 나면 Claude에 오류 문구를 붙여넣으세요.

create extension if not exists pg_trgm;

-- 관리자 목록 (Supabase Auth 사용자와 연결)
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;

-- 지역 (전국 확장용 2단계 구조)
create table public.regions (
  id serial primary key,
  sido text not null,
  sigungu text not null,
  unique (sido, sigungu)
);

create type public.place_category as enum ('indoor','outdoor','experience');
create type public.verify_status as enum ('official_site','official_inquiry','visited','review_reference','needs_check','stale');
create type public.candidate_status as enum ('pending','approved','rejected','on_hold');

create table public.places (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  region_id int references public.regions(id),
  address text,
  category public.place_category,
  description text,
  official_url text,
  phone text,
  image_url text,
  recommended_age text,
  is_published boolean not null default false,
  is_test_data boolean not null default false,   -- 테스트 데이터는 화면에 반드시 표시
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.places (region_id);
create index on public.places (is_published);
create index on public.places using gin (name gin_trgm_ops);

-- 항목별 현재 공개 정보 (장소 1개 × 항목 1개 = 1행). 승인된 값만 들어간다.
create table public.place_facts (
  place_id uuid references public.places(id) on delete cascade,
  field text not null,   -- adult_fee, child_fee, infant_free, opening_hours, closed_days, nursing_room, diaper_station ...
  value text,
  status public.verify_status not null default 'needs_check',
  source_url text,
  verified_at timestamptz,          -- 마지막 확인 시각
  valid_from date, valid_to date,   -- 정보의 실제 적용 기간
  primary key (place_id, field)
);
create index on public.place_facts (field, value);

-- 변경 후보 (자동 추출 결과). 공개 데이터와 분리되어 있다.
create table public.change_candidates (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  field text not null,
  old_value text, new_value text not null,
  confidence text not null check (confidence in ('high','low')),
  evidence text, source_url text not null, checked_at timestamptz not null,
  critical boolean not null default false,
  status public.candidate_status not null default 'pending',
  decided_by uuid references auth.users(id), decided_at timestamptz, reason text,
  created_at timestamptz not null default now()
);
create unique index change_candidates_one_pending
  on public.change_candidates (place_id, field, new_value) where status = 'pending';  -- 중복 후보 방지

-- 승인/거절 변경 이력
create table public.change_history (
  id bigserial primary key,
  candidate_id uuid references public.change_candidates(id),
  place_id uuid not null references public.places(id) on delete cascade,
  field text not null, action text not null,
  before_value text, after_value text, reason text,
  admin_id uuid references auth.users(id), at timestamptz not null default now()
);

-- 자동 확인 실행 로그
create table public.check_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('schedule','manual')),
  started_at timestamptz not null default now(), finished_at timestamptz,
  places_total int default 0, places_ok int default 0, places_failed int default 0, candidates_created int default 0
);
create table public.check_results (
  id bigserial primary key,
  run_id uuid references public.check_runs(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  outcome text not null check (outcome in ('ok','fetch_failed','extract_failed','skipped_no_url')),
  fail_kind text, detail text,   -- 비밀 키/개인정보 기록 금지
  created_at timestamptz not null default now()
);
-- 중복 실행 방지: 진행 중(finished_at is null) 실행은 1개만 허용
create unique index check_runs_single_active on public.check_runs ((true)) where finished_at is null;

-- ───── Row Level Security ─────
alter table public.admins enable row level security;
alter table public.regions enable row level security;
alter table public.places enable row level security;
alter table public.place_facts enable row level security;
alter table public.change_candidates enable row level security;
alter table public.change_history enable row level security;
alter table public.check_runs enable row level security;
alter table public.check_results enable row level security;

create policy regions_read on public.regions for select using (true);
create policy places_public_read on public.places for select using (is_published or public.is_admin());
create policy facts_public_read on public.place_facts for select
  using (exists (select 1 from public.places p where p.id = place_id and p.is_published) or public.is_admin());

-- 관리자만 쓰기 / 후보·이력·로그는 관리자만 읽기
create policy places_admin_write on public.places for all using (public.is_admin()) with check (public.is_admin());
create policy facts_admin_write on public.place_facts for all using (public.is_admin()) with check (public.is_admin());
create policy candidates_admin on public.change_candidates for all using (public.is_admin()) with check (public.is_admin());
create policy history_admin on public.change_history for all using (public.is_admin()) with check (public.is_admin());
create policy runs_admin on public.check_runs for all using (public.is_admin()) with check (public.is_admin());
create policy results_admin on public.check_results for all using (public.is_admin()) with check (public.is_admin());
create policy admins_self_read on public.admins for select using (user_id = auth.uid());
