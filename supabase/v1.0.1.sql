-- =====================================================================
-- LATU versio 1.0.1 – Applen sääntö 1.2 (käyttäjien tuottama sisältö)
-- Aja KERRAN Supabasen SQL Editorissa (v1.0.sql:n jälkeen).
-- Lisää: sanasuodatin, kirjoittajan piilotus (esto), kehittäjän esto ja
-- ilmoitettujen raporttien seuranta.
-- =====================================================================

-- ---------- 1. Sanasuodatin ----------
-- Sanat ovat sanan alkuja: "vitu" estää myös "vitun", "vituiksi" jne.
-- Lisää sanoja: insert into public.banned_words values ('sana');
create table if not exists public.banned_words (word text primary key);
alter table public.banned_words enable row level security;
insert into public.banned_words (word) values
  ('vittu'), ('vitu'), ('paska'), ('kusipä'), ('mulkku'), ('kyrpä'), ('kyrvä'),
  ('huora'), ('lutka'), ('neeker'), ('mutakuono'), ('ryssä'),
  ('fuck'), ('shit'), ('cunt'), ('nigg'), ('whore'), ('bitch')
on conflict do nothing;

create or replace function public.has_banned_words(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from banned_words b
    where lower(coalesce(t, '')) ~ ('(^|[^[:alpha:]])' || b.word)
  )
$$;

-- ---------- 2. Kehittäjän estämät käyttäjät ----------
create table if not exists public.banned_users (
  user_id uuid primary key,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.banned_users enable row level security;

-- Raporttia tallennettaessa: suodatin, esto ja raporttiraja
create or replace function public.after_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Kirjautuminen puuttuu'; end if;
  if exists (select 1 from banned_users where user_id = auth.uid()) then
    raise exception 'Raportointi estetty';
  end if;
  if has_banned_words(new.comment) or has_banned_words(new.author_name) then
    raise exception 'Asiaton sana';
  end if;
  if (select count(*) from report_owners where user_id = auth.uid()
      and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Liian monta raporttia tunnissa';
  end if;
  insert into report_owners(report_id, user_id) values (new.id, auth.uid());
  return new;
end $$;

-- ---------- 3. Käyttäjä voi piilottaa toisen kirjoittajan raportit ----------
create table if not exists public.blocks (
  blocker uuid not null,
  blocked uuid not null,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
alter table public.blocks enable row level security;

create or replace function public.block_author(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'Kirjautuminen puuttuu'; end if;
  select user_id into target from report_owners where report_id = rid;
  if target is null or target = auth.uid() then return; end if;
  insert into blocks (blocker, blocked) values (auth.uid(), target) on conflict do nothing;
end $$;

create or replace function public.unblock_all() returns void
language sql security definer set search_path = public as $$
  delete from blocks where blocker = auth.uid()
$$;

create or replace function public.is_hidden_for_me(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks b join report_owners o on o.user_id = b.blocked
    where b.blocker = auth.uid() and o.report_id = rid
  )
$$;

drop policy if exists "raportit näkyvät" on public.reports;
create policy "raportit näkyvät" on public.reports for select
  using (not hidden and not public.is_hidden_for_me(id));

-- ---------- 4. Kehittäjän työkalut (eivät näy sovellukselle) ----------
create schema if not exists admin;

-- Ilmoitetut raportit: select * from admin.flagged_reports;
create or replace view admin.flagged_reports as
  select r.id, r.created_at, r.flag_count, r.hidden, r.level, r.comment, r.author_name,
         r.photo_paths, t.name as track, o.user_id
  from public.reports r
  join public.report_owners o on o.report_id = r.id
  left join public.tracks t on t.id = r.track_id
  where r.flag_count > 0
  order by r.hidden, r.flag_count desc, r.created_at desc;

-- Piilota yksittäinen raportti: select admin.hide_report('<raportin id>');
create or replace function admin.hide_report(rid uuid) returns void
language sql security definer set search_path = public as $$
  update reports set hidden = true where id = rid
$$;

-- Palauta virheellisesti piilotettu raportti: select admin.restore_report('<raportin id>');
create or replace function admin.restore_report(rid uuid) returns void
language sql security definer set search_path = public as $$
  update reports set hidden = false, flag_count = 0 where id = rid;
  delete from flags where report_id = rid
$$;

-- Estä raportin kirjoittaja ja piilota kaikki hänen raporttinsa:
-- select admin.ban_author('<raportin id>', 'syy');
create or replace function admin.ban_author(rid uuid, why text default null) returns void
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  select user_id into target from report_owners where report_id = rid;
  if target is null then raise exception 'Raporttia ei löydy'; end if;
  insert into banned_users (user_id, reason) values (target, why) on conflict (user_id) do nothing;
  update reports set hidden = true
  where id in (select report_id from report_owners where user_id = target);
end $$;

revoke all on schema admin from public, anon, authenticated;
revoke all on all functions in schema admin from public, anon, authenticated;

-- ---------- Oikeudet sovellukselle ----------
grant execute on function public.block_author(uuid) to authenticated;
grant execute on function public.unblock_all() to authenticated;
-- Käytetään raporttien näkyvyyssäännössä, joten kaikkien pitää voida kutsua sitä.
grant execute on function public.is_hidden_for_me(uuid) to anon, authenticated;
revoke execute on function public.has_banned_words(text) from public, anon, authenticated;
