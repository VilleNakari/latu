import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../data/store';
import { fetchWeather, formatTemp, type Weather } from '../data/weather';
import { colors, fonts } from '../theme';
import type { Track } from '../types';
import { WAX_SCALE, waxAdvice } from '../wax';

/** Lämpötila ja voitelusuositus ladun sivulle (Latu+-ominaisuus, nyt kaikille). */
export function WeatherCard({ track }: { track: Track }) {
  const { canUse, reportsFor } = useStore();
  const allowed = canUse('weather');
  const [w, setW] = useState<Weather | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    setFailed(false);
    fetchWeather(track.lat, track.lng)
      .then((d) => alive && setW(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [allowed, track.lat, track.lng]);

  if (!allowed) {
    return (
      <View style={[styles.card, styles.locked]}>
        <Feather name="lock" size={18} color={colors.muted} />
        <Text style={styles.lockedText}>Lämpötila ja voitelusuositus ovat Latu+-ominaisuuksia.</Text>
      </View>
    );
  }

  if (failed) return null;
  if (!w) {
    return (
      <View style={[styles.card, { alignItems: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const recentTags = reportsFor(track.id)
    .filter((r) => Date.now() - r.createdAt < 48 * 3600 * 1000)
    .flatMap((r) => r.tags);
  const wax = waxAdvice(w.temp, recentTags);
  const snow = recentTags.find((t) => ['Pakkaslumi', 'Uusi lumi', 'Märkä', 'Jäinen'].includes(t));

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.weather}>
        <Text style={styles.temp}>{formatTemp(w.temp)}</Text>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.weatherMain}>
            {[snow, w.wind != null ? `tuuli ${Math.round(w.wind)} m/s` : null].filter(Boolean).join(' · ') || 'Sää nyt'}
          </Text>
          <Text style={styles.weatherSub}>
            {w.tomorrowMorning != null
              ? `Huomenna aamulla ${formatTemp(w.tomorrowMorning)}C`
              : `Vuorokauden aikana ${formatTemp(w.min24)}…${formatTemp(w.max24)}C`}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.label}>Voitelusuositus</Text>
          <Text style={styles.plus}>Latu+</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View style={[styles.waxSwatch, { backgroundColor: wax.color }]} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.waxTitle}>Pito: {wax.label.toLowerCase()}</Text>
            <Text style={styles.small}>{wax.reason}</Text>
          </View>
        </View>
        <View style={styles.scale} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {WAX_SCALE.map((s, i) => (
            <View key={s.label} style={[styles.scaleItem, { backgroundColor: s.color }, i === wax.index && styles.scaleSel]} />
          ))}
        </View>
        <Text style={styles.small}>Suuntaa antava · Lämpötila: Ilmatieteen laitos</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  weather: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.ink, borderRadius: 18, padding: 16 },
  temp: { fontFamily: fonts.bold, fontSize: 40, letterSpacing: -1, color: '#FFFFFF' },
  weatherMain: { fontFamily: fonts.semibold, fontSize: 15, color: '#FFFFFF' },
  weatherSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.darkMuted },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E1E7EE', borderRadius: 18, padding: 16, gap: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  plus: { fontFamily: fonts.bold, fontSize: 10, color: '#FFFFFF', backgroundColor: colors.ink, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  waxSwatch: { width: 44, height: 44, borderRadius: 12 },
  waxTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  scale: { flexDirection: 'row', gap: 6 },
  scaleItem: { flex: 1, height: 8, borderRadius: 4 },
  scaleSel: { borderWidth: 2, borderColor: colors.ink, height: 12, marginTop: -2 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lockedText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
