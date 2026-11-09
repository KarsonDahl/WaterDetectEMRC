/**
 * Glue between stored surveys/readings and the pure math: which formula
 * settings apply, what goes on the chart, and what to suggest next.
 */

import type { Reading, Survey } from '@/db/types';
import { nextProfilePosition, nextSoundingGeometry } from '@/lib/plans';
import { lengthFromSI } from '@/lib/units';
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
  const metres = survey.mode === 'sounding' ? soundingSpacing(survey.arrayType, r) : r.positionM;
  return metres == null ? null : lengthFromSI(metres, survey.lengthUnit);
}

export function chartXLabel(survey: Survey): string {
  const label = survey.mode === 'sounding' ? soundingSpacingLabel(survey.arrayType) : 'Position';
  return `${label} (${survey.lengthUnit})`;
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
    if (survey.profileInnerM == null || survey.profileOuterM == null || survey.profileStepM == null) return null;
    const positions = readings.map((r) => r.positionM).filter((p): p is number => p != null);
    return {
      innerM: survey.profileInnerM,
      outerM: survey.profileOuterM,
      positionM: nextProfilePosition(positions, survey.profileStepM),
    };
  }
  const next = nextSoundingGeometry(survey.arrayType, readings);
  return next ? { ...next, positionM: null } : null;
}

export function describeLayout(survey: Survey, g: NextReading): string {
  const u = survey.lengthUnit;
  const d = (m: number) => lengthFromSI(m, u);
  const spacing =
    survey.arrayType === 'wenner' ? `a = ${d(g.innerM)} ${u}` : `AB/2 = ${d(g.outerM / 2)} ${u}, MN = ${d(g.innerM)} ${u}`;
  return survey.mode === 'profile' && g.positionM != null ? `station at ${d(g.positionM)} ${u}` : spacing;
}
