/**
 * The wire format for uploading one survey to the central server, and the
 * validation the server runs on it. Pure TypeScript (no React Native), shared
 * by the app, the Vercel function in `api/`, and the tests.
 *
 * Imports are relative, not `@/…`, because the server bundler doesn't know the alias.
 */
import type { Reading, Survey } from '../db/types';

export const SYNC_PAYLOAD_VERSION = 1;
export const MAX_READINGS_PER_SURVEY = 1000;

export type SyncPayload = {
  version: typeof SYNC_PAYLOAD_VERSION;
  survey: Survey;
  readings: Reading[];
};

export function buildSyncPayload(survey: Survey, readings: Reading[]): SyncPayload {
  return { version: SYNC_PAYLOAD_VERSION, survey, readings };
}

export class SyncValidationError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Obj = Record<string, unknown>;

function fail(message: string): never {
  throw new SyncValidationError(message);
}

function obj(value: unknown, what: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${what} must be an object.`);
  return value as Obj;
}

function uuid(o: Obj, key: string): string {
  const v = o[key];
  if (typeof v !== 'string' || !UUID.test(v)) fail(`${key} must be a UUID.`);
  return v;
}

function text(o: Obj, key: string, max: number, allowEmpty = true): string {
  const v = o[key];
  if (typeof v !== 'string' || v.length > max) fail(`${key} must be text of at most ${max} characters.`);
  if (!allowEmpty && v.trim() === '') fail(`${key} must not be empty.`);
  return v;
}

function oneOf<T extends string>(o: Obj, key: string, allowed: readonly T[]): T {
  const v = o[key];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) fail(`${key} must be one of ${allowed.join(', ')}.`);
  return v as T;
}

function num(o: Obj, key: string, { min = -Infinity, max = Infinity, nullable = false } = {}): number | null {
  const v = o[key];
  if (v === null && nullable) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    fail(`${key} must be a${nullable ? ' number or null' : ' number'} between ${min} and ${max}.`);
  }
  return v;
}

function timestamp(o: Obj, key: string): string {
  const v = o[key];
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) fail(`${key} must be an ISO date-time.`);
  return v;
}

/** Validate untrusted JSON and return a clean payload. Throws `SyncValidationError`. */
export function parseSyncPayload(body: unknown): SyncPayload {
  const root = obj(body, 'Request body');
  if (root.version !== SYNC_PAYLOAD_VERSION) fail(`Unsupported payload version (expected ${SYNC_PAYLOAD_VERSION}).`);

  const s = obj(root.survey, 'survey');
  const survey: Survey = {
    id: uuid(s, 'id'),
    name: text(s, 'name', 200, false),
    mode: oneOf(s, 'mode', ['sounding', 'profile']),
    arrayType: oneOf(s, 'arrayType', ['wenner', 'schlumberger']),
    polarityMethod: oneOf(s, 'polarityMethod', ['reversal', 'average']),
    latitude: num(s, 'latitude', { min: -90, max: 90, nullable: true }),
    longitude: num(s, 'longitude', { min: -180, max: 180, nullable: true }),
    altitudeM: num(s, 'altitudeM', { min: -1000, max: 10000, nullable: true }),
    gpsAccuracyM: num(s, 'gpsAccuracyM', { min: 0, max: 1e6, nullable: true }),
    operator: text(s, 'operator', 200),
    notes: text(s, 'notes', 5000),
    profileInnerM: num(s, 'profileInnerM', { min: 0, max: 1e5, nullable: true }),
    profileOuterM: num(s, 'profileOuterM', { min: 0, max: 1e5, nullable: true }),
    profileStepM: num(s, 'profileStepM', { min: 0, max: 1e5, nullable: true }),
    createdAt: timestamp(s, 'createdAt'),
    updatedAt: timestamp(s, 'updatedAt'),
  };

  if (!Array.isArray(root.readings)) fail('readings must be a list.');
  if (root.readings.length > MAX_READINGS_PER_SURVEY) fail(`At most ${MAX_READINGS_PER_SURVEY} readings per survey.`);

  const seen = new Set<string>();
  const readings: Reading[] = root.readings.map((item, i) => {
    const r = obj(item, `readings[${i}]`);
    const reading: Reading = {
      id: uuid(r, 'id'),
      surveyId: uuid(r, 'surveyId'),
      seq: num(r, 'seq', { min: 1, max: 1e6 }) as number,
      positionM: num(r, 'positionM', { min: -1e6, max: 1e6, nullable: true }),
      innerM: num(r, 'innerM', { min: 0, max: 1e5 }) as number,
      outerM: num(r, 'outerM', { min: 0, max: 1e5 }) as number,
      v1: num(r, 'v1', { min: -1e6, max: 1e6, nullable: true }),
      i1: num(r, 'i1', { min: -1e6, max: 1e6, nullable: true }),
      v2: num(r, 'v2', { min: -1e6, max: 1e6, nullable: true }),
      i2: num(r, 'i2', { min: -1e6, max: 1e6, nullable: true }),
      vUnit: oneOf(r, 'vUnit', ['V', 'mV']),
      iUnit: oneOf(r, 'iUnit', ['A', 'mA']),
      source: oneOf(r, 'source', ['manual', 'pi']),
      note: text(r, 'note', 2000),
      createdAt: timestamp(r, 'createdAt'),
      updatedAt: timestamp(r, 'updatedAt'),
    };
    if (reading.surveyId !== survey.id) fail(`readings[${i}] belongs to a different survey.`);
    if (!Number.isInteger(reading.seq)) fail(`readings[${i}].seq must be a whole number.`);
    if (seen.has(reading.id)) fail(`readings[${i}] repeats an id.`);
    seen.add(reading.id);
    return reading;
  });

  return { version: SYNC_PAYLOAD_VERSION, survey, readings };
}

/**
 * Turn what the user typed into the upload URL, or explain why it can't be used.
 * The API key travels in a header, so only https is accepted (http only for local testing).
 */
export function syncEndpoint(serverUrl: string): { url: string } | { error: string } {
  const typed = serverUrl.trim();
  if (!typed) return { error: 'Enter the server address in Upload settings first.' };
  const withScheme = /^https?:\/\//i.test(typed) ? typed : `https://${typed}`;
  // Plain regex rather than `URL`: React Native's URL support has historically been incomplete.
  const match = /^(https?):\/\/([^/\s?#@]+)/i.exec(withScheme);
  if (!match) return { error: 'That server address is not a valid web address.' };
  const scheme = match[1].toLowerCase();
  const host = match[2].toLowerCase();
  const hostname = host.replace(/:\d+$/, '');
  if (!/^[a-z0-9.-]+$/.test(hostname)) return { error: 'That server address is not a valid web address.' };
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  if (scheme !== 'https' && !local) return { error: 'The server address must start with https://.' };
  return { url: `${scheme}://${host}/api/sync` };
}
