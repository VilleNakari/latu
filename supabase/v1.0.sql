-- =====================================================================
-- LATU versio 1.0 – tietokannan päivitys (aja KERRAN Supabasen SQL Editorissa)
-- Lisää: koko Suomen ladut LIPASista (yöllinen päivitys), ladut viivoina,
-- lähimpien latujen haku, Latu+-kytkimet.
-- HUOM: poistaa vanhat kuusi esimerkkilatua ja niiden testiraportit.
-- =====================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

-- ---------- Ladut: uudet sarakkeet ----------
alter table public.tracks add column if not exists city_code int;
alter table public.tracks add column if not exists geom extensions.geometry(Geometry, 4326);
alter table public.tracks add column if not exists geojson jsonb;
alter table public.tracks add column if not exists active boolean not null default true;
alter table public.tracks add column if not exists synced_at timestamptz;
create index if not exists tracks_geom_idx on public.tracks using gist (geom);
create index if not exists tracks_active_idx on public.tracks (active);

-- Vanhat esimerkkiladut pois (poistaa myös niiden testiraportit)
delete from public.tracks
where id in ('paloheina','keskuspuisto','pirttimaki','luukki','laajasalo','oittaa');

-- ---------- Kuntien nimet (Tilastokeskus) ----------
create table if not exists public.municipalities (code int primary key, name text not null);
alter table public.municipalities enable row level security;

create or replace function public.refresh_municipalities() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  resp extensions.http_response;
  n int := 0;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '60');
  select * into resp from extensions.http_get(
    'https://data.stat.fi/api/classifications/v2/classifications/kunta_1_'
    || extract(year from now())::int
    || '0101/classificationItems?content=data&meta=max&lang=fi&format=json');
  if resp.status <> 200 then
    raise warning 'Kuntaluettelon haku epäonnistui (%)', resp.status;
    return 0;
  end if;
  insert into municipalities (code, name)
  select (x->>'code')::int, x #>> '{classificationItemNames,0,name}'
  from jsonb_array_elements(resp.content::jsonb) x
  where x->>'code' ~ '^[0-9]+$'
  on conflict (code) do update set name = excluded.name;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- LIPAS-synkronointi ----------
