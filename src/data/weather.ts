/**
 * Sää Ilmatieteen laitoksen avoimesta datasta (CC BY 4.0, lähde mainittava).
 * Haetaan suoraan puhelimesta, ei vaadi API-avainta. Tulos välimuistiin 30 min ajaksi.
 */

export interface Weather {
  /** Lämpötila nyt (°C). */
  temp: number;
  /** Tuulen nopeus (m/s). */
  wind: number | null;
  /** Huomisaamun (klo 7 Suomen aikaa) lämpötila, jos saatavilla. */
  tomorrowMorning: number | null;
  /** Alin ja ylin lämpötila seuraavan 24 h aikana. */
  min24: number;
  max24: number;
}

const URL =
  'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature' +
  '&storedquery_id=fmi::forecast::edited::weather::scandinavia::point::simple' +
  '&parameters=temperature,windspeedms&timestep=60';

const cache = new Map<string, { at: number; data: Weather }>();
const TTL = 30 * 60 * 1000;

function helsinkiHour(d: Date): number {
  // Suomen aika: UTC+2 talvella, UTC+3 kesällä. Riittävä tarkkuus aamun valintaan.
  const month = d.getUTCMonth();
  const offset = month >= 3 && month <= 9 ? 3 : 2;
  return (d.getUTCHours() + offset) % 24;
}

export async function fetchWeather(lat: number, lng: number): Promise<Weather> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const res = await fetch(`${URL}&latlon=${lat.toFixed(4)},${lng.toFixed(4)}`);
  if (!res.ok) throw new Error(`Säätietojen haku epäonnistui (${res.status})`);
  const xml = await res.text();

  const re =
    /<BsWfs:Time>([^<]+)<\/BsWfs:Time>\s*<BsWfs:ParameterName>([^<]+)<\/BsWfs:ParameterName>\s*<BsWfs:ParameterValue>([^<]+)<\/BsWfs:ParameterValue>/g;
  const temps: { t: Date; v: number }[] = [];
  const winds: { t: Date; v: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const v = parseFloat(m[3]);
    if (!Number.isFinite(v)) continue;
    const item = { t: new Date(m[1]), v };
    if (m[2] === 'temperature') temps.push(item);
    else if (m[2] === 'windspeedms') winds.push(item);
  }
  if (!temps.length) throw new Error('Säätietoja ei saatu');

  const now = Date.now();
  const next24 = temps.filter((x) => x.t.getTime() <= now + 24 * 3600 * 1000);
  const tomorrow = new Date(now + 24 * 3600 * 1000);
  const morning = temps.find(
    (x) => x.t.getUTCDate() === tomorrow.getUTCDate() && helsinkiHour(x.t) === 7
  );

  const data: Weather = {
    temp: temps[0].v,
    wind: winds[0]?.v ?? null,
    tomorrowMorning: morning?.v ?? null,
    min24: Math.min(...next24.map((x) => x.v)),
    max24: Math.max(...next24.map((x) => x.v)),
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}

export function formatTemp(t: number): string {
  const r = Math.round(t);
  return `${r < 0 ? '−' : r > 0 ? '+' : ''}${Math.abs(r)}°`;
}
