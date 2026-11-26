import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCareLine } from '../../src/components/Care';
import { Button, StatusPill } from '../../src/components/ui';
import { displayName, trackLines, useStore } from '../../src/data/store';
import { colors, fonts, levels, unknownLevel } from '../../src/theme';
import type { Track } from '../../src/types';
import { useApproxLocation } from '../../src/useLocation';
import { km } from '../../src/utils';

const HELSINKI: Region = { latitude: 60.22, longitude: 24.92, latitudeDelta: 0.3, longitudeDelta: 0.3 };
/** Kun karttaa on loitonnettu tätä enemmän, latuja ei haeta (liikaa piirrettävää). */
const MAX_DELTA = 1.6;
const NEUTRAL = '#3E4C5C';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { latestFor, loadBbox, canUse, plus } = useStore();
  const careLine = useCareLine();
  const loc = useApproxLocation();
  const mapRef = useRef<MapView>(null);
  const [visible, setVisible] = useState<Track[]>([]);
  const [selected, setSelected] = useState<Track | null>(null);
  const [loading, setLoading] = useState(false);
  const [tooFar, setTooFar] = useState(false);
  const centered = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorsOn = canUse('mapColors');
  const latest = selected ? latestFor(selected.id) : null;

  const fetchRegion = useCallback(
    (r: Region) => {
      if (timer.current) clearTimeout(timer.current);
      if (r.latitudeDelta > MAX_DELTA) {
        setTooFar(true);
        return;
      }
      setTooFar(false);
      timer.current = setTimeout(async () => {
        setLoading(true);
        const list = await loadBbox({
          minLng: r.longitude - r.longitudeDelta / 2,
          maxLng: r.longitude + r.longitudeDelta / 2,
          minLat: r.latitude - r.latitudeDelta / 2,
          maxLat: r.latitude + r.latitudeDelta / 2,
        });
        setVisible(list);
        setLoading(false);
      }, 400);
    },
    [loadBbox]
  );

  // Keskitetään kerran käyttäjän sijaintiin, kun se saadaan.
  useEffect(() => {
    if (loc && !centered.current) {
      centered.current = true;
      mapRef.current?.animateToRegion({ latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.25, longitudeDelta: 0.25 }, 500);
    }
  }, [loc]);

  useEffect(() => {
    fetchRegion(HELSINKI);
  }, [fetchRegion]);

  // Pyyhkäisy oikealle alapaneelin päällä vie takaisin Ladut-listaan.
  const swipeBack = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dx > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dx > 60) router.navigate('/');
        },
      }),
    []
  );

  const centerOnMe = () => {
    if (loc) mapRef.current?.animateToRegion({ latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 }, 400);
  };

  const colorFor = (t: Track) => {
    if (!colorsOn) return NEUTRAL;
    const l = latestFor(t.id);
    return l ? levels[l.level].dot : unknownLevel.dot;
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={HELSINKI}
        onRegionChangeComplete={fetchRegion}
        showsUserLocation={!!loc}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {visible.map((t) => {
          const lines = trackLines(t.geometry);
          const isSel = t.id === selected?.id;
          const color = colorFor(t);
          if (!lines.length) {
            return (
              <Marker key={t.id} coordinate={{ latitude: t.lat, longitude: t.lng }} onPress={() => setSelected(t)} tracksViewChanges={false}>
                <View style={[styles.pin, { backgroundColor: color }, isSel && styles.pinSel]} />
              </Marker>
            );
          }
          return lines.map((line, i) => (
            <Polyline
              key={`${t.id}-${i}${isSel ? '-sel' : ''}`}
              coordinates={line.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
              strokeColor={isSel ? colors.accent : color}
              strokeWidth={isSel ? 6 : 4}
              lineCap="round"
              lineJoin="round"
              tappable
              onPress={() => setSelected(t)}
              zIndex={isSel ? 2 : 1}
            />
          ));
        })}
      </MapView>

      <View style={[styles.legend, { top: insets.top + 12 }]}>
        {colorsOn ? (
          <>
            {([1, 2, 3, 4] as const).map((k) => (
              <View key={k} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: levels[k].dot }]} />
                <Text style={styles.legendText}>{levels[k].short}</Text>
              </View>
            ))}
            {!plus.mapColorsRequiresPlus && <Text style={styles.plus}>Latu+</Text>}
          </>
        ) : (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: NEUTRAL }]} />
              <Text style={styles.legendText}>Ladut</Text>
            </View>
            <Text style={[styles.plus, { marginLeft: 'auto' }]}>Kuntovärit Latu+</Text>
          </>
        )}
        {loading && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 'auto' }} />}
      </View>

      {tooFar && (
        <View style={[styles.toast, { top: insets.top + 60 }]}>
          <Text style={styles.toastText}>Lähennä karttaa nähdäksesi ladut</Text>
        </View>
      )}

      {loc && (
        <Pressable onPress={centerOnMe} style={[styles.locate, { bottom: selected ? 250 : 120 }]} accessibilityRole="button" accessibilityLabel="Keskitä omaan sijaintiin">
          <Feather name="crosshair" size={22} color={colors.accent} />
        </Pressable>
      )}

      <View style={styles.sheet} {...swipeBack.panHandlers}>
        <View style={styles.handle} />
        {selected ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.title}>{selected.name}</Text>
                <Text style={styles.meta}>
                  {[selected.city, selected.lengthKm ? km(selected.lengthKm) : null, careLine(selected.id)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <StatusPill level={latest?.level ?? null} />
            </View>
            {latest?.comment ? (
              <Text style={styles.quote} numberOfLines={2}>
                ”{latest.comment}” <Text style={{ color: colors.muted }}>– {displayName(latest)}</Text>
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Näytä latu" variant="dark" style={{ flex: 1 }} onPress={() => router.push(`/latu/${selected.id}`)} />
              <Button
                label="Raportoi"
                variant="outline"
                style={{ flex: 1 }}
                icon={<Feather name="camera" size={18} color={colors.ink} />}
                onPress={() => router.push(`/raportoi/${selected.id}`)}
              />
            </View>
          </>
        ) : (
          <Text style={styles.meta}>Napauta latua kartalla nähdäksesi sen kunnon.</Text>
        )}
      </View>
    </View>
  );
}

const shadow = { elevation: 3, shadowColor: '#0B1726', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  pin: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#FFFFFF' },
  pinSel: { width: 26, height: 26, borderRadius: 13, borderWidth: 4 },
  legend: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, ...shadow },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  swatch: { width: 14, height: 4, borderRadius: 2 },
  plus: { fontFamily: fonts.bold, fontSize: 10, color: '#FFFFFF', backgroundColor: colors.ink, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  toastText: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },
  locate: { position: 'absolute', right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, gap: 14, elevation: 8, shadowColor: '#0B1726', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  quote: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft, backgroundColor: colors.bg, padding: 12, borderRadius: 12, overflow: 'hidden' },
});
