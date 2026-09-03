-- AI Star scorecard: Supabase Auth, shared PostgreSQL data, approval flow,
-- immutable audit history, and Row Level Security.
--
-- This file contains no runtime secret and is safe to keep in GitHub.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.access_requests (
  email text primary key,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  status text not null default 'pending',
  role text not null default 'member',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_email text,
  reviewed_by_name text,
  constraint access_requests_email_normalized check (email = lower(btrim(email))),
  constraint access_requests_display_name_length check (char_length(display_name) between 1 and 80),
  constraint access_requests_status_valid check (status in ('pending', 'approved', 'rejected')),
  constraint access_requests_role_valid check (role in ('member', 'admin'))
);

create unique index if not exists access_requests_user_id_idx
  on public.access_requests (user_id)
  where user_id is not null;
create index if not exists access_requests_status_requested_idx
  on public.access_requests (status, requested_at desc);

create table if not exists public.annual_targets (
  year smallint primary key,
  stage smallint not null,
  paper_sci smallint not null,
  paper_top smallint not null,
  patent_application_domestic smallint not null,
  patent_application_international smallint not null,
  patent_registration_domestic smallint not null,
  patent_registration_international smallint not null,
  open_source smallint not null,
  beneficiary_bachelor smallint not null default 0,
  beneficiary_master smallint not null default 0,
  beneficiary_doctor smallint not null default 0,
  graduate_master smallint not null default 0,
  graduate_doctor smallint not null default 0,
  constraint annual_targets_year_range check (year between 2026 and 2031),
  constraint annual_targets_stage_range check (stage between 1 and 3),
  constraint annual_targets_nonnegative check (
    paper_sci >= 0 and paper_top >= 0 and
    patent_application_domestic >= 0 and patent_application_international >= 0 and
    patent_registration_domestic >= 0 and patent_registration_international >= 0 and
    open_source >= 0 and beneficiary_bachelor >= 0 and beneficiary_master >= 0 and
    beneficiary_doctor >= 0 and graduate_master >= 0 and graduate_doctor >= 0
  )
);

create table if not exists public.performance_records (
  id uuid primary key,
  metric_type text not null,
  acknowledgement_count smallint not null default 1,
  year smallint not null,
  title text not null,
  organization text not null,
  project text not null default '',
  achievement_date date,
  identifier text not null default '',
  url text,
  notes text not null default '',
  created_by_user_id uuid,
  created_by_email text not null,
  created_by_name text not null,
  updated_by_user_id uuid,
  updated_by_email text not null,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false,
  constraint performance_records_metric_valid check (metric_type in (
    'paper_jcr_top10',
    'conference_top_tier',
    'paper_scie_q1',
    'paper_scie_other',
    'conference_other_top_tier',
    'paper_sci',
    'paper_top',
    'patent_application_domestic',
    'patent_application_international',
    'patent_registration_domestic',
    'patent_registration_international',
    'open_source'
  )),
  constraint performance_records_acknowledgement_range check (acknowledgement_count between 1 and 10),
  constraint performance_records_year_range check (year between 2026 and 2031),
  constraint performance_records_title_length check (char_length(title) between 1 and 300),
  constraint performance_records_organization_valid check (organization in ('제주대학교', '건국대학교', '공동', '기타')),
  constraint performance_records_project_length check (char_length(project) <= 80),
  constraint performance_records_identifier_length check (char_length(identifier) <= 200),
  constraint performance_records_url_valid check (url is null or (char_length(url) <= 500 and url ~* '^https?://')),
  constraint performance_records_notes_length check (char_length(notes) <= 2000)
);

create index if not exists performance_records_active_year_updated_idx
  on public.performance_records (year, updated_at desc)
  where archived = false;
create index if not exists performance_records_active_metric_year_idx
  on public.performance_records (metric_type, year)
  where archived = false;

create table if not exists public.training_participants (
  id uuid primary key,
  name text not null,
  school text not null,
  degree_course text not null,
  participation_start date not null,
  participation_end date,
  graduation_date date,
  project text not null default '',
  role text not null default '',
  notes text not null default '',
  created_by_user_id uuid,
  created_by_email text not null,
  created_by_name text not null,
  updated_by_user_id uuid,
  updated_by_email text not null,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false,
  constraint training_participants_name_length check (char_length(name) between 1 and 80),
  constraint training_participants_school_length check (char_length(school) between 1 and 100),
  constraint training_participants_degree_valid check (degree_course in ('bachelor', 'master', 'doctor')),
  constraint training_participants_start_range check (participation_start between date '2026-07-01' and date '2031-12-31'),
  constraint training_participants_end_range check (
    participation_end is null or
    (participation_end between participation_start and date '2031-12-31')
  ),
  constraint training_participants_graduation_range check (
    graduation_date is null or
    (graduation_date >= participation_start and
      graduation_date <= coalesce(participation_end, date '2031-12-31'))
  ),
  constraint training_participants_project_length check (char_length(project) <= 80),
  constraint training_participants_role_length check (char_length(role) <= 100),
  constraint training_participants_notes_length check (char_length(notes) <= 2000)
);

