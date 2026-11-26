import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { CARE_BASE, CARE_GROOMED, useStore } from '../data/store';
import { colors, fonts } from '../theme';
import { timeAgo } from '../utils';

/** "✓ Kunnostettu 40 min sitten" ja "Pohjattu eilen" ladun sivulle. */
export function CareChips({ trackId }: { trackId: string }) {
  const { lastCare } = useStore();
  const groomed = lastCare(trackId, CARE_GROOMED);
  const base = lastCare(trackId, CARE_BASE);
  if (!groomed && !base) return null;
  return (
    <View style={styles.row}>
      {groomed && (
        <View style={[styles.chip, { backgroundColor: '#DCE8FF' }]}>
          <Feather name="check" size={15} color="#0B3D91" />
          <Text style={[styles.text, { color: '#0B3D91' }]}>Kunnostettu {timeAgo(groomed.createdAt)}</Text>
        </View>
      )}
      {base && (
        <View style={[styles.chip, { backgroundColor: colors.lineSoft }]}>
          <Feather name="layers" size={14} color={colors.inkSoft} />
          <Text style={[styles.text, { color: colors.inkSoft }]}>Pohjattu {timeAgo(base.createdAt)}</Text>
        </View>
      )}
    </View>
  );
}

/** Lyhyt teksti listaan: "kunnostettu 2 h sitten" / "pohjattu eilen" / "päivitetty …". */
export function useCareLine() {
  const { lastCare, latestFor } = useStore();
  return (trackId: string) => {
    const g = lastCare(trackId, CARE_GROOMED);
    if (g) return `kunnostettu ${timeAgo(g.createdAt)}`;
    const b = lastCare(trackId, CARE_BASE);
    if (b) return `pohjattu ${timeAgo(b.createdAt)}`;
    const l = latestFor(trackId);
    return l ? `päivitetty ${timeAgo(l.createdAt)}` : 'ei tuoreita raportteja';
  };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  text: { fontFamily: fonts.semibold, fontSize: 13 },
});
