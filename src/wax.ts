/**
 * Suuntaa antava pitovoitelusuositus lämpötilan ja raporttien lumitiedon perusteella.
 * Geneeriset värit, ei tuotemerkkejä. Taulukkoa voi hioa palautteen mukaan.
 */

export interface WaxAdvice {
  label: string;
  color: string;
  /** Lyhyt peruste, esim. "−10…−3 °C, uusi tai pakkaslumi". */
  reason: string;
  /** Asteikon kohta 0–4 (vihreä, sininen, violetti, punainen, klisteri). */
  index: number;
}

export const WAX_SCALE = [
  { label: 'Vihreä', color: '#2F9E6B' },
  { label: 'Sininen', color: '#2E6BE6' },
  { label: 'Violetti', color: '#7B4FD8' },
  { label: 'Punainen', color: '#D9412E' },
  { label: 'Klisteri', color: '#8A6A3D' },
];

/** Raporttien tageista päätellään, onko lumi uutta vai vanhaa/jäistä. */
export function waxAdvice(temp: number, recentTags: string[]): WaxAdvice {
  const old = recentTags.some((t) => t === 'Jäinen' || t === 'Märkä');
  const snow = old ? 'vanha tai jäinen lumi' : 'uusi tai pakkaslumi';
  const pick = (i: number, range: string, extra = ''): WaxAdvice => ({
    label: WAX_SCALE[i].label + extra,
    color: WAX_SCALE[i].color,
    reason: `${range}, ${snow}`,
    index: i,
  });

  if (temp < -10) return old ? pick(1, 'alle −10 °C', ' + pohjaklisteri') : pick(0, 'alle −10 °C');
  if (temp < -3) return old ? pick(1, '−10…−3 °C', ' / violetti') : pick(1, '−10…−3 °C');
  if (temp <= 0) return old ? pick(4, '−3…0 °C', ' / violetti') : pick(2, '−3…0 °C');
  return old ? pick(4, 'yli 0 °C') : pick(3, 'yli 0 °C');
}
