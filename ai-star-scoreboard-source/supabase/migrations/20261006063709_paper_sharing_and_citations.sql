create table public.shared_papers (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(btrim(title)) between 1 and 1000),
 authors text not null default '' check (length(authors)<=5000),
 professors text not null default '' check(length(professors)<=1000),
 publication_name text not null default '' check(length(publication_name)<=1000),
 publication_year integer check(publication_year between 1900 and 2100),
 doi text not null default '' check(length(doi)<=500 and doi=lower(btrim(doi))),
 url text not null default '' check(length(url)<=2000 and (url='' or url ~* '^https?://')),
 abstract text not null default '' check(length(abstract)<=30000),
 keywords text[] not null default '{}' check(cardinality(keywords)<=30 and length(keywords::text)<=3000),
 bibtex text not null default '' check(length(bibtex)<=30000),
 notes text not null default '' check(length(notes)<=5000),
 metadata_source text not null default '' check(length(metadata_source)<=200),
 source_record_id uuid references public.performance_records(id),
 created_by_user_id uuid not null, created_by_email text not null, created_by_name text not null,
 updated_by_user_id uuid not null, updated_by_email text not null, updated_by_name text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived boolean not null default false
);
create unique index shared_papers_doi_unique on public.shared_papers(doi) where doi<>'' and not archived;
create unique index shared_papers_url_unique on public.shared_papers(md5(url)) where url<>'' and not archived;
create unique index shared_papers_source_unique on public.shared_papers(source_record_id) where source_record_id is not null and not archived;
create index shared_papers_created_idx on public.shared_papers(created_at desc) where not archived;
create index shared_papers_owner_idx on public.shared_papers(created_by_user_id);
create table public.paper_citations (
 id uuid primary key default gen_random_uuid(), paper_id uuid not null references public.shared_papers(id),
 citing_title text not null check(length(btrim(citing_title)) between 1 and 1000),
 citing_url text not null default '' check(length(citing_url)<=2000 and (citing_url='' or citing_url ~* '^https?://')),
 citation_status text not null default 'draft' check(citation_status in ('draft','submitted','published')),
 citation_date date not null default current_date,
 notes text not null default '' check(length(notes)<=5000),
 created_by_user_id uuid not null, created_by_email text not null, created_by_name text not null,
 updated_by_user_id uuid not null, updated_by_email text not null, updated_by_name text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived boolean not null default false
);
create index paper_citations_paper_idx on public.paper_citations(paper_id,created_at desc);
create index paper_citations_owner_idx on public.paper_citations(created_by_user_id);
create unique index paper_citations_duplicate on public.paper_citations(paper_id,created_by_user_id,md5(lower(btrim(citing_title)))) where not archived;
create table public.paper_activity (
 id bigint generated always as identity primary key, paper_id uuid not null references public.shared_papers(id),
 entity_id uuid not null, entity_type text not null check(entity_type in ('paper','citation')), action text not null check(action in ('created','updated','deleted')),
 actor_id uuid not null, actor_name text not null, snapshot jsonb not null, created_at timestamptz not null default now()
);
create index paper_activity_paper_idx on public.paper_activity(paper_id,id desc);
create or replace function private.audit_paper_change() returns trigger language plpgsql security definer set search_path='' as $$
declare target_paper_id uuid;
begin
 if tg_table_name='shared_papers' then target_paper_id:=new.id; else target_paper_id:=new.paper_id; end if;
 if auth.uid() is null or not private.is_approved_user() then raise exception 'approval required' using errcode='42501'; end if;
 insert into public.paper_activity(paper_id,entity_id,entity_type,action,actor_id,actor_name,snapshot)
 values(target_paper_id,new.id,case when tg_table_name='shared_papers' then 'paper' else 'citation' end,
 case when tg_op='INSERT' then 'created' when not old.archived and new.archived then 'deleted' else 'updated' end,
 auth.uid(),new.updated_by_name,to_jsonb(new));
 return null;
end $$;
create or replace function private.check_paper_citation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then new.paper_id:=old.paper_id; end if;
 if not exists(select 1 from public.shared_papers p where p.id=new.paper_id and not p.archived) then raise exception 'paper unavailable' using errcode='23514'; end if;
 return new;
end $$;
create trigger shared_papers_stamp before insert or update on public.shared_papers for each row execute function private.stamp_shared_record();
create trigger shared_papers_audit after insert or update on public.shared_papers for each row execute function private.audit_paper_change();
create trigger paper_citations_stamp before insert or update on public.paper_citations for each row execute function private.stamp_shared_record();
create trigger paper_citations_check before insert or update on public.paper_citations for each row execute function private.check_paper_citation();
create trigger paper_citations_audit after insert or update on public.paper_citations for each row execute function private.audit_paper_change();
alter table public.shared_papers enable row level security;
alter table public.paper_citations enable row level security;
alter table public.paper_activity enable row level security;
create policy shared_papers_read on public.shared_papers for select to authenticated using((select private.is_approved_user()));
create policy shared_papers_add on public.shared_papers for insert to authenticated with check((select private.is_approved_user()) and created_by_user_id=(select auth.uid()) and not archived);
create policy shared_papers_edit on public.shared_papers for update to authenticated using((select private.is_approved_user()) and not archived and (created_by_user_id=(select auth.uid()) or (select private.is_admin_user()))) with check((select private.is_approved_user()) and (created_by_user_id=(select auth.uid()) or (select private.is_admin_user())));
create policy paper_citations_read on public.paper_citations for select to authenticated using((select private.is_approved_user()));
create policy paper_citations_add on public.paper_citations for insert to authenticated with check((select private.is_approved_user()) and created_by_user_id=(select auth.uid()) and not archived);
create policy paper_citations_edit on public.paper_citations for update to authenticated using((select private.is_approved_user()) and not archived and (created_by_user_id=(select auth.uid()) or (select private.is_admin_user()))) with check((select private.is_approved_user()) and (created_by_user_id=(select auth.uid()) or (select private.is_admin_user())));
create policy paper_activity_read on public.paper_activity for select to authenticated using((select private.is_approved_user()));
revoke all on public.shared_papers,public.paper_citations,public.paper_activity from public,anon,authenticated;
grant select,insert,update on public.shared_papers,public.paper_citations to authenticated;
grant select on public.paper_activity to authenticated;
grant all on public.shared_papers,public.paper_citations,public.paper_activity to service_role;
grant usage,select on sequence public.paper_activity_id_seq to service_role;
revoke all on function private.audit_paper_change(),private.check_paper_citation() from public,anon,authenticated;
notify pgrst,'reload schema';
