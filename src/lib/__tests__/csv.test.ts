import type { Reading, Survey } from '@/db/types';
import { buildCsv, escapeCell, exportFileName } from '@/lib/csv';

const survey: Survey = {
  id: 'survey-1',
  name: 'Well site, north',
  mode: 'sounding',
  arrayType: 'wenner',
  polarityMethod: 'reversal',
  lengthUnit: 'm',
  latitude: -1.2921,
  longitude: 36.8219,
  altitudeM: 1650,
  gpsAccuracyM: 8,
  operator: 'Amina',
  notes: 'Dry season; "red" soil',
  profileInnerM: null,
  profileOuterM: null,
  profileStepM: null,
  createdAt: '2026-09-28T08:00:00.000Z',
  updatedAt: '2026-09-28T08:00:00.000Z',
};

const reading: Reading = {
  id: 'reading-1',
  surveyId: 'survey-1',
  seq: 1,
  positionM: null,
  innerM: 2,
  outerM: 6,
  v1: 0.07,
  i1: 0.01,
  v2: -0.03,
  i2: 0.01,
  vUnit: 'mV',
  iUnit: 'mA',
  source: 'manual',
  note: '',
  createdAt: '2026-09-28T08:05:00.000Z',
  updatedAt: '2026-09-28T08:05:00.000Z',
};

/** Minimal RFC 4180 parser for single-line records (enough for these fixtures). */
function parseLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let k = 0; k < line.length; k++) {
    const c = line[k];
    if (quoted && c === '"' && line[k + 1] === '"') {
      cell += '"';
      k++;
    } else if (c === '"') {
      quoted = !quoted;
    } else if (c === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += c;
    }
  }
  return [...cells, cell];
}

function parse(csv: string) {
  const [header, ...lines] = csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n');
  const columns = parseLine(header);
  return lines.map((line) => Object.fromEntries(parseLine(line).map((v, k) => [columns[k], v])));
}

describe('buildCsv', () => {
  it('writes one row per reading with raw and computed values', () => {
    const rows = parse(buildCsv([{ survey, readings: [reading] }]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      survey_name: 'Well site, north',
      survey_notes: 'Dry season; "red" soil',
      mn_m: '2',
      ab_m: '6',
      v1_V: '0.07',
      v2_V: '-0.03',
      reversed: 'true',
      warnings: '',
    });
    expect(Number(rows[0].resistance_ohm)).toBeCloseTo(5, 10);
    expect(Number(rows[0].rho_a_ohm_m)).toBeCloseTo(2 * Math.PI * 2 * 5, 8);
  });

  it('keeps surveys that have no readings yet', () => {
    const rows = parse(buildCsv([{ survey, readings: [] }]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ survey_id: 'survey-1', reading_id: '' });
  });

  it('starts with a BOM so Excel reads UTF-8', () => {
    expect(buildCsv([]).charCodeAt(0)).toBe(0xfeff);
  });
});

describe('escapeCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(escapeCell('plain')).toBe('plain');
    expect(escapeCell('a,b')).toBe('"a,b"');
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCell('line\nbreak')).toBe('"line\nbreak"');
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(0)).toBe('0');
  });
});

describe('exportFileName', () => {
  it('builds a safe, dated file name', () => {
    expect(exportFileName('Well site, north!', new Date('2026-09-28T14:05:00Z'))).toBe(
      'waterdetect_well-site-north_20260928-1405.csv',
    );
  });
});
