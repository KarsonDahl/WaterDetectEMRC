import type { Reading, Survey } from '../../db/types';
import { buildSyncPayload, MAX_READINGS_PER_SURVEY, parseSyncPayload, syncEndpoint, SyncValidationError } from '../sync-payload';

const SURVEY_ID = '11111111-1111-4111-8111-111111111111';
const READING_ID = '22222222-2222-4222-8222-222222222222';

const survey: Survey = {
  id: SURVEY_ID,
  name: 'Well site 3',
  mode: 'sounding',
  arrayType: 'schlumberger',
  polarityMethod: 'reversal',
  latitude: -1.29,
  longitude: 36.82,
  altitudeM: 1650,
  gpsAccuracyM: 5,
  operator: 'A. Operator',
  notes: '',
  profileInnerM: null,
  profileOuterM: null,
  profileStepM: null,
  createdAt: '2026-11-23T10:00:00.000Z',
  updatedAt: '2026-11-23T10:05:00.000Z',
};

const reading: Reading = {
  id: READING_ID,
  surveyId: SURVEY_ID,
  seq: 1,
  positionM: null,
  innerM: 1,
  outerM: 10,
  v1: 0.012,
  i1: 0.1,
  v2: -0.011,
  i2: -0.1,
  vUnit: 'mV',
  iUnit: 'mA',
  source: 'manual',
  note: '',
  createdAt: '2026-11-23T10:01:00.000Z',
  updatedAt: '2026-11-23T10:01:00.000Z',
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('parseSyncPayload', () => {
  it('accepts exactly what buildSyncPayload produces (after a JSON round trip)', () => {
    const payload = buildSyncPayload(survey, [reading]);
    expect(parseSyncPayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });

  it('accepts a survey with no readings', () => {
    expect(parseSyncPayload(clone(buildSyncPayload(survey, []))).readings).toEqual([]);
  });

  it('drops unknown fields instead of passing them through', () => {
    const body: any = clone(buildSyncPayload(survey, [reading]));
    body.survey.isAdmin = true;
    body.readings[0].sql = 'DROP TABLE survey';
    body.extra = 1;
    const parsed: any = parseSyncPayload(body);
    expect(parsed.extra).toBeUndefined();
    expect(parsed.survey.isAdmin).toBeUndefined();
    expect(parsed.readings[0].sql).toBeUndefined();
  });

  it.each([
    ['null body', null],
    ['an array', []],
    ['a string', 'hello'],
    ['wrong version', { version: 2, survey, readings: [] }],
    ['missing survey', { version: 1, readings: [] }],
    ['missing readings', { version: 1, survey }],
  ])('rejects %s', (_, body) => {
    expect(() => parseSyncPayload(body)).toThrow(SyncValidationError);
  });

  it.each([
    ['a non-UUID survey id', (b: any) => (b.survey.id = 'abc')],
    ['an empty name', (b: any) => (b.survey.name = '   ')],
    ['an unknown mode', (b: any) => (b.survey.mode = 'drilling')],
    ['latitude out of range', (b: any) => (b.survey.latitude = 91)],
    ['a string where a number belongs', (b: any) => (b.survey.altitudeM = '1650')],
    ['a missing required number', (b: any) => (b.readings[0].innerM = null)],
    ['a bad timestamp', (b: any) => (b.survey.createdAt = 'yesterday')],
    ['a reading for another survey', (b: any) => (b.readings[0].surveyId = '33333333-3333-4333-8333-333333333333')],
    ['a fractional seq', (b: any) => (b.readings[0].seq = 1.5)],
    ['an unknown unit', (b: any) => (b.readings[0].vUnit = 'kV')],
    ['a repeated reading id', (b: any) => b.readings.push(clone(b.readings[0]))],
    ['a very long note', (b: any) => (b.readings[0].note = 'x'.repeat(2001))],
  ])('rejects %s', (_, mutate) => {
    const body = clone(buildSyncPayload(survey, [reading]));
    mutate(body);
    expect(() => parseSyncPayload(body)).toThrow(SyncValidationError);
  });

  it('rejects too many readings', () => {
    const readings = Array.from({ length: MAX_READINGS_PER_SURVEY + 1 }, (_, i) => ({
      ...reading,
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      seq: i + 1,
    }));
    expect(() => parseSyncPayload(clone(buildSyncPayload(survey, readings)))).toThrow(/At most/);
  });
});

describe('syncEndpoint', () => {
  it('builds the endpoint from a bare host or a full https URL', () => {
    expect(syncEndpoint('water-detection-delta.vercel.app')).toEqual({ url: 'https://water-detection-delta.vercel.app/api/sync' });
    expect(syncEndpoint(' https://example.com/ ')).toEqual({ url: 'https://example.com/api/sync' });
  });

  it('allows plain http only for localhost', () => {
    expect(syncEndpoint('http://localhost:3000')).toEqual({ url: 'http://localhost:3000/api/sync' });
    expect(syncEndpoint('http://example.com')).toHaveProperty('error');
  });

  it('explains empty or invalid input', () => {
    expect(syncEndpoint('')).toHaveProperty('error');
    expect(syncEndpoint('https://')).toHaveProperty('error');
  });
});
