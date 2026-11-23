import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, StatusPill } from '../../src/components/ui';
import { displayName, useStore } from '../../src/data/store';
import { colors, fonts, levels, unknownLevel } from '../../src/theme';
import { useApproxLocation } from '../../src/useLocation';
import { km, timeAgo } from '../../src/utils';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { tracks, latestFor } = useStore();
  const loc = useApproxLocation();
  const mapRef = useRef<MapView>(null);
  const [selectedId, setSelectedId] = useState(tracks[0]?.id);
  const selected = tracks.find((t) => t.id === selectedId);
  const latest = selected ? latestFor(selected.id) : null;

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

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: 60.24, longitude: 24.88, latitudeDelta: 0.35, longitudeDelta: 0.35 }}
        showsUserLocation={!!loc}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {tracks.map((t) => {
          const l = latestFor(t.id);
          const color = l ? levels[l.level].dot : unknownLevel.dot;
          const isSel = t.id === selectedId;
          return (
            <Marker
              key={t.id}
              coordinate={{ latitude: t.lat, longitude: t.lng }}
              onPress={() => setSelectedId(t.id)}
              accessibilityLabel={`${t.name}, ${l ? levels[l.level].label : unknownLevel.label}`}
              tracksViewChanges={false}
            >
              <View style={[styles.pin, { backgroundColor: color }, isSel && styles.pinSel]} />
            </Marker>
          );
        })}
      </MapView>

      <View style={[styles.legend, { top: insets.top + 12 }]}>
        {([1, 2, 3, 4] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.dot, { backgroundColor: levels[k].dot }]} />
            <Text style={styles.legendText}>{levels[k].short}</Text>
          </View>
        ))}
      </View>

      {loc && (
        <Pressable onPress={centerOnMe} style={styles.locate} accessibilityRole="button" accessibilityLabel="Keskitä omaan sijaintiin">
          <Feather name="crosshair" size={22} color={colors.accent} />
        </Pressable>
      )}

      {selected && (
        <View style={styles.sheet} {...swipeBack.panHandlers}>
          <View style={styles.handle} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>{selected.name}</Text>
              <Text style={styles.meta}>
                {km(selected.lengthKm)} · {latest ? `päivitetty ${timeAgo(latest.createdAt)}` : 'ei tuoreita raportteja'}
              </Text>
            </View>
            <StatusPill level={latest?.level ?? null} />
          </View>
          {latest?.comment ? (
            <Text style={styles.quote}>
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pin: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#FFFFFF' },
  pinSel: { width: 32, height: 32, borderRadius: 16, borderWidth: 4 },
  legend: { position: 'absolute', left: 16, flexDirection: 'row', gap: 10, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, elevation: 3, shadowColor: '#0B1726', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  legendText: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  dot: { width: 8, height: 8, borderRadius: 4 },
  locate: { position: 'absolute', right: 16, bottom: 250, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#0B1726', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, gap: 14, elevation: 8, shadowColor: '#0B1726', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  quote: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.inkSoft, backgroundColor: colors.bg, padding: 12, borderRadius: 12, overflow: 'hidden' },
});
