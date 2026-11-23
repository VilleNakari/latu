import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PHOTO_BUCKET } from '../config';
import type { Level, NewReport, Profile, Report, Track } from '../types';
import { seedReports, seedTracks } from './seed';
import { ensureSession, supabase } from './supabase';

/**
 * Sovelluksen tietovarasto.
 * - Supabase-tila (config.ts:ssä SUPABASE_URL): raportit ja kuvat jaetaan kaikille käyttäjille.
 * - Testitila (ei URL:ia): esimerkkidata, uudet raportit vain muistissa.
 */

const PROFILE_KEY = 'latu.profile.v2';
const FRESH_MS = 48 * 60 * 60 * 1000;
const HISTORY_DAYS = 7;

interface StoreValue {
  ready: boolean;
  online: boolean;
  error: string | null;
  refreshing: boolean;
  tracks: Track[];
  reports: Report[];
  profile: Profile;
  reportsFor: (trackId: string) => Report[];
  /** Tuorein alle 48 h vanha raportti, tai null. */
  latestFor: (trackId: string) => Report | null;
  refresh: () => Promise<void>;
  addReport: (r: NewReport) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  flagReport: (id: string) => Promise<void>;
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
  city: string;
  length_km: number | null;
  lit: boolean;
  classic: boolean;
  skate: boolean;
  lat: number;
  lng: number;
};

function photoUrl(path: string) {
  return supabase!.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

function fromRow(r: Row, mine: Set<string>): Report {
  return {
    id: r.id,
    trackId: r.track_id,
    createdAt: new Date(r.created_at).getTime(),
    level: r.level as Level,
    tags: r.tags ?? [],
    comment: r.comment ?? '',
    photos: (r.photo_paths ?? []).map(photoUrl),
    authorName: r.author_name,
    mine: mine.has(r.id),
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
  const [tracks, setTracks] = useState<Track[]>(seedTracks);
  const [reports, setReports] = useState<Report[]>([]);
  const [profile, setProfile] = useState<Profile>({ nickname: '', defaultAnonymous: true });
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setReports((cur) => (cur.length ? cur : seedReports()));
      return;
    }
    try {
      let uid = userId;
      if (!uid) {
        try {
          uid = await ensureSession(supabase);
        } catch (e) {
          throw stepError('kirjautuminen', e);
        }
        setUserId(uid);
      }
      const since = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();
      const [t, r, m] = await Promise.all([
        supabase.from('tracks').select('*').order('name'),
        supabase
          .from('reports')
          .select('id,track_id,created_at,level,tags,comment,photo_paths,author_name')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase.rpc('my_report_ids'),
      ]);
      if (t.error) throw stepError('ladut', t.error);
      if (r.error) throw stepError('raportit', r.error);
      const mine = new Set<string>(((m.data as string[] | null) ?? []).map(String));
      setTracks(
        (t.data as TrackRow[]).map((x) => ({
          id: x.id,
          name: x.name,
          city: x.city,
          lengthKm: Number(x.length_km ?? 0),
          lit: x.lit,
          classic: x.classic,
          skate: x.skate,
          lat: x.lat,
          lng: x.lng,
        }))
      );
      setReports((r.data as Row[]).map((x) => fromRow(x, mine)));
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem(PROFILE_KEY);
        if (p) setProfile(JSON.parse(p));
      } catch {}
      await load();
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const addReport = useCallback(
    async (input: NewReport) => {
      if (!supabase) {
        setReports((cur) => [{ ...input, id: randomId(), createdAt: Date.now(), mine: true }, ...cur]);
        return;
      }
      try {
        let uid = userId;
        if (!uid) {
          try {
            uid = await ensureSession(supabase);
          } catch (e) {
            throw stepError('kirjautuminen', e);
          }
        }
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
          .select('id,track_id,created_at,level,tags,comment,photo_paths,author_name')
          .single();
        if (insErr) throw stepError('raportin tallennus', insErr);
        setReports((cur) => [fromRow(data as Row, new Set([(data as Row).id])), ...cur]);
      } catch (e) {
        throw new Error(friendlyError(e));
      }
    },
    [userId]
  );

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
    return {
      ready,
      online: !!supabase,
      error,
      refreshing,
      tracks,
      reports: sorted,
      profile,
      reportsFor: (trackId) => sorted.filter((r) => r.trackId === trackId),
      latestFor: (trackId) => {
        const r = sorted.find((x) => x.trackId === trackId);
        return r && Date.now() - r.createdAt < FRESH_MS ? r : null;
      },
      refresh,
      addReport,
      deleteReport,
      flagReport,
      updateProfile,
    };
  }, [ready, error, refreshing, tracks, reports, profile, refresh, addReport, deleteReport, flagReport, updateProfile]);

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
