/**
 * Resistivity math for a symmetric four-electrode array.
 *
 * Electrode naming follows the usual convention:
 *   A ─── M ─── N ─── B
 *   A, B = outer (current) stakes; M, N = inner (potential) stakes.
 *   AB   = full span between the outer stakes; MN = span between the inner stakes.
 *
 * All inputs are SI (metres, volts, amps). This module is pure — no React
 * Native imports — so it can be unit-tested and ported to the Raspberry Pi.
 */

export type ArrayType = 'wenner' | 'schlumberger';
export type SurveyMode = 'sounding' | 'profile';

/**
 * How the two DPDT-switch readings are combined into one resistance.
 *
 * - `reversal`: voltages are entered with the sign the meter shows.
 *   R = |V₁ − V₂| / (|I₁| + |I₂|). A steady ground self-potential (SP) adds
 *   the same offset to both voltages, so it cancels exactly.
 * - `average`: magnitudes only. R = mean(|V₁|/|I₁|, |V₂|/|I₂|). Tolerates
 *   missing minus signs but only partly cancels SP.
 */
export type PolarityMethod = 'reversal' | 'average';

export type Geometry = {
  /** MN, metres */
  innerM: number;
  /** AB, metres */
  outerM: number;
};

export type ReadingInput = Geometry & {
  arrayType: ArrayType;
  method: PolarityMethod;
  /** Forward polarity (switch position 1). Volts, signed. */
  v1: number | null;
  /** Amps. Sign is ignored. */
  i1: number | null;
  /** Reversed polarity (switch position 2). Volts, signed. */
  v2: number | null;
  /** Amps. Sign is ignored. */
  i2: number | null;
};

export type WarningCode =
  | 'geometry-invalid'
  | 'wenner-geometry'
  | 'schlumberger-geometry'
  | 'zero-current'
  | 'no-reversal'
  | 'same-sign'
  | 'current-mismatch';

export type ReadingWarning = {
  code: WarningCode;
  /** `error` means no result could be computed; `warn` means check the data. */
  level: 'error' | 'warn';
  message: string;
};

export type ReadingResult = {
  /** Geometric factor K, metres. */
  k: number | null;
  /** ΔV / I after combining both polarities, ohms. */
  resistance: number | null;
  /** Apparent resistivity ρa = K · R, ohm-metres. */
  rhoA: number | null;
  /** Estimated ground self-potential, volts. Only for the `reversal` method. */
  sp: number | null;
  /** Rough median depth of investigation, metres (Edwards 1977). */
  depthM: number | null;
  /** True when both polarities were used (so SP is cancelled). */
  reversed: boolean;
  warnings: ReadingWarning[];
};

const FEET_TO_METRES = 0.3048;
const WENNER_TOLERANCE = 0.02;
const SCHLUMBERGER_MAX_MN_RATIO = 1 / 5;
const CURRENT_MISMATCH_TOLERANCE = 0.1;

/**
 * Median depth of investigation as a fraction of AB (Edwards 1977, via
 * Barker 1989). An indicator of how deep a spacing "sees", not a depth to water.
 */
const DEPTH_FACTOR: Record<ArrayType, number> = {
  wenner: 0.173,
  schlumberger: 0.19,
};

export function isValidGeometry({ innerM, outerM }: Geometry): boolean {
  return Number.isFinite(innerM) && Number.isFinite(outerM) && innerM > 0 && outerM > innerM;
}

/**
 * Geometric factor K, metres.
 *
 * - Schlumberger: K = π ((AB/2) · 0.3048)², so ρa = |ΔV/ΔI| · π · ((AB/2) · 0.3048)².
 *   The outer spacing is entered in feet; 0.3048 converts it to metres here.
 * - Otherwise (Wenner, or no array given): the general symmetric-array form
 *   K = π (AB² − MN²) / (4 · MN). Wenner (AB = 3a, MN = a) reduces to 2πa.
 */
export function geometricFactor(g: Geometry, arrayType?: ArrayType): number | null {
  if (!isValidGeometry(g)) return null;
  const { innerM: mn, outerM: ab } = g;
  if (arrayType === 'schlumberger') return Math.PI * ((ab / 2) * FEET_TO_METRES) ** 2;
  return (Math.PI * (ab * ab - mn * mn)) / (4 * mn);
}