create index if not exists training_participants_active_school_idx
  on public.training_participants (school)
  where archived = false;
create index if not exists training_participants_active_degree_idx
  on public.training_participants (degree_course)
  where archived = false;

create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  record_id uuid not null,
  entity_type text not null,
  action text not null,
  summary text not null,
  changed_by_user_id uuid,
  changed_by_email text not null,
  changed_by_name text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint audit_logs_entity_valid check (entity_type in ('performance', 'training_participant')),
  constraint audit_logs_action_valid check (action in ('created', 'updated', 'deleted')),
  constraint audit_logs_summary_length check (char_length(summary) between 1 and 500)
);

create index if not exists audit_logs_record_created_idx
  on public.audit_logs (record_id, id desc);
create index if not exists audit_logs_created_idx
  on public.audit_logs (created_at desc);

insert into public.annual_targets (
  year, stage, paper_sci, paper_top,
  patent_application_domestic, patent_application_international,
  patent_registration_domestic, patent_registration_international,
  open_source, beneficiary_bachelor, beneficiary_master, beneficiary_doctor,
  graduate_master, graduate_doctor
) values
  (2026, 1, 0, 8, 10, 0, 0, 0, 10, 10, 20, 10, 0, 0),
  (2027, 1, 6, 16, 12, 4, 0, 0, 15, 15, 30, 10, 20, 2),
  (2028, 2, 9, 20, 15, 6, 6, 0, 20, 15, 30, 10, 25, 4),
  (2029, 2, 15, 26, 18, 8, 8, 2, 25, 20, 30, 10, 25, 6),
  (2030, 3, 20, 30, 20, 10, 10, 4, 30, 20, 30, 10, 25, 8),
  (2031, 3, 24, 40, 20, 12, 12, 6, 40, 20, 30, 10, 25, 10)
on conflict (year) do update set
  stage = excluded.stage,
  paper_sci = excluded.paper_sci,
  paper_top = excluded.paper_top,
  patent_application_domestic = excluded.patent_application_domestic,
  patent_application_international = excluded.patent_application_international,
  patent_registration_domestic = excluded.patent_registration_domestic,
  patent_registration_international = excluded.patent_registration_international,
  open_source = excluded.open_source,
  beneficiary_bachelor = excluded.beneficiary_bachelor,
  beneficiary_master = excluded.beneficiary_master,
  beneficiary_doctor = excluded.beneficiary_doctor,
  graduate_master = excluded.graduate_master,
  graduate_doctor = excluded.graduate_doctor;

insert into public.access_requests (email, display_name, status, role)
values ('saintrv@hanmail.net', '관리자', 'approved', 'admin')
on conflict (email) do update set status = 'approved', role = 'admin';

create or replace function private.current_email()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), ''));
$$;

create or replace function private.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      (select private.current_email()) = 'saintrv@hanmail.net'
      or exists (
        select 1
        from public.access_requests
        where email = (select private.current_email())
          and status = 'approved'
          and role = 'admin'
      )
    );
$$;

create or replace function private.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      (select private.current_email()) = 'saintrv@hanmail.net'
      or exists (
        select 1
        from public.access_requests
        where email = (select private.current_email())
          and status = 'approved'
      )
    );
$$;

create or replace function private.get_access_context_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_email text := private.current_email();
  actor_name text;
  request_status text;
  request_role text;
begin
  if (select auth.uid()) is null or actor_email = '' then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select display_name, status, role
    into actor_name, request_status, request_role
  from public.access_requests
  where email = actor_email;

  actor_name := coalesce(
    nullif(btrim(actor_name), ''),
    nullif(btrim(coalesce((select auth.jwt() -> 'user_metadata' ->> 'display_name'), '')), ''),
    split_part(actor_email, '@', 1)
  );

  if actor_email = 'saintrv@hanmail.net' then
    return jsonb_build_object('status', 'owner', 'is_admin', true, 'display_name', actor_name);
  end if;

  return jsonb_build_object(
    'status', coalesce(request_status, 'none'),
    'is_admin', request_status = 'approved' and request_role = 'admin',
    'display_name', actor_name
  );
end;
$$;

