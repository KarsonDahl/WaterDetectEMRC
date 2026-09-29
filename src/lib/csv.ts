/**
 * Flat CSV export: one row per reading, survey columns repeated on each row.
 * Opens directly in Excel and imports cleanly into a database later. Surveys
 * with no readings still get one row so nothing is silently dropped.
 */

import type { Reading, Survey } from '@/db/types';
import { computeReading } from '@/lib/resistivity';

type Cell = string | number | boolean | null | undefined;

const COLUMNS = [
  'survey_id',
  'survey_name',
  'mode',
  'array_type',
  'polarity_method',
  'latitude',
  'longitude',
  'altitude_m',
  'gps_accuracy_m',
  'operator',
  'survey_notes',
  'survey_created_at',
  'reading_id',
  'seq',
  'position_m',
  'mn_m',
  'ab_m',
  'ab_half_m',
  'v1_V',
  'i1_A',
  'v2_V',
  'i2_A',
  'entered_v_unit',
  'entered_i_unit',
  'k_m',
  'resistance_ohm',
  'rho_a_ohm_m',
  'sp_V',
  'approx_depth_m',
  'reversed',
  'warnings',
  'reading_note',
  'source',
  'reading_created_at',
  'reading_updated_at',
] as const;

type Row = Record<(typeof COLUMNS)[number], Cell>;

function surveyCells(s: Survey) {
  return {
    survey_id: s.id,
    survey_name: s.name,
    mode: s.mode,
    array_type: s.arrayType,
    polarity_method: s.polarityMethod,
    latitude: s.latitude,
    longitude: s.longitude,
    altitude_m: s.altitudeM,
    gps_accuracy_m: s.gpsAccuracyM,
    operator: s.operator,
    survey_notes: s.notes,
    survey_created_at: s.createdAt,
  };
}

function readingCells(s: Survey, r: Reading) {
  const result = computeReading({ ...r, arrayType: s.arrayType, method: s.polarityMethod });
  return {
    reading_id: r.id,
    seq: r.seq,
    position_m: r.positionM,
    mn_m: r.innerM,
    ab_m: r.outerM,
    ab_half_m: r.outerM / 2,
    v1_V: r.v1,
    i1_A: r.i1,
    v2_V: r.v2,
    i2_A: r.i2,
    entered_v_unit: r.vUnit,
    entered_i_unit: r.iUnit,
    k_m: result.k,
    resistance_ohm: result.resistance,
    rho_a_ohm_m: result.rhoA,
    sp_V: result.sp,
    approx_depth_m: result.depthM,
    reversed: result.reversed,
    warnings: result.warnings.map((w) => w.code).join(' '),
    reading_note: r.note,
    source: r.source,
    reading_created_at: r.createdAt,
    reading_updated_at: r.updatedAt,
  };
}

export function buildCsv(data: { survey: Survey; readings: Reading[] }[]): string {
  const rows: Partial<Row>[] = data.flatMap(({ survey, readings }) =>
    readings.length === 0
      ? [surveyCells(survey)]
      : readings.map((r) => ({ ...surveyCells(survey), ...readingCells(survey, r) })),
  );
  const lines = [COLUMNS.join(','), ...rows.map((row) => COLUMNS.map((c) => escapeCell(row[c])).join(','))];
  // BOM so Excel reads accented notes as UTF-8; CRLF per RFC 4180.
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export function escapeCell(value: Cell): string {
  if (value == null) return '';
  const text = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportFileName(label: string, date = new Date()): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const stamp = date.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  return `waterdetect_${slug || 'export'}_${stamp}.csv`;
}
