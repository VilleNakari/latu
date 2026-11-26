export type Level = 1 | 2 | 3 | 4;

/** Ladun reittiviiva (GeoJSON, yksinkertaistettu). */
export type TrackGeometry =
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'MultiLineString'; coordinates: [number, number][][] }
  | { type: 'GeometryCollection'; geometries: TrackGeometry[] }
  | { type: string; coordinates?: unknown; geometries?: unknown };

export interface Track {
  id: string;
  name: string;
  city: string;
  lengthKm: number;
  lit: boolean;
  classic: boolean;
  skate: boolean;
  /** Piste ladulla (nasta ja etäisyys). */
  lat: number;
  lng: number;
  geometry?: TrackGeometry | null;
  /** Etäisyys käyttäjästä, jos tiedossa. */
  distanceKm?: number | null;
}

export interface Report {
  id: string;
  trackId: string;
  createdAt: number;
  level: Level;
  tags: string[];
  comment: string;
  /** Kuvien osoitteet (julkinen URL tai paikallinen tiedosto testitilassa). */
  photos: string[];
  /** null = julkaistu anonyymisti. */
  authorName: string | null;
  /** Onko raportti tämän laitteen tekemä. Tunnistetta ei näytetä muille. */
  mine: boolean;
}

export interface Profile {
  nickname: string;
  /** Oletus uusille raporteille: viimeisin valinta muistetaan. */
  defaultAnonymous: boolean;
}

export interface NewReport {
  trackId: string;
  level: Level;
  tags: string[];
  comment: string;
  /** Paikalliset, metatiedoista puhdistetut kuvatiedostot. */
  photos: string[];
  authorName: string | null;
}

/** Latu+-kytkimet Supabasen app_settings-taulusta. false = ominaisuus kaikille. */
export interface PlusSettings {
  mapColorsRequiresPlus: boolean;
  weatherRequiresPlus: boolean;
  notice: string;
}