create or replace function private.request_access_impl(requested_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_email text := private.current_email();
  actor_name text;
  result_row public.access_requests%rowtype;
begin
  if actor_id is null or actor_email = '' then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  actor_name := left(btrim(coalesce(requested_display_name, '')), 80);
  if actor_name = '' then
    actor_name := left(coalesce(
      nullif(btrim(coalesce((select auth.jwt() -> 'user_metadata' ->> 'display_name'), '')), ''),
      split_part(actor_email, '@', 1)
    ), 80);
  end if;

  insert into public.access_requests as existing (
    email, user_id, display_name, status, requested_at
  ) values (
    actor_email, actor_id, actor_name, 'pending', now()
  )
  on conflict (email) do update set
    user_id = excluded.user_id,
    display_name = excluded.display_name,
    status = case when existing.status = 'rejected' then 'pending' else existing.status end,
    requested_at = case when existing.status = 'rejected' then now() else existing.requested_at end,
    reviewed_at = case when existing.status = 'rejected' then null else existing.reviewed_at end,
    reviewed_by_email = case when existing.status = 'rejected' then null else existing.reviewed_by_email end,
    reviewed_by_name = case when existing.status = 'rejected' then null else existing.reviewed_by_name end
  returning * into result_row;

  return to_jsonb(result_row);
end;
$$;

create or replace function private.review_access_request_impl(target_email text, new_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_email text := private.current_email();
  actor_name text;
  normalized_target text := lower(btrim(target_email));
  result_row public.access_requests%rowtype;
begin
  if not (select private.is_admin_user()) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  if new_status not in ('approved', 'rejected') then
    raise exception 'invalid access status' using errcode = '22023';
  end if;
  if normalized_target = 'saintrv@hanmail.net' then
    raise exception 'the owner account cannot be changed' using errcode = '42501';
  end if;

  select display_name into actor_name
  from public.access_requests
  where email = actor_email;
  actor_name := coalesce(nullif(btrim(actor_name), ''), split_part(actor_email, '@', 1));

  update public.access_requests
  set status = new_status,
      reviewed_at = now(),
      reviewed_by_email = actor_email,
      reviewed_by_name = actor_name
  where email = normalized_target
  returning * into result_row;

  if result_row.email is null then
    raise exception 'access request not found' using errcode = 'P0002';
  end if;

  return to_jsonb(result_row);
end;
$$;

-- Only these invoker wrappers are exposed through the Data API. The privileged
-- implementations live in the non-exposed private schema and validate the
-- authenticated caller before reading or mutating approval data.
create or replace function public.get_access_context()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_access_context_impl();
$$;

create or replace function public.request_access(requested_display_name text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.request_access_impl(requested_display_name);
$$;

create or replace function public.review_access_request(target_email text, new_status text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.review_access_request_impl(target_email, new_status);
$$;

create or replace function private.stamp_shared_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_email text;
  actor_name text;
begin
  if actor_id is null then
    return new;
  end if;

  actor_email := private.current_email();
  select display_name into actor_name
  from public.access_requests
  where email = actor_email;
  actor_name := coalesce(nullif(btrim(actor_name), ''), split_part(actor_email, '@', 1));

  if tg_op = 'INSERT' then
    new.created_by_user_id := actor_id;
    new.created_by_email := actor_email;
    new.created_by_name := actor_name;
    new.created_at := now();
    new.archived := false;
  else
    new.id := old.id;
    new.created_by_user_id := old.created_by_user_id;
    new.created_by_email := old.created_by_email;
    new.created_by_name := old.created_by_name;
    new.created_at := old.created_at;
  end if;

  new.updated_by_user_id := actor_id;
  new.updated_by_email := actor_email;
  new.updated_by_name := actor_name;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.audit_shared_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_action text;
  event_entity text;
  event_summary text;
begin
  if (select auth.uid()) is null then
    return null;
  end if;

  event_action := case
    when tg_op = 'INSERT' then 'created'
    when old.archived = false and new.archived = true then 'deleted'
    else 'updated'
  end;

  if tg_table_name = 'performance_records' then
    event_entity := 'performance';
    event_summary := format('%s 성과를 %s했습니다.', new.title, case event_action when 'created' then '등록' when 'deleted' then '삭제' else '수정' end);
  else
    event_entity := 'training_participant';
    event_summary := format('%s 참여인력을 %s했습니다.', new.name, case event_action when 'created' then '등록' when 'deleted' then '삭제' else '수정' end);
  end if;

  insert into public.audit_logs (
    record_id, entity_type, action, summary,
    changed_by_user_id, changed_by_email, changed_by_name,
    snapshot, created_at
  ) values (
    new.id, event_entity, event_action, event_summary,
    new.updated_by_user_id, new.updated_by_email, new.updated_by_name,
    to_jsonb(new), now()
  );
  return null;
end;
$$;

drop trigger if exists performance_records_stamp on public.performance_records;
create trigger performance_records_stamp
before insert or update on public.performance_records
for each row execute function private.stamp_shared_record();

drop trigger if exists performance_records_audit on public.performance_records;
create trigger performance_records_audit
after insert or update on public.performance_records
for each row execute function private.audit_shared_record();

drop trigger if exists training_participants_stamp on public.training_participants;
create trigger training_participants_stamp
before insert or update on public.training_participants
for each row execute function private.stamp_shared_record();

drop trigger if exists training_participants_audit on public.training_participants;
create trigger training_participants_audit
after insert or update on public.training_participants
for each row execute function private.audit_shared_record();

alter table public.access_requests enable row level security;
alter table public.annual_targets enable row level security;
alter table public.performance_records enable row level security;
alter table public.training_participants enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists access_requests_select_own on public.access_requests;
drop policy if exists access_requests_select_admin on public.access_requests;
drop policy if exists access_requests_select_self_or_admin on public.access_requests;
create policy access_requests_select_self_or_admin
on public.access_requests for select
to authenticated
using (
  (
    (select auth.uid()) is not null
    and email = (select private.current_email())
  )
  or (select private.is_admin_user())
);

drop policy if exists annual_targets_select_approved on public.annual_targets;
create policy annual_targets_select_approved
on public.annual_targets for select
to authenticated
using ((select private.is_approved_user()));

drop policy if exists performance_records_select_approved on public.performance_records;
create policy performance_records_select_approved
on public.performance_records for select
to authenticated
using ((select private.is_approved_user()));

drop policy if exists performance_records_insert_approved on public.performance_records;
create policy performance_records_insert_approved
on public.performance_records for insert
to authenticated
with check ((select private.is_approved_user()) and archived = false);

drop policy if exists performance_records_update_approved on public.performance_records;
create policy performance_records_update_approved
on public.performance_records for update
to authenticated
using ((select private.is_approved_user()) and archived = false)
with check ((select private.is_approved_user()));

drop policy if exists training_participants_select_approved on public.training_participants;
create policy training_participants_select_approved
on public.training_participants for select
to authenticated
using ((select private.is_approved_user()));

drop policy if exists training_participants_insert_approved on public.training_participants;
create policy training_participants_insert_approved
on public.training_participants for insert
to authenticated
with check ((select private.is_approved_user()) and archived = false);

drop policy if exists training_participants_update_approved on public.training_participants;
create policy training_participants_update_approved
on public.training_participants for update
to authenticated
using ((select private.is_approved_user()) and archived = false)
with check ((select private.is_approved_user()));

drop policy if exists audit_logs_select_approved on public.audit_logs;
create policy audit_logs_select_approved
on public.audit_logs for select
to authenticated
using ((select private.is_approved_user()));

revoke all on table public.access_requests from public, anon, authenticated;
revoke all on table public.annual_targets from public, anon, authenticated;
revoke all on table public.performance_records from public, anon, authenticated;
revoke all on table public.training_participants from public, anon, authenticated;
revoke all on table public.audit_logs from public, anon, authenticated;

grant usage on schema public to authenticated;
grant select on table public.access_requests to authenticated;
grant select on table public.annual_targets to authenticated;
grant select, insert, update on table public.performance_records to authenticated;
grant select, insert, update on table public.training_participants to authenticated;
grant select on table public.audit_logs to authenticated;

grant all on table public.access_requests to service_role;
grant all on table public.annual_targets to service_role;
grant all on table public.performance_records to service_role;
grant all on table public.training_participants to service_role;
grant all on table public.audit_logs to service_role;
grant usage, select on sequence public.audit_logs_id_seq to service_role;

revoke execute on function private.current_email() from public, anon;
revoke execute on function private.is_admin_user() from public, anon;
revoke execute on function private.is_approved_user() from public, anon;
revoke execute on function private.get_access_context_impl() from public, anon;
revoke execute on function private.request_access_impl(text) from public, anon;
revoke execute on function private.review_access_request_impl(text, text) from public, anon;
revoke execute on function private.stamp_shared_record() from public, anon, authenticated;
revoke execute on function private.audit_shared_record() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_email() to authenticated;
grant execute on function private.is_admin_user() to authenticated;
grant execute on function private.is_approved_user() to authenticated;
grant execute on function private.get_access_context_impl() to authenticated;
grant execute on function private.request_access_impl(text) to authenticated;
grant execute on function private.review_access_request_impl(text, text) to authenticated;

revoke execute on function public.get_access_context() from public, anon;
revoke execute on function public.request_access(text) from public, anon;
revoke execute on function public.review_access_request(text, text) from public, anon;
grant execute on function public.get_access_context() to authenticated;
grant execute on function public.request_access(text) to authenticated;
grant execute on function public.review_access_request(text, text) to authenticated;

notify pgrst, 'reload schema';
