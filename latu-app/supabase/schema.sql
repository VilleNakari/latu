-- LATU: tietokanta (aja kerran Supabasen SQL Editorissa)
create table public.tracks (
  id text primary key, name text not null, city text not null,
  length_km numeric, lit boolean not null default false,
  classic boolean not null default true, skate boolean not null default false,
  lat double precision not null, lng double precision not null
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  track_id text not null references public.tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  level smallint not null check (level between 1 and 4),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  comment text not null default '' check (char_length(comment) <= 500),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 3),
  author_name text check (author_name is null or char_length(author_name) between 2 and 24),
  flag_count int not null default 0,
  hidden boolean not null default false
);
create index on public.reports (track_id, created_at desc);

-- Kuka teki raportin: piilotettu kaikilta
create table public.report_owners (
  report_id uuid primary key references public.reports(id) on delete cascade,
  user_id uuid not null, created_at timestamptz not null default now()
);

create table public.flags (
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  primary key (report_id, user_id)
);

alter table public.tracks enable row level security;
alter table public.reports enable row level security;
alter table public.report_owners enable row level security;
alter table public.flags enable row level security;

create policy "ladut näkyvät" on public.tracks for select using (true);
create policy "raportit näkyvät" on public.reports for select using (not hidden);
create policy "raportin lisäys" on public.reports for insert to authenticated
  with check (hidden = false and flag_count = 0);
create policy "ilmoitus" on public.flags for insert to authenticated
  with check (user_id = auth.uid());

create function public.before_report() returns trigger language plpgsql as $$
begin new.created_at := now(); new.flag_count := 0; new.hidden := false; return new; end $$;
create trigger before_report before insert on public.reports
  for each row execute function public.before_report();

-- Omistaja talteen + enintään 10 raporttia tunnissa
create function public.after_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Kirjautuminen puuttuu'; end if;
  if (select count(*) from report_owners where user_id = auth.uid()
      and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Liian monta raporttia tunnissa';
  end if;
  insert into report_owners(report_id, user_id) values (new.id, auth.uid());
  return new;
end $$;
create trigger after_report after insert on public.reports
  for each row execute function public.after_report();

-- 3 ilmoitusta piilottaa raportin automaattisesti
create function public.after_flag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update reports set flag_count = flag_count + 1, hidden = (flag_count + 1 >= 3)
  where id = new.report_id;
  return new;
end $$;
create trigger after_flag after insert on public.flags
  for each row execute function public.after_flag();

create function public.my_report_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select report_id from report_owners where user_id = auth.uid() $$;

create function public.delete_my_report(rid uuid) returns void
language sql security definer set search_path = public as $$
  delete from reports where id = rid and exists
  (select 1 from report_owners o where o.report_id = rid and o.user_id = auth.uid()) $$;

-- Kuvat
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', true, 3145728, array['image/jpeg']);
create policy "kuvien lataus" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = auth.uid()::text);

-- Esimerkkiladut (korvataan myöhemmin LIPAS-ladulla)
insert into public.tracks values
('paloheina','Paloheinän valaistu latu','Helsinki',7.5,true,true,true,60.2563,24.9216),
('keskuspuisto','Keskuspuiston latu','Helsinki',9.0,true,true,false,60.2275,24.9198),
('pirttimaki','Pirttimäen kenttä','Helsinki',3.8,true,true,true,60.2539,24.9531),
('luukki','Luukin ulkoilualue','Espoo',9.1,false,true,true,60.31,24.68),
('laajasalo','Laajasalon latu','Helsinki',4.2,true,true,false,60.17,25.05),
('oittaa','Oittaan ulkoilualue','Espoo',6.0,true,true,true,60.265,24.645);
