import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PHOTO_BUCKET, SUPPORT_EMAIL } from '../config';
import type { Level, NewReport, PlusSettings, Profile, Report, Track, TrackGeometry } from '../types';
import { seedReports, seedTracks } from './seed';
import { ensureSession, supabase } from './supabase';

/**
 * Sovelluksen tietovarasto.
 * - Supabase-tila: ladut LIPASista, raportit ja kuvat jaetaan kaikille.
 * - Testitila (ei SUPABASE_URL:ia): esimerkkidata, uudet raportit vain muistissa.
 */

const PROFILE_KEY = 'latu.profile.v2';
const FRESH_MS = 48 * 60 * 60 * 1000;
const CARE_MS = 72 * 60 * 60 * 1000;
const HISTORY_DAYS = 7;

/** Ladun huoltomerkinnät raportissa. */
export const CARE_GROOMED = 'Kunnostettu';
export const CARE_BASE = 'Pohjattu';

const DEFAULT_PLUS: PlusSettings = {
  mapColorsRequiresPlus: false,
  weatherRequiresPlus: false,
  notice: '',
};

export type BBox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

interface StoreValue {
  ready: boolean;
  online: boolean;
  error: string | null;
  refreshing: boolean;
  /** Ladut, jotka on haettu tähän mennessä (id → latu). */
  trackById: (id: string) => Track | undefined;
  /** Lähimmät ladut (tai esimerkkiladut testitilassa), etäisyyden mukaan. */
  nearby: Track[];
  reports: Report[];
  profile: Profile;
  plus: PlusSettings;
  /** Onko käyttäjällä Latu+ (tilaus tulee myöhemmin; nyt aina false). */
  isPlus: boolean;
  /** Saako käyttäjä käyttää ominaisuutta kytkimien mukaan. */
  canUse: (feature: 'mapColors' | 'weather') => boolean;
  reportsFor: (trackId: string) => Report[];
  /** Tuorein alle 48 h vanha raportti, tai null. */
  latestFor: (trackId: string) => Report | null;
  /** Tuorein alle 72 h vanha raportti, jossa on annettu huoltomerkintä. */
  lastCare: (trackId: string, tag: string) => Report | null;
  loadNearby: (lat: number, lng: number) => Promise<void>;
  loadBbox: (b: BBox) => Promise<Track[]>;
  search: (q: string) => Promise<Track[]>;
  ensureTrack: (id: string) => Promise<Track | undefined>;
  refresh: () => Promise<void>;
  addReport: (r: NewReport) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  flagReport: (id: string) => Promise<void>;
  /** Piilottaa raportin kirjoittajan kaikki raportit tältä laitteelta. */
  blockAuthor: (reportId: string) => Promise<void>;
  /** Palauttaa kaikki piilotetut kirjoittajat. */
  unblockAll: () => Promise<void>;
  updateProfile: (p: Partial<Profile>) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

type Row = {
  id: string;
  track_id: string;
  created_at: string;
  level: number;
  tags: string[];
  comment: string;
  photo_paths: string[];
  author_name: string | null;
};

type TrackRow = {
  id: string;
  name: string;
  city: string | null;
  length_km: number | string | null;
  lit: boolean;
  classic: boolean;
  skate: boolean;
  lat: number;
  lng: number;
  geojson: TrackGeometry | null;
  distance_km: number | null;
};

const REPORT_COLS = 'id,track_id,created_at,level,tags,comment,photo_paths,author_name';

function photoUrl(path: string) {
  return supabase!.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

function fromRow(r: Row, mine: Set<string>): Report {
  // Vanhat raportit: "Pohjattu tänään" → "Pohjattu"
  const tags = (r.tags ?? []).map((t) => (t === 'Pohjattu tänään' ? CARE_BASE : t));
  return {
    id: r.id,
    trackId: r.track_id,
    createdAt: new Date(r.created_at).getTime(),
    level: r.level as Level,
    tags,
    comment: r.comment ?? '',
    photos: (r.photo_paths ?? []).map(photoUrl),
    authorName: r.author_name,
    mine: mine.has(r.id),
  };
}

function fromTrackRow(x: TrackRow): Track {
  return {
    id: x.id,
    name: x.name,
    city: x.city ?? '',
    lengthKm: Number(x.length_km ?? 0),
    lit: x.lit,
    classic: x.classic,
    skate: x.skate,
    lat: x.lat,
    lng: x.lng,
    geometry: x.geojson,
    distanceKm: x.distance_km,
  };
}

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Lisää virheeseen tiedon siitä, missä vaiheessa se tapahtui (vianetsintää varten). */
function stepError(step: string, e: unknown): Error {
  const err = e as { message?: string; name?: string; code?: string; status?: number };
  const parts = [err?.name, err?.code, err?.status, err?.message ?? String(e)].filter(Boolean).join(' / ');
  return new Error(`[${step}] ${parts}`);
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  if (/Liian monta/.test(msg)) return 'Olet lähettänyt jo monta raporttia tunnin sisällä. Yritä myöhemmin uudelleen.';
  if (/Asiaton sana/.test(msg)) return 'Kommentissa tai nimimerkissä on sana, jota ei voi julkaista. Muokkaa tekstiä ja yritä uudelleen.';
  if (/Raportointi estetty/.test(msg)) return `Raportointi on estetty tältä laitteelta. Jos kyse on virheestä, ota yhteyttä: ${SUPPORT_EMAIL}`;
  console.warn('[latu] virhe:', msg);
  // Kehitystilassa (Expo Go) näytetään myös tekninen syy vianetsintää varten.
  const detail = __DEV__ ? `\n\n(${msg})` : '';
  if (/network|fetch/i.test(msg)) return 'Ei verkkoyhteyttä. Tarkista yhteys ja yritä uudelleen.' + detail;
  return 'Jokin meni vikaan. Yritä hetken päästä uudelleen.' + detail;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Record<string, Track>>(() =>
    supabase ? {} : Object.fromEntries(seedTracks.map((t) => [t.id, t]))
  );
  const [nearIds, setNearIds] = useState<string[]>(() => (supabase ? [] : seedTracks.map((t) => t.id)));
  const [reports, setReports] = useState<Report[]>([]);
  const [profile, setProfile] = useState<Profile>({ nickname: '', defaultAnonymous: true });
  const [plus, setPlus] = useState<PlusSettings>(DEFAULT_PLUS);
  const userIdRef = useRef<string | null>(null);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);

  const mergeTracks = useCallback((list: Track[]) => {
    if (!list.length) return;
    setTracks((cur) => {
      const next = { ...cur };
      for (const t of list) next[t.id] = { ...cur[t.id], ...t, distanceKm: t.distanceKm ?? cur[t.id]?.distanceKm };
      return next;
    });
  }, []);

  const session = useCallback(async () => {
    if (userIdRef.current) return userIdRef.current;
    try {
      userIdRef.current = await ensureSession(supabase!);
    } catch (e) {
      throw stepError('kirjautuminen', e);
    }
    return userIdRef.current;
  }, []);

  /** Raportit, oma tunniste ja Latu+-kytkimet. */
  const loadShared = useCallback(async () => {
    if (!supabase) {
      setReports((cur) => (cur.length ? cur : seedReports()));
      return;
    }
    try {
      await session();
      const since = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();
      const [r, m, s] = await Promise.all([
        supabase
          .from('reports')
          .select(REPORT_COLS)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase.rpc('my_report_ids'),
        supabase.from('app_settings').select('value').eq('key', 'plus').maybeSingle(),
      ]);
      if (r.error) throw stepError('raportit', r.error);
      const mine = new Set<string>(((m.data as string[] | null) ?? []).map(String));
      const rows = (r.data as Row[]).map((x) => fromRow(x, mine));
      setReports(rows);
      if (s.data?.value) setPlus({ ...DEFAULT_PLUS, ...(s.data.value as Partial<PlusSettings>) });
      // Haetaan myös ladut, joista on raportteja mutta jotka eivät ole vielä muistissa.
      const missing = [...new Set(rows.map((x) => x.trackId))];
      if (missing.length) {
        const t = await supabase.rpc('tracks_by_ids', { ids: missing });
        if (!t.error) mergeTracks((t.data as TrackRow[]).map(fromTrackRow));
      }
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [session, mergeTracks]);

  const loadNearby = useCallback(
    async (lat: number, lng: number) => {
      lastPos.current = { lat, lng };
      if (!supabase) return;
      const { data, error: e } = await supabase.rpc('tracks_near', { p_lat: lat, p_lng: lng, p_limit: 60 });
      if (e) {
        setError(friendlyError(stepError('ladut', e)));
        return;
      }
      const list = (data as TrackRow[]).map(fromTrackRow);
      mergeTracks(list);
      setNearIds(list.map((t) => t.id));
    },
    [mergeTracks]
  );

  const loadBbox = useCallback(
    async (b: BBox) => {
      if (!supabase) return seedTracks;
      const { data, error: e } = await supabase.rpc('tracks_in_bbox', {
        min_lng: b.minLng,
        min_lat: b.minLat,
        max_lng: b.maxLng,
        max_lat: b.maxLat,
        p_limit: 300,
      });
      if (e) return [];
      const list = (data as TrackRow[]).map(fromTrackRow);
      mergeTracks(list);
      return list;
    },
    [mergeTracks]
  );

  const search = useCallback(
    async (q: string) => {
      const query = q.trim().toLowerCase();
      if (query.length < 2) return [];
      if (!supabase) return seedTracks.filter((t) => t.name.toLowerCase().includes(query) || t.city.toLowerCase().includes(query));
      const { data, error: e } = await supabase.rpc('tracks_search', { q: query });
      if (e) return [];
      const list = (data as TrackRow[]).map(fromTrackRow);
      mergeTracks(list);
      return list;
    },
    [mergeTracks]
  );

  const ensureTrack = useCallback(
    async (id: string) => {
      if (tracks[id] || !supabase) return tracks[id];
      const { data } = await supabase.rpc('tracks_by_ids', { ids: [id] });
      const list = ((data as TrackRow[] | null) ?? []).map(fromTrackRow);
      mergeTracks(list);
      return list[0];
    },
    [tracks, mergeTracks]
  );

  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem(PROFILE_KEY);
        if (p) setProfile(JSON.parse(p));
      } catch {}
      await loadShared();
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const pos = lastPos.current;
    await Promise.all([loadShared(), pos ? loadNearby(pos.lat, pos.lng) : Promise.resolve()]);
    setRefreshing(false);
  }, [loadShared, loadNearby]);