-- Hakee kaikki hiihtoladut (LIPAS-tyyppi 4402) ja päivittää tracks-taulun.
create or replace function public.sync_lipas() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  started timestamptz := now();
  pg int := 1;
  pages int := 1;
  n int := 0;
  resp extensions.http_response;
  body jsonb;
  item jsonb;
  props jsonb;
  g extensions.geometry;
  p extensions.geometry;
  trad boolean;
  free boolean;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '90');
  loop
    select * into resp from extensions.http_get(
      'https://api.lipas.fi/v2/sports-sites?type-codes=4402&page-size=100&page=' || pg);
    if resp.status <> 200 then
      raise exception 'LIPAS vastasi virheellä % (sivu %)', resp.status, pg;
    end if;
    body := resp.content::jsonb;
    pages := coalesce((body #>> '{pagination,total-pages}')::int, 1);

    for item in select * from jsonb_array_elements(body->'items') loop
      begin
        select ST_Force2D(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON(f->>'geometry'), 4326)))
          into g
          from jsonb_array_elements(item #> '{location,geometries,features}') f;
        if g is null then
          continue;
        end if;
        p := ST_ClosestPoint(g, ST_Centroid(g));
        props := coalesce(item->'properties', '{}'::jsonb);
        trad := (props->>'ski-track-traditional?')::boolean;
        free := (props->>'ski-track-freestyle?')::boolean;

        insert into tracks (id, name, city, city_code, length_km, lit, classic, skate,
                            lat, lng, geom, geojson, active, synced_at)
        values (
          item->>'lipas-id',
          coalesce(nullif(item->>'name', ''), 'Latu'),
          coalesce((select m.name from municipalities m
                    where m.code = (item #>> '{location,city,city-code}')::int), ''),
          (item #>> '{location,city,city-code}')::int,
          round(coalesce((props->>'route-length-km')::numeric,
                         (ST_Length(g::geography) / 1000)::numeric), 1),
          coalesce((props->>'lit-route-length-km')::numeric, 0) > 0,
          coalesce(trad, not coalesce(free, false)),
          coalesce(free, false),
          ST_Y(p), ST_X(p),
          g,
          ST_AsGeoJSON(ST_SimplifyPreserveTopology(g, 0.00005), 5)::jsonb,
          true,
          now())
        on conflict (id) do update set
          name = excluded.name, city = excluded.city, city_code = excluded.city_code,
          length_km = excluded.length_km, lit = excluded.lit, classic = excluded.classic,
          skate = excluded.skate, lat = excluded.lat, lng = excluded.lng,
          geom = excluded.geom, geojson = excluded.geojson,
          active = true, synced_at = excluded.synced_at;
        n := n + 1;
      exception when others then
        raise warning 'LIPAS-kohde % ohitettiin: %', item->>'lipas-id', sqlerrm;
      end;
    end loop;

    exit when pg >= pages;
    pg := pg + 1;
  end loop;

  -- LIPASista poistuneet ladut piiloon (raportit säilyvät)
  update tracks set active = false where synced_at is null or synced_at < started;
  return n;
end $$;

-- ---------- Latujen haku sovellukselle ----------
create or replace function public.tracks_near(p_lat float8, p_lng float8, p_limit int default 60)
returns table (id text, name text, city text, length_km numeric, lit boolean, classic boolean,
               skate boolean, lat float8, lng float8, geojson jsonb, distance_km float8)
language sql stable set search_path = public, extensions as $$
  select t.id, t.name, t.city, t.length_km, t.lit, t.classic, t.skate, t.lat, t.lng, t.geojson,
         ST_Distance(t.geom::geography, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1000
  from tracks t
  where t.active and t.geom is not null
  order by t.geom <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
  limit least(greatest(p_limit, 1), 200)
$$;

create or replace function public.tracks_in_bbox(min_lng float8, min_lat float8, max_lng float8, max_lat float8, p_limit int default 300)
returns table (id text, name text, city text, length_km numeric, lit boolean, classic boolean,
               skate boolean, lat float8, lng float8, geojson jsonb, distance_km float8)
language sql stable set search_path = public, extensions as $$
  select t.id, t.name, t.city, t.length_km, t.lit, t.classic, t.skate, t.lat, t.lng, t.geojson, null::float8
  from tracks t
  where t.active and t.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  order by t.length_km desc nulls last
  limit least(greatest(p_limit, 1), 500)
$$;

create or replace function public.tracks_search(q text)
returns table (id text, name text, city text, length_km numeric, lit boolean, classic boolean,
               skate boolean, lat float8, lng float8, geojson jsonb, distance_km float8)
language sql stable set search_path = public, extensions as $$
  select t.id, t.name, t.city, t.length_km, t.lit, t.classic, t.skate, t.lat, t.lng, t.geojson, null::float8
  from tracks t
  where t.active and length(trim(q)) >= 2
    and (t.name ilike '%' || trim(q) || '%' or t.city ilike trim(q) || '%')
  order by (t.city ilike trim(q) || '%') desc, t.name
  limit 60
$$;

create or replace function public.tracks_by_ids(ids text[])
returns table (id text, name text, city text, length_km numeric, lit boolean, classic boolean,
               skate boolean, lat float8, lng float8, geojson jsonb, distance_km float8)
language sql stable set search_path = public, extensions as $$
  select t.id, t.name, t.city, t.length_km, t.lit, t.classic, t.skate, t.lat, t.lng, t.geojson, null::float8
  from tracks t where t.id = any(ids)
$$;

-- ---------- Latu+-kytkimet ----------
-- false = ominaisuus kaikille. Kun tilaus on julkaistu, vaihda true:ksi Table Editorissa.
create table if not exists public.app_settings (key text primary key, value jsonb not null);
alter table public.app_settings enable row level security;
drop policy if exists "asetukset näkyvät" on public.app_settings;
create policy "asetukset näkyvät" on public.app_settings for select using (true);
insert into public.app_settings (key, value) values
  ('plus', '{"mapColorsRequiresPlus": false, "weatherRequiresPlus": false, "notice": ""}')
on conflict (key) do nothing;

-- ---------- Oikeudet ----------
grant select on public.app_settings to anon, authenticated;
grant execute on function public.tracks_near(float8, float8, int) to anon, authenticated;
grant execute on function public.tracks_in_bbox(float8, float8, float8, float8, int) to anon, authenticated;
grant execute on function public.tracks_search(text) to anon, authenticated;
grant execute on function public.tracks_by_ids(text[]) to anon, authenticated;
revoke execute on function public.sync_lipas() from public, anon, authenticated;
revoke execute on function public.refresh_municipalities() from public, anon, authenticated;

-- ---------- Ajastus: päivitys kerran viikossa, maanantaiyönä klo 1.30 UTC (3.30 Suomen aikaa) ----------
-- Latujen sijainnit muuttuvat harvoin; latujen kunto tulee käyttäjien raporteista, ei LIPASista.
select cron.unschedule('latu-lipas-sync') where exists (select 1 from cron.job where jobname = 'latu-lipas-sync');
select cron.schedule('latu-lipas-sync', '30 1 * * 1',
  $job$ set statement_timeout = '15min'; select public.refresh_municipalities(); select public.sync_lipas(); $job$);
