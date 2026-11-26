import type { Report, Track } from '../types';

/**
 * Esimerkkiladut prototyyppiä varten. Koordinaatit ovat likimääräisiä.
 * Tuotannossa ladut haetaan LIPAS-rajapinnasta (ks. README).
 */
export const seedTracks: Track[] = [
  { id: 'paloheina', name: 'Paloheinän valaistu latu', city: 'Helsinki', lengthKm: 7.5, lit: true, classic: true, skate: true, lat: 60.2563, lng: 24.9216 },
  { id: 'keskuspuisto', name: 'Keskuspuiston latu', city: 'Helsinki', lengthKm: 9.0, lit: true, classic: true, skate: false, lat: 60.2275, lng: 24.9198 },
  { id: 'pirttimaki', name: 'Pirttimäen kenttä', city: 'Helsinki', lengthKm: 3.8, lit: true, classic: true, skate: true, lat: 60.2539, lng: 24.9531 },
  { id: 'luukki', name: 'Luukin ulkoilualue', city: 'Espoo', lengthKm: 9.1, lit: false, classic: true, skate: true, lat: 60.3100, lng: 24.6800 },
  { id: 'laajasalo', name: 'Laajasalon latu', city: 'Helsinki', lengthKm: 4.2, lit: true, classic: true, skate: false, lat: 60.1700, lng: 25.0500 },
  { id: 'oittaa', name: 'Oittaan ulkoilualue', city: 'Espoo', lengthKm: 6.0, lit: true, classic: true, skate: true, lat: 60.2650, lng: 24.6450 },
];

const h = 60 * 60 * 1000;

export function seedReports(now = Date.now()): Report[] {
  return [
    { id: 's1', trackId: 'paloheina', createdAt: now - 0.7 * h, level: 1, tags: ['Kunnostettu', 'Perinteinen', 'Pakkaslumi'], comment: 'Tuore pohjaus, perinteisen urat terävät koko lenkin.', photos: [], authorName: 'Anna K.', mine: false },
    { id: 's2', trackId: 'paloheina', createdAt: now - 2 * h, level: 2, tags: ['Vapaa'], comment: 'Vapaan puoli vähän pehmeä mäissä, muuten hyvä.', photos: [], authorName: null, mine: false },
    { id: 's3', trackId: 'keskuspuisto', createdAt: now - 0.4 * h, level: 2, tags: ['Perinteinen'], comment: 'Hyvä pito, muutama kivi Haltialan kohdalla.', photos: [], authorName: 'Mikko V.', mine: false },
    { id: 's4', trackId: 'pirttimaki', createdAt: now - 1 * h, level: 3, tags: ['Vapaa', 'Jäinen'], comment: 'Urat osin rikki, vapaalla menee ihan ok.', photos: [], authorName: null, mine: false },
    { id: 's5', trackId: 'luukki', createdAt: now - 2.2 * h, level: 1, tags: ['Perinteinen', 'Uusi lumi'], comment: 'Metsäosuudet upeassa kunnossa.', photos: [], authorName: 'Hiihtäjä_88', mine: false },
    { id: 's6', trackId: 'laajasalo', createdAt: now - 5 * h, level: 4, tags: ['Jäinen'], comment: 'Jäinen pohja, ei pohjattu viikonlopun jälkeen.', photos: [], authorName: null, mine: false },
  ];
}
