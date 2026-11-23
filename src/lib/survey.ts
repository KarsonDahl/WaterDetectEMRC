/**
 * Glue between stored surveys/readings and the pure math: which formula
 * settings apply, what goes on the chart, and what to suggest next.
 */

import type { Reading, Survey } from '@/db/types';
import { inferProfileStep, nextProfilePosition, nextSoundingGeometry } from '@/lib/plans';
import { computeReading, soundingSpacing, soundingSpacingLabel, type Geometry, type ReadingResult } from '@/lib/resistivity';

export type ChartPoint = {
  id: string;
  x: number;
  y: number;
  /** Points sharing a group are joined by a line (e.g. one MN setting in a Schlumberger sounding). */
  group: string;
};

type Measurement = Pick<Reading, 'innerM' | 'outerM' | 'v1' | 'i1' | 'v2' | 'i2'>;

export function readingResult(survey: Survey, r: Measurement): ReadingResult {
  return computeReading({ ...r, arrayType: survey.arrayType, method: survey.polarityMethod });
}

/** Chart x value: spacing for a sounding, position along the line for a profile. */
export function chartX(survey: Survey, r: Pick<Reading, 'innerM' | 'outerM' | 'positionM'>): number | null {
  return survey.mode === 'sounding' ? soundingSpacing(survey.arrayType, r) : r.positionM;
}

export function chartXLabel(survey: Survey): string {
  return survey.mode === 'sounding' ? soundingSpacingLabel(survey.arrayType) : 'Position';
}

export function chartPoints(survey: Survey, readings: Reading[]): ChartPoint[] {
  return readings.flatMap((r) => {
    const x = chartX(survey, r);
    const y = readingResult(survey, r).rhoA;
    if (x == null || y == null) return [];
    // Schlumberger soundings change MN partway; each MN setting is its own curve segment.
    const group = survey.mode === 'sounding' && survey.arrayType === 'schlumberger' ? `mn${r.innerM}` : 'all';
    return [{ id: r.id, x, y, group }];
  });
}

export type NextReading = Geometry & { positionM: number | null };

/** Suggested stake layout for the next reading, or null if the crew must choose. */
export function suggestNextReading(survey: Survey, readings: Reading[]): NextReading | null {
  if (survey.mode === 'profile') {
    // Spacing stays fixed along a line, so repeat the last reading's. The profile_* columns
    // only matter for surveys created before the type was derived from the readings.
    const last = readings.at(-1);
    const innerM = last?.innerM ?? survey.profileInnerM;
    const outerM = last?.outerM ?? survey.profileOuterM;
    if (innerM == null || outerM == null) return null;
    const positions = readings.map((r) => r.positionM).filter((p): p is number => p != null);
    const step = inferProfileStep(positions) ?? survey.profileStepM;
    // Without a known interval the crew types the next position themselves.
    const positionM = positions.length === 0 ? 0 : step == null ? null : nextProfilePosition(positions, step);
    return { innerM, outerM, positionM };
  }
  const next = nextSoundingGeometry(survey.arrayType, readings);
  return next ? { ...next, positionM: null } : null;
}

export function describeLayout(survey: Survey, g: NextReading): string {
  const spacing =
    survey.arrayType === 'wenner' ? `a = ${g.innerM} m` : `AB/2 = ${g.outerM / 2} m, MN = ${g.innerM} m`;
  if (survey.mode !== 'profile') return spacing;
  return g.positionM == null ? 'move the array along the line' : `station at ${g.positionM} m`;
}