  const addReport = useCallback(async (input: NewReport) => {
    if (!supabase) {
      setReports((cur) => [{ ...input, id: randomId(), createdAt: Date.now(), mine: true }, ...cur]);
      return;
    }
    try {
      const uid = await session();
      const paths: string[] = [];
      for (const uri of input.photos) {
        const path = `${uid}/${randomId()}.jpg`;
        let body: ArrayBuffer;
        try {
          body = await new File(uri).arrayBuffer();
        } catch (e) {
          throw stepError('kuvan luku', e);
        }
        const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, body, { contentType: 'image/jpeg' });
        if (up.error) throw stepError('kuvan lähetys', up.error);
        paths.push(path);
      }
      const { data, error: insErr } = await supabase
        .from('reports')
        .insert({
          track_id: input.trackId,
          level: input.level,
          tags: input.tags,
          comment: input.comment,
          photo_paths: paths,
          author_name: input.authorName,
        })
        .select(REPORT_COLS)
        .single();
      if (insErr) throw stepError('raportin tallennus', insErr);
      setReports((cur) => [fromRow(data as Row, new Set([(data as Row).id])), ...cur]);
    } catch (e) {
      throw new Error(friendlyError(e));
    }
  }, [session]);

  const deleteReport = useCallback(async (id: string) => {
    if (supabase) {
      const { error: e } = await supabase.rpc('delete_my_report', { rid: id });
      if (e) throw new Error(friendlyError(e));
    }
    setReports((cur) => cur.filter((r) => !(r.id === id && r.mine)));
  }, []);

  const flagReport = useCallback(async (id: string) => {
    if (!supabase) return;
    const { error: e } = await supabase.from('flags').insert({ report_id: id });
    // 23505 = sama käyttäjä on jo ilmoittanut tästä raportista: ei virhe käyttäjälle.
    if (e && e.code !== '23505') throw new Error(friendlyError(e));
  }, []);

  const blockAuthor = useCallback(
    async (reportId: string) => {
      if (!supabase) return;
      const { error: e } = await supabase.rpc('block_author', { rid: reportId });
      if (e) throw new Error(friendlyError(e));
      await loadShared();
    },
    [loadShared]
  );

  const unblockAll = useCallback(async () => {
    if (!supabase) return;
    const { error: e } = await supabase.rpc('unblock_all');
    if (e) throw new Error(friendlyError(e));
    await loadShared();
  }, [loadShared]);

  const updateProfile = useCallback(
    async (p: Partial<Profile>) => {
      const next = { ...profile, ...p };
      setProfile(next);
      try {
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      } catch {}
    },
    [profile]
  );

  const value = useMemo<StoreValue>(() => {
    const sorted = [...reports].sort((a, b) => b.createdAt - a.createdAt);
    const isPlus = false; // Tilaus (RevenueCat) tulee versiossa 1.2.
    return {
      ready,
      online: !!supabase,
      error,
      refreshing,
      trackById: (id) => tracks[id],
      nearby: nearIds.map((id) => tracks[id]).filter(Boolean) as Track[],
      reports: sorted,
      profile,
      plus,
      isPlus,
      canUse: (feature) =>
        isPlus || !(feature === 'mapColors' ? plus.mapColorsRequiresPlus : plus.weatherRequiresPlus),
      reportsFor: (trackId) => sorted.filter((r) => r.trackId === trackId),
      latestFor: (trackId) => {
        const r = sorted.find((x) => x.trackId === trackId);
        return r && Date.now() - r.createdAt < FRESH_MS ? r : null;
      },
      lastCare: (trackId, tag) => {
        const r = sorted.find((x) => x.trackId === trackId && x.tags.includes(tag));
        return r && Date.now() - r.createdAt < CARE_MS ? r : null;
      },
      loadNearby,
      loadBbox,
      search,
      ensureTrack,
      refresh,
      addReport,
      deleteReport,
      flagReport,
      blockAuthor,
      unblockAll,
      updateProfile,
    };
  }, [ready, error, refreshing, tracks, nearIds, reports, profile, plus, loadNearby, loadBbox, search, ensureTrack, refresh, addReport, deleteReport, flagReport, blockAuthor, unblockAll, updateProfile]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function displayName(r: Report) {
  return r.authorName?.trim() ? r.authorName : 'Anonyymi hiihtäjä';
}

/** Kaikki ladun reittiviivat koordinaattilistoina (kartan Polyline-viivoja varten). */
export function trackLines(g: TrackGeometry | null | undefined): [number, number][][] {
  if (!g) return [];
  if (g.type === 'LineString') return [g.coordinates as [number, number][]];
  if (g.type === 'MultiLineString') return g.coordinates as [number, number][][];
  if (g.type === 'GeometryCollection') return ((g.geometries as TrackGeometry[]) ?? []).flatMap(trackLines);
  return [];
}
