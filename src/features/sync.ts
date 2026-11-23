import type { SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

import { loadSurveysWithReadings } from '@/db/repo';
import { buildSyncPayload, syncEndpoint } from '@/lib/sync-payload';

/**
 * One-way upload of a survey to the central server. Strictly opt-in: nothing
 * else in the app depends on this, and a failure never loses or blocks data.
 */

const SERVER_URL_KEY = 'sync.serverUrl';
const API_KEY_KEY = 'sync.apiKey';
const lastUploadKey = (surveyId: string) => `sync.lastUpload.${surveyId}`;
const TIMEOUT_MS = 30_000;

export type SyncSettings = { serverUrl: string; apiKey: string };

export async function loadSyncSettings(): Promise<SyncSettings> {
  const [serverUrl, apiKey] = await Promise.all([
    Storage.getItemAsync(SERVER_URL_KEY),
    Storage.getItemAsync(API_KEY_KEY),
  ]);
  return {
    // The web demo is served from the same place as the API, so it needs no address.
    serverUrl: serverUrl ?? (Platform.OS === 'web' ? window.location.origin : ''),
    apiKey: apiKey ?? '',
  };
}

export async function saveSyncSettings(settings: SyncSettings): Promise<void> {
  await Storage.setItemAsync(SERVER_URL_KEY, settings.serverUrl.trim());
  await Storage.setItemAsync(API_KEY_KEY, settings.apiKey.trim());
}

/** When this survey was last uploaded from this device, or null. */
export function getLastUpload(surveyId: string): Promise<string | null> {
  return Storage.getItemAsync(lastUploadKey(surveyId));
}

export async function uploadSurvey(db: SQLiteDatabase, surveyId: string): Promise<{ readings: number }> {
  const settings = await loadSyncSettings();
  const endpoint = syncEndpoint(settings.serverUrl);
  if ('error' in endpoint) throw new Error(endpoint.error);
  if (!settings.apiKey) throw new Error('Enter the API key in Upload settings first.');

  const [data] = await loadSurveysWithReadings(db, surveyId);
  if (!data) throw new Error('This survey no longer exists.');
  const payload = buildSyncPayload(data.survey, data.readings);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    throw new Error(
      'Could not reach the server. You may be offline. Your data is safe on this phone; try again when you have signal.',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.json().then((b: { error?: string }) => b.error, () => undefined);
    if (response.status === 401) throw new Error('The server did not accept the API key. Check it in Upload settings.');
    throw new Error(detail ?? `The server returned an error (${response.status}).`);
  }

  await Storage.setItemAsync(lastUploadKey(surveyId), new Date().toISOString());
  return { readings: data.readings.length };
}
