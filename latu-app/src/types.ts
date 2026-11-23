export type Level = 1 | 2 | 3 | 4;

export interface Track {
  id: string;
  name: string;
  city: string;
  lengthKm: number;
  lit: boolean;
  classic: boolean;
  skate: boolean;
  lat: number;
  lng: number;
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
