/**
 * Suggested stake spacings, so the app can tell the crew where to put the
 * stakes next. Suggestions only — every value can be overridden on entry.
 */

import type { ArrayType, Geometry } from '@/lib/resistivity';

/** Roughly log-spaced so points spread evenly on a log-log sounding curve. */
const SOUNDING_STEPS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100];

/** Wenner: a = MN, AB = 3a. */
const WENNER_PLAN: Geometry[] = SOUNDING_STEPS.map((a) => ({ innerM: a, outerM: 3 * a }));

/**
 * Schlumberger: AB/2 follows the steps; MN is widened in stages as the signal
 * gets weaker, always keeping MN ≤ AB/5.
 */
const SCHLUMBERGER_PLAN: Geometry[] = SOUNDING_STEPS.filter((half) => half >= 1.5).map((half) => ({
  innerM: half <= 10 ? 0.5 : half <= 40 ? 2 : 10,
  outerM: 2 * half,
}));

export function soundingPlan(arrayType: ArrayType): Geometry[] {
  return arrayType === 'wenner' ? WENNER_PLAN : SCHLUMBERGER_PLAN;
}

/**
 * Next suggested sounding geometry: the first planned step wider than
 * anything already measured. Null once the plan is exhausted.
 */
export function nextSoundingGeometry(arrayType: ArrayType, measured: Geometry[]): Geometry | null {
  const widest = Math.max(0, ...measured.map((g) => g.outerM));
  return soundingPlan(arrayType).find((g) => g.outerM > widest + 1e-9) ?? null;
}

/** Next station along a profile line. */
export function nextProfilePosition(positions: number[], stepM: number): number {
  if (positions.length === 0) return 0;
  return Math.max(...positions) + stepM;
}
