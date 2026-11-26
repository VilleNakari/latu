import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCareLine } from '../../src/components/Care';
import { Logo } from '../../src/components/Logo';
import { Chip, SectionTitle, StatusPill } from '../../src/components/ui';
import { PRIVACY_URL } from '../../src/config';
import { CARE_GROOMED, useStore } from '../../src/data/store';
import { colors, fonts } from '../../src/theme';
import type { Track } from '../../src/types';
import { useApproxLocation } from '../../src/useLocation';
import { distanceKm, km, timeAgo } from '../../src/utils';

const FILTERS = ['Kaikki', 'Valaistut', 'Perinteinen', 'Vapaa'] as const;
type Filter = (typeof FILTERS)[number];

/** Jos sijaintia ei saada, näytetään Helsingin ladut. */
const FALLBACK = { lat: 60.1699, lng: 24.9384 };

export default function TracksScreen() {
  const insets = useSafeAreaInsets();
  const { nearby, latestFor, lastCare, reportsFor, refresh, refreshing, error, loadNearby, search, online } = useStore();
  const careLine = useCareLine();
  const loc = useApproxLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<Filter>('Kaikki');
  const [noLocation, setNoLocation] = useState(false);

  // Lähimmät ladut sijainnin mukaan (tai Helsingistä, jos sijaintia ei saada 4 sekunnissa).
  useEffect(() => {
    if (loc) {
      setNoLocation(false);
      loadNearby(loc.lat, loc.lng);
      return;
    }
    const t = setTimeout(() => {
      setNoLocation(true);
      loadNearby(FALLBACK.lat, FALLBACK.lng);
    }, 4000);
    return () => clearTimeout(t);
  }, [loc, loadNearby]);

  // Haku (viive, ettei jokaista näppäilyä haeta erikseen).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await search(q);
      setResults(r);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query, search]);

  const list = useMemo(() => {
    const base = results ?? nearby;
    return base
      .filter((t) => (filter === 'Valaistut' ? t.lit : filter === 'Perinteinen' ? t.classic : filter === 'Vapaa' ? t.skate : true))
      .map((t) => ({ track: t, dist: loc ? distanceKm(loc, t) : t.distanceKm ?? null, latest: latestFor(t.id) }));
  }, [results, nearby, filter, loc, latestFor]);

  const [featured, ...rest] = list;
  const todayCount = (id: string) => reportsFor(id).filter((r) => Date.now() - r.createdAt < 24 * 3600 * 1000).length;
  const featuredGroomed = featured ? lastCare(featured.track.id, CARE_GROOMED) : null;
  const loading = !featured && !results && online && !error;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityRole="header" accessibilityLabel="Latu">
          <Logo size={28} />
          <Text style={styles.logo}>latu</Text>
        </View>
      </View>

      <Text style={styles.h1}>Missä hiihdetään tänään?</Text>

      {error && (
        <Pressable onPress={refresh} style={styles.error} accessibilityRole="button">
          <Feather name="wifi-off" size={16} color="#7A4A00" />
          <Text style={styles.errorText}>{error} Napauta päivittääksesi.</Text>
        </Pressable>
      )}

      <View style={styles.search}>
        <Feather name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Hae latua tai kuntaa"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          accessibilityLabel="Hae latua tai kuntaa"
          returnKeyType="search"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color={colors.accent} />}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((f) => (
          <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      {noLocation && !results && (
        <Text style={styles.hint}>Näytetään Helsingin ladut. Salli sijainti asetuksista, niin näet lähimmät ladut.</Text>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
      ) : featured ? (
        <Pressable style={styles.featured} onPress={() => router.push(`/latu/${featured.track.id}`)} accessibilityRole="button">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.eyebrow}>
                {results ? 'Hakutulos' : featured.dist != null ? `Lähin latu · ${km(featured.dist)}` : 'Latu'}
              </Text>
              <Text style={styles.featuredTitle}>{featured.track.name}</Text>
              {!!featured.track.city && <Text style={styles.featuredCity}>{featured.track.city}</Text>}
            </View>
            <StatusPill level={featured.latest?.level ?? null} />
          </View>
          <View style={styles.statsRow}>
            <Stat label="Kunnostettu" value={featuredGroomed ? timeAgo(featuredGroomed.createdAt) : '–'} />
            <Stat label="Pituus" value={featured.track.lengthKm ? km(featured.track.lengthKm) : '–'} />
            <Stat label="Raportit" value={`${todayCount(featured.track.id)} tänään`} />
          </View>
        </Pressable>
      ) : (
        <Text style={styles.hint}>{results ? 'Ei latuja haulla.' : 'Ei latuja lähistöllä.'}</Text>
      )}

      {rest.length > 0 && (
        <>
          <SectionTitle
            right={
              <Link href="/kartta" style={styles.link}>
                Kartalla
              </Link>
            }
          >
            {results ? 'Muut hakutulokset' : 'Muut ladut lähellä'}
          </SectionTitle>
          <View style={styles.card}>
            {rest.map(({ track, dist, latest }, i) => (
              <Pressable
                key={track.id}
                onPress={() => router.push(`/latu/${track.id}`)}
                style={({ pressed }) => [styles.row, i < rest.length - 1 && styles.rowBorder, pressed && { backgroundColor: colors.bg }]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.rowTitle}>{track.name}</Text>
                  <Text style={styles.rowMeta}>
                    {dist != null ? `${km(dist)} · ` : track.city ? `${track.city} · ` : ''}
                    {careLine(track.id)}
                  </Text>
                </View>
                <StatusPill level={latest?.level ?? null} />
              </Pressable>
            ))}
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link" style={styles.privacy}>
          <Feather name="shield" size={14} color={colors.muted} />
          <Text style={styles.footerText}>Tietosuoja · emme kerää nimeä emmekä sijaintia</Text>
        </Pressable>
        <Text style={styles.footerText}>Latutiedot: LIPAS, Jyväskylän yliopisto · Sää: Ilmatieteen laitos</Text>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.darkMuted }}>{label}</Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.surface }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44 },
  logo: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink, letterSpacing: -0.5 },
  h1: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.ink, letterSpacing: -0.6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 14 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },
  featured: { backgroundColor: colors.ink, borderRadius: 22, padding: 20 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.accentOnDark },
  featuredTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.surface },
  featuredCity: { fontFamily: fonts.regular, fontSize: 14, color: colors.darkMuted },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.darkLine },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FFF0D6', padding: 12, borderRadius: 12 },
  errorText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: '#7A4A00' },
  footer: { alignItems: 'center', gap: 4, marginTop: 4 },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
  footerText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center' },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accent },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: '#E1E7EE', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 64 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  rowMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
