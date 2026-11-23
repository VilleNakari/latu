import React from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, levels, unknownLevel } from '../theme';
import type { Level } from '../types';

export function StatusPill({ level, small }: { level: Level | null; small?: boolean }) {
  const l = level ? levels[level] : unknownLevel;
  return (
    <View style={[styles.pill, { backgroundColor: l.bg }, small && styles.pillSmall]}>
      <View style={[styles.dot, { backgroundColor: l.dot }]} />
      <Text style={[styles.pillText, { color: l.fg }, small && { fontSize: 11 }]}>{l.label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.surface : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  style,
  disabled,
  ...rest
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'dark' | 'outline';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
} & Omit<PressableProps, 'style' | 'children'>) {
  const bg = variant === 'primary' ? colors.accent : variant === 'dark' ? colors.ink : 'transparent';
  const fg = variant === 'outline' ? colors.ink : colors.surface;
  return (
    <Pressable
      {...rest}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.ink },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  pillSmall: { paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontFamily: fonts.semibold, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', borderWidth: 1 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipOff: { backgroundColor: colors.surface, borderColor: colors.line },
  chipText: { fontFamily: fonts.medium, fontSize: 14 },
  button: { height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  label: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
});
