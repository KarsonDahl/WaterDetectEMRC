import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyChange } from '@/db/live';
import type { Reading, ReadingInput, Survey, SurveyInput, SurveySummary } from '@/db/types';

// Column lists alias snake_case columns to the camelCase TypeScript types.
const SURVEY_COLUMNS = `
  s.id, s.name, s.mode, s.array_type AS arrayType, s.polarity_method AS polarityMethod,
  s.latitude, s.longitude, s.altitude_m AS altitudeM, s.gps_accuracy_m AS gpsAccuracyM,
  s.operator, s.notes,
  s.profile_inner_m AS profileInnerM, s.profile_outer_m AS profileOuterM, s.profile_step_m AS profileStepM,
  s.created_at AS createdAt, s.updated_at AS updatedAt`;

const READING_COLUMNS = `
  r.id, r.survey_id AS surveyId, r.seq, r.position_m AS positionM,
  r.inner_m AS innerM, r.outer_m AS outerM,
  r.v1, r.i1, r.v2, r.i2, r.v_unit AS vUnit, r.i_unit AS iUnit,
  r.source, r.note, r.created_at AS createdAt, r.updated_at AS updatedAt`;

const now = () => new Date().toISOString();

// ── Surveys ────────────────────────────────────────────────────────────────

export function listSurveys(db: SQLiteDatabase): Promise<SurveySummary[]> {
  return db.getAllAsync<SurveySummary>(`
    SELECT ${SURVEY_COLUMNS},
           COUNT(r.id) AS readingCount,
           MAX(r.updated_at) AS lastReadingAt
    FROM survey s
    LEFT JOIN reading r ON r.survey_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC`);
}

export function getSurvey(db: SQLiteDatabase, id: string): Promise<Survey | null> {
  return db.getFirstAsync<Survey>(`SELECT ${SURVEY_COLUMNS} FROM survey s WHERE s.id = ?`, id);
}

/** Settings from the most recent survey, used to prefill a new one. */
export function getLatestSurvey(db: SQLiteDatabase): Promise<Survey | null> {
  return db.getFirstAsync<Survey>(`SELECT ${SURVEY_COLUMNS} FROM survey s ORDER BY s.created_at DESC LIMIT 1`);
}

export async function createSurvey(db: SQLiteDatabase, input: SurveyInput): Promise<string> {
  const id = randomUUID();
  const ts = now();
  await db.runAsync(
    `INSERT INTO survey (
       id, name, mode, array_type, polarity_method, latitude, longitude, altitude_m, gps_accuracy_m,
       operator, notes, profile_inner_m, profile_outer_m, profile_step_m, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ...surveyValues(input),
    ts,
    ts,
  );
  notifyChange();
  return id;
}

export async function updateSurvey(db: SQLiteDatabase, id: string, input: SurveyInput): Promise<void> {
  await db.runAsync(
    `UPDATE survey SET
       name = ?, mode = ?, array_type = ?, polarity_method = ?, latitude = ?, longitude = ?,
       altitude_m = ?, gps_accuracy_m = ?, operator = ?, notes = ?,
       profile_inner_m = ?, profile_outer_m = ?, profile_step_m = ?, updated_at = ?
     WHERE id = ?`,
    ...surveyValues(input),
    now(),
    id,
  );
  notifyChange();
}

export async function deleteSurvey(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM survey WHERE id = ?`, id);
  notifyChange();
}

function surveyValues(s: SurveyInput) {
  return [
    s.name.trim(),
    s.mode,
    s.arrayType,
    s.polarityMethod,
    s.latitude,
    s.longitude,
    s.altitudeM,
    s.gpsAccuracyM,
    s.operator.trim(),
    s.notes.trim(),
    s.profileInnerM,
    s.profileOuterM,
    s.profileStepM,
  ] as const;
}

// ── Readings ───────────────────────────────────────────────────────────────

export function listReadings(db: SQLiteDatabase, surveyId: string): Promise<Reading[]> {
  return db.getAllAsync<Reading>(
    `SELECT ${READING_COLUMNS} FROM reading r WHERE r.survey_id = ? ORDER BY r.seq`,
    surveyId,
  );
}

export function getReading(db: SQLiteDatabase, id: string): Promise<Reading | null> {
  return db.getFirstAsync<Reading>(`SELECT ${READING_COLUMNS} FROM reading r WHERE r.id = ?`, id);
}

export async function createReading(db: SQLiteDatabase, surveyId: string, input: ReadingInput): Promise<string> {
  const id = randomUUID();
  const ts = now();
  await db.runAsync(
    `INSERT INTO reading (
       id, survey_id, seq, position_m, inner_m, outer_m, v1, i1, v2, i2,
       v_unit, i_unit, source, note, created_at, updated_at)
     VALUES (?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM reading WHERE survey_id = ?),
             ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    surveyId,
    surveyId,
    ...readingValues(input),
    ts,
    ts,
  );
  notifyChange();
  return id;
}

export async function updateReading(db: SQLiteDatabase, id: string, input: ReadingInput): Promise<void> {
  await db.runAsync(
    `UPDATE reading SET
       position_m = ?, inner_m = ?, outer_m = ?, v1 = ?, i1 = ?, v2 = ?, i2 = ?,
       v_unit = ?, i_unit = ?, source = ?, note = ?, updated_at = ?
     WHERE id = ?`,
    ...readingValues(input),
    now(),
    id,
  );
  notifyChange();
}

export async function deleteReading(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM reading WHERE id = ?`, id);
  notifyChange();
}

function readingValues(r: ReadingInput) {
  return [
    r.positionM,
    r.innerM,
    r.outerM,
    r.v1,
    r.i1,
    r.v2,
    r.i2,
    r.vUnit,
    r.iUnit,
    r.source,
    r.note.trim(),
  ] as const;
}

// ── Export ─────────────────────────────────────────────────────────────────

export async function loadSurveysWithReadings(
  db: SQLiteDatabase,
  surveyId?: string,
): Promise<{ survey: Survey; readings: Reading[] }[]> {
  const surveys = surveyId
    ? await db.getAllAsync<Survey>(`SELECT ${SURVEY_COLUMNS} FROM survey s WHERE s.id = ?`, surveyId)
    : await db.getAllAsync<Survey>(`SELECT ${SURVEY_COLUMNS} FROM survey s ORDER BY s.created_at`);
  return Promise.all(surveys.map(async (survey) => ({ survey, readings: await listReadings(db, survey.id) })));
}
