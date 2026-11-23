import type { Level } from './types';

export const colors = {
  bg: '#F3F6F9',
  surface: '#FFFFFF',
  ink: '#0B1726',
  inkSoft: '#24313F',
  muted: '#4A5868',
  line: '#D5DDE6',
  lineSoft: '#EEF2F6',
  accent: '#1F4FD8',
  accentSoft: '#E1EAFF',
  accentOnDark: '#A9C4FF',
  darkMuted: '#A7B4C4',
  darkLine: '#2A3A50',
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
};

/** Kuntoluokat. Värit eroavat myös vaaleudeltaan, ja niiden rinnalla näytetään aina teksti. */
export const levels: Record<Level, { label: string; short: string; dot: string; bg: string; fg: string }> = {
  1: { label: 'Erinomainen', short: 'Erinom.', dot: '#0B3D91', bg: '#DCE8FF', fg: '#0B3D91' },
  2: { label: 'Hyvä', short: 'Hyvä', dot: '#4C9BF0', bg: '#E1F0FF', fg: '#13549E' },
  3: { label: 'Kohtalainen', short: 'Kohtal.', dot: '#E89A2C', bg: '#FFF0D6', fg: '#7A4A00' },
  4: { label: 'Huono', short: 'Huono', dot: '#D9541E', bg: '#FFE3D8', fg: '#9A3410' },
};

export const unknownLevel = { label: 'Ei tuoreita tietoja', dot: '#8C99A8', bg: '#EEF2F6', fg: '#4A5868' };

export const reportTags = ['Perinteinen', 'Vapaa', 'Pakkaslumi', 'Uusi lumi', 'Märkä', 'Jäinen', 'Pohjattu tänään', 'Valot pois'];
