import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

/** Latu-logo: kolmio (latu ja mäki) + jäänsininen kaari. */
export function Logo({ size = 28, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M3 21 L14 6 L25 21" stroke={dark ? '#FFFFFF' : colors.ink} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M7 25 C11 20 17 20 21 25" stroke={dark ? colors.accentOnDark : colors.accent} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
