import type { Reading, Survey } from '@/db/types';
import { inferProfileStep } from '@/lib/plans';
import { describeLayout, suggestNextReading } from '@/lib/survey';

const survey: Survey = {
  id: 's',
  name: 'Line 1',
  mode: 'profile',
  arrayType: 'wenner',
  polarityMethod: 'reversal',
  latitude: null,
  longitude: null,
  altitudeM: null,
  gpsAccuracyM: null,
  operator: '',
  notes: '',
  profileInnerM: null,
  profileOuterM: null,
  profileStepM: null,
  createdAt: '2026-11-23T10:00:00.000Z',
  updatedAt: '2026-11-23T10:00:00.000Z',
};

const reading = (seq: number, positionM: number | null, innerM = 2, outerM = 6): Reading => ({
  id: `r${seq}`,
  surveyId: 's',
  seq,
  positionM,
  innerM,
  outerM,
  v1: 0.01,
  i1: 0.1,
  v2: -0.01,
  i2: -0.1,
  vUnit: 'V',
  iUnit: 'A',
  source: 'manual',
  note: '',
  createdAt: '2026-11-23T10:00:00.000Z',
  updatedAt: '2026-11-23T10:00:00.000Z',
});

describe('inferProfileStep', () => {
  it('needs two positions that advance', () => {
    expect(inferProfileStep([])).toBeNull();
    expect(inferProfileStep([0])).toBeNull();
    expect(inferProfileStep([0, 5])).toBe(5);
    expect(inferProfileStep([0, 5, 15])).toBe(10);
    expect(inferProfileStep([10, 5])).toBeNull();
    expect(inferProfileStep([5, 5])).toBeNull();
  });
});

describe('suggestNextReading for a profile', () => {
  it('repeats the last spacing and steps by the interval the crew is using', () => {
    const readings = [reading(1, 0), reading(2, 5), reading(3, 10)];
    expect(suggestNextReading(survey, readings)).toEqual({ innerM: 2, outerM: 6, positionM: 15 });
  });

  it('keeps the spacing but leaves the position to the crew after one reading', () => {
    expect(suggestNextReading(survey, [reading(1, 0, 4, 12)])).toEqual({ innerM: 4, outerM: 12, positionM: null });
    expect(describeLayout(survey, { innerM: 4, outerM: 12, positionM: null })).toMatch(/along the line/);
  });

  it('falls back to the old profile settings on a survey made before the type was derived', () => {
    const legacy = { ...survey, profileInnerM: 1, profileOuterM: 3, profileStepM: 2 };
    expect(suggestNextReading(legacy, [])).toEqual({ innerM: 1, outerM: 3, positionM: 0 });
    expect(suggestNextReading(legacy, [reading(1, 0, 1, 3)])).toEqual({ innerM: 1, outerM: 3, positionM: 2 });
  });

  it('suggests nothing for a profile with no readings and no old settings', () => {
    expect(suggestNextReading(survey, [])).toBeNull();
  });
});
