import type { CurrentUnit, VoltageUnit } from '@/lib/units';
import type { ArrayType, PolarityMethod, SurveyMode } from '@/lib/resistivity';

/** One place where the crew sets up: a sounding (fixed centre) or a profile line. */
export type Survey = {
  id: string;
  name: string;
  mode: SurveyMode;
  arrayType: ArrayType;
  polarityMethod: PolarityMethod;
  latitude: number | null;
  longitude: number | null;
  altitudeM: number | null;
  gpsAccuracyM: number | null;
  operator: string;
  notes: string;
  /** Profile mode only: fixed MN, AB and distance between stations. */
  profileInnerM: number | null;
  profileOuterM: number | null;
  profileStepM: number | null;
  createdAt: string;
  updatedAt: string;
};

export type SurveyInput = Omit<Survey, 'id' | 'createdAt' | 'updatedAt'>;

export type SurveySummary = Survey & {
  readingCount: number;
  lastReadingAt: string | null;
};

/**
 * One stake spacing and its two DPDT-switch readings. Stored in SI (V, A, m);
 * `vUnit`/`iUnit` remember what the operator typed in, for editing.
 * Derived values (K, R, ρa) are not stored — see `computeReading`.
 */
export type Reading = {
  id: string;
  surveyId: string;
  seq: number;
  /** Profile mode: distance of the array centre along the line. */
  positionM: number | null;
  innerM: number;
  outerM: number;
  v1: number | null;
  i1: number | null;
  v2: number | null;
  i2: number | null;
  vUnit: VoltageUnit;
  iUnit: CurrentUnit;
  source: 'manual' | 'pi';
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ReadingInput = Omit<Reading, 'id' | 'surveyId' | 'seq' | 'createdAt' | 'updatedAt'>;
