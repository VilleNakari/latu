import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

/** Käyttäjän likimääräinen sijainti, jos lupa annetaan. Sijaintia ei tallenneta eikä liitetä raportteihin. */
export function useApproxLocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (alive) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return coords;
}
