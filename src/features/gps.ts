import * as Location from 'expo-location';

/**
 * GPS works without cell service, but a cold start with no internet (no
 * assisted-GPS data) can take a minute or more under open sky.
 */
const FIX_TIMEOUT_MS = 90_000;
/** Only trust a cached fix if it's this fresh — an old one may be from another site. */
const MAX_CACHED_AGE_MS = 2 * 60_000;

export type GpsFix = {
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  accuracyM: number | null;
};

export async function captureGps(): Promise<GpsFix> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission was denied. You can type the coordinates in by hand.');
  }

  try {
    return toFix(await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })));
  } catch {
    const cached = await Location.getLastKnownPositionAsync({ maxAge: MAX_CACHED_AGE_MS });
    if (cached) return toFix(cached);
    throw new Error('No GPS fix yet. Move into open sky, wait a minute, and try again.');
  }
}

function toFix({ coords }: Location.LocationObject): GpsFix {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    altitudeM: coords.altitude ?? null,
    accuracyM: coords.accuracy ?? null,
  };
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('GPS timeout')), FIX_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
