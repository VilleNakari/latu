import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, SectionTitle, StatusPill } from '../../src/components/ui';
import { useStore } from '../../src/data/store';
import { PRIVACY_URL } from '../../src/config';
import { colors, fonts } from '../../src/theme';
import { useApproxLocation } from '../../src/useLocation';
import { distanceKm, km, timeAgo } from '../../src/utils';

const FILTERS = ['Kaikki', 'Valaistut', 'Perinteinen', 'Vapaa'] as const;
type Filter = (typeof FILTERS)[number];

export default function TracksScreen() {
  const insets = useSafeAreaInsets();
  const { tracks, latestFor, reportsFor, refresh, refreshing, error } = useStore();
  const loc = useApproxLocation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('Kaikki');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q))
      .filter((t) => (filter === 'Valaistut' ? t.lit : filter === 'Perinteinen' ? t.classic : filter === 'Vapaa' ? t.skate : true))
      .map((t) => ({ track: t, dist: loc ? distanceKm(loc, t) : null, latest: latestFor(t.id) }))
      .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0) || (b.latest?.createdAt ?? 0) - (a.latest?.createdAt ?? 0));
  }, [tracks, query, filter, loc, latestFor]);

  const [featured, ...rest] = list;
  const todayCount = (id: string) => reportsFor(id).filter((r) => Date.now() - r.createdAt < 24 * 3600 * 1000).length;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="triangle" size={22} color={colors.ink} />
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
          accessibilityLabel="Hae latua"
          returnKeyType="search"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((f) => (
          <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      {featured ? (
        <Pressable style={styles.featured} onPress={() => router.push(`/latu/${featured.track.id}`)} accessibilityRole="button">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.eyebrow}>{featured.dist != null ? `Lähin latu · ${km(featured.dist)}` : 'Suosittu latu'}</Text>
              <Text style={styles.featuredTitle}>{featured.track.name}</Text>
            </View>
            <StatusPill level={featured.latest?.level ?? null} />
          </View>
          <View style={styles.statsRow}>
            <Stat label="Päivitetty" value={featured.latest ? timeAgo(featured.latest.createdAt) : '–'} />
            <Stat label="Pituus" value={km(featured.track.lengthKm)} />
            <Stat label="Raportit" value={`${todayCount(featured.track.id)} tänään`} />
          </View>
        </Pressable>
      ) : (
        <Text style={{ fontFamily: fonts.regular, color: colors.muted }}>Ei latuja haulla.</Text>
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
            Muut ladut
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
                    {dist != null ? `${km(dist)} · ` : `${track.city} · `}
                    {latest ? `päivitetty ${timeAgo(latest.createdAt)}` : 'ei tuoreita raportteja'}
                  </Text>
                </View>
                <StatusPill level={latest?.level ?? null} />
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link" style={styles.privacy}>
        <Feather name="shield" size={14} color={colors.muted} />
        <Text style={styles.privacyText}>Tietosuoja · emme kerää nimeä emmekä sijaintia</Text>
      </Pressable>
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
  featured: { backgroundColor: colors.ink, borderRadius: 22, padding: 20 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.accentOnDark },
  featuredTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.surface },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.darkLine },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FFF0D6', padding: 12, borderRadius: 12 },
  errorText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: '#7A4A00' },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
  privacyText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accent },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: '#E1E7EE', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 64 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  rowMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