export function approxDepth(arrayType: ArrayType, g: Geometry): number | null {
  if (!isValidGeometry(g)) return null;
  return DEPTH_FACTOR[arrayType] * g.outerM;
}

/**
 * The x-axis value for a sounding curve: `a` (= MN) for Wenner, AB/2 for
 * Schlumberger. These are the conventional axes for each array.
 */
export function soundingSpacing(arrayType: ArrayType, g: Geometry): number {
  return arrayType === 'wenner' ? g.innerM : g.outerM / 2;
}

export function soundingSpacingLabel(arrayType: ArrayType): string {
  return arrayType === 'wenner' ? 'a' : 'AB/2';
}

export function geometryWarnings(arrayType: ArrayType, g: Geometry): ReadingWarning[] {
  if (!isValidGeometry(g)) {
    return [
      {
        code: 'geometry-invalid',
        level: 'error',
        message: 'Outer span AB must be larger than inner span MN, and both above zero.',
      },
    ];
  }
  if (arrayType === 'wenner' && Math.abs(g.outerM / g.innerM - 3) > 3 * WENNER_TOLERANCE) {
    return [
      {
        code: 'wenner-geometry',
        level: 'warn',
        message: `Wenner spacing should have AB = 3 × MN (expected AB = ${round(3 * g.innerM)} m).`,
      },
    ];
  }
  if (arrayType === 'schlumberger' && g.innerM > g.outerM * SCHLUMBERGER_MAX_MN_RATIO) {
    return [
      {
        code: 'schlumberger-geometry',
        level: 'warn',
        message: `Schlumberger needs MN ≤ AB/5 (MN ≤ ${round(g.outerM / 5)} m here).`,
      },
    ];
  }
  return [];
}

type Combined = { resistance: number; sp: number | null; reversed: boolean };

function combinePolarities(input: ReadingInput, warnings: ReadingWarning[]): Combined | null {
  const { v1, i1, v2, i2, method } = input;
  const hasForward = v1 != null && i1 != null;
  const hasReverse = v2 != null && i2 != null;

  if ((hasForward && i1 === 0) || (hasReverse && i2 === 0)) {
    warnings.push({ code: 'zero-current', level: 'error', message: 'Current is zero — check the circuit.' });
    return null;
  }
  if (!hasForward) return null;

  if (!hasReverse) {
    warnings.push({
      code: 'no-reversal',
      level: 'warn',
      message: 'Reversed reading missing — result is not corrected for ground voltage.',
    });
    return { resistance: Math.abs(v1) / Math.abs(i1), sp: null, reversed: false };
  }

  const a1 = Math.abs(i1);
  const a2 = Math.abs(i2);
  if (Math.abs(a1 - a2) / Math.max(a1, a2) > CURRENT_MISMATCH_TOLERANCE) {
    warnings.push({
      code: 'current-mismatch',
      level: 'warn',
      message: 'Forward and reversed currents differ by more than 10% — check connections.',
    });
  }

  if (method === 'average') {
    return { resistance: (Math.abs(v1) / a1 + Math.abs(v2) / a2) / 2, sp: null, reversed: true };
  }

  if (v1 * v2 > 0) {
    warnings.push({
      code: 'same-sign',
      level: 'warn',
      message:
        'V₁ and V₂ have the same sign. Enter the reversed voltage with its minus sign, ' +
        'or check stake contact (very large ground voltage).',
    });
  }
  // With V₁ = s·R·|I₁| + SP and V₂ = −s·R·|I₂| + SP (s = ±1 from lead orientation),
  // V₁ − V₂ = s·R·(|I₁| + |I₂|), so SP drops out.
  const resistance = Math.abs(v1 - v2) / (a1 + a2);
  const s = Math.sign(v1 - v2) || 1;
  const sp = v1 - s * resistance * a1;
  return { resistance, sp, reversed: true };
}

export function computeReading(input: ReadingInput): ReadingResult {
  const warnings = geometryWarnings(input.arrayType, input);
  const k = geometricFactor(input, input.arrayType);
  const combined = combinePolarities(input, warnings);
  const resistance = combined?.resistance ?? null;
  return {
    k,
    resistance,
    rhoA: k != null && resistance != null ? k * resistance : null,
    sp: combined?.sp ?? null,
    depthM: approxDepth(input.arrayType, input),
    reversed: combined?.reversed ?? false,
    warnings,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
