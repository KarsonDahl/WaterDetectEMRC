import {
  approxDepth,
  computeReading,
  geometricFactor,
  geometryWarnings,
  soundingSpacing,
  type ReadingInput,
} from '@/lib/resistivity';

const codes = (input: ReadingInput) => computeReading(input).warnings.map((w) => w.code);

/**
 * Synthetic readings: true ground resistance R, current magnitude I, and a
 * steady self-potential SP added to both voltages. `lead` = −1 models the
 * voltmeter leads connected the other way round.
 */
function synth({ R, I1, I2 = I1, SP, lead = 1 }: { R: number; I1: number; I2?: number; SP: number; lead?: 1 | -1 }) {
  return { v1: lead * R * I1 + SP, i1: I1, v2: -lead * R * I2 + SP, i2: I2 };
}

describe('geometricFactor', () => {
  it('uses K = π ((AB/2)² − (MN/2)²) / MN for Schlumberger', () => {
    expect(geometricFactor({ innerM: 1, outerM: 20 })).toBeCloseTo((Math.PI * (10 ** 2 - 0.5 ** 2)) / 1, 10);
  });

  it('reduces to 2πa for Wenner', () => {
    expect(geometricFactor({ innerM: 2, outerM: 6 })).toBeCloseTo(2 * Math.PI * 2, 10);
  });

  it('matches the Schlumberger form π(L² − l²)/(2l)', () => {
    const L = 10; // AB/2
    const l = 0.5; // MN/2
    expect(geometricFactor({ innerM: 2 * l, outerM: 2 * L })).toBeCloseTo((Math.PI * (L * L - l * l)) / (2 * l), 10);
  });

  it('rejects impossible layouts', () => {
    expect(geometricFactor({ innerM: 0, outerM: 6 })).toBeNull();
    expect(geometricFactor({ innerM: 6, outerM: 6 })).toBeNull();
    expect(geometricFactor({ innerM: 8, outerM: 6 })).toBeNull();
    expect(geometricFactor({ innerM: NaN, outerM: 6 })).toBeNull();
  });
});

describe('computeReading — reversal method', () => {
  const base = { arrayType: 'wenner' as const, method: 'reversal' as const, innerM: 2, outerM: 6 };

  it('cancels ground self-potential exactly', () => {
    const result = computeReading({ ...base, ...synth({ R: 5, I1: 0.01, SP: 0.02 }) });
    expect(result.resistance).toBeCloseTo(5, 10);
    expect(result.sp).toBeCloseTo(0.02, 10);
    expect(result.rhoA).toBeCloseTo(2 * Math.PI * 2 * 5, 8);
    expect(result.reversed).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('does not care which way round the voltmeter leads are', () => {
    const result = computeReading({ ...base, ...synth({ R: 5, I1: 0.01, SP: 0.02, lead: -1 }) });
    expect(result.resistance).toBeCloseTo(5, 10);
    expect(result.sp).toBeCloseTo(0.02, 10);
  });

  it('stays exact when the two currents differ slightly', () => {
    const result = computeReading({ ...base, ...synth({ R: 5, I1: 0.01, I2: 0.0095, SP: -0.013 }) });
    expect(result.resistance).toBeCloseTo(5, 10);
    expect(result.sp).toBeCloseTo(-0.013, 10);
  });

  it('ignores the sign of the current readings', () => {
    const { v1, i1, v2, i2 } = synth({ R: 5, I1: 0.01, SP: 0.02 });
    const result = computeReading({ ...base, v1, i1, v2, i2: -i2 });
    expect(result.resistance).toBeCloseTo(5, 10);
  });

  it('flags readings whose voltages have the same sign (missing minus sign)', () => {
    expect(codes({ ...base, v1: 0.07, i1: 0.01, v2: 0.03, i2: 0.01 })).toContain('same-sign');
  });

  it('flags currents that differ by more than 10%', () => {
    expect(codes({ ...base, ...synth({ R: 5, I1: 0.01, I2: 0.0085, SP: 0 }) })).toContain('current-mismatch');
  });
});

describe('computeReading — average method', () => {
  it('averages the two |V|/|I| ratios and reports no SP', () => {
    const result = computeReading({
      arrayType: 'wenner',
      method: 'average',
      innerM: 2,
      outerM: 6,
      v1: 0.07,
      i1: 0.01,
      v2: 0.03,
      i2: 0.01,
    });
    expect(result.resistance).toBeCloseTo((7 + 3) / 2, 10);
    expect(result.sp).toBeNull();
    expect(result.warnings).toEqual([]);
  });
});

describe('computeReading — incomplete and bad input', () => {
  const base = {
    arrayType: 'schlumberger' as const,
    method: 'reversal' as const,
    innerM: 1,
    outerM: 20,
    v1: null,
    i1: null,
    v2: null,
    i2: null,
  };

  it('gives a provisional result from switch position 1 alone', () => {
    const result = computeReading({ ...base, v1: -0.05, i1: 0.01 });
    expect(result.resistance).toBeCloseTo(5, 10);
    expect(result.reversed).toBe(false);
    expect(result.warnings.map((w) => w.code)).toEqual(['no-reversal']);
  });

  it('returns no result with nothing entered', () => {
    const result = computeReading(base);
    expect(result.rhoA).toBeNull();
    expect(result.k).not.toBeNull();
  });

  it('errors on zero current', () => {
    const result = computeReading({ ...base, v1: 0.05, i1: 0 });
    expect(result.rhoA).toBeNull();
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'zero-current', level: 'error' }));
  });

  it('errors on impossible geometry', () => {
    const result = computeReading({ ...base, innerM: 20, outerM: 1, v1: 0.05, i1: 0.01 });
    expect(result.rhoA).toBeNull();
    expect(result.warnings[0]).toMatchObject({ code: 'geometry-invalid', level: 'error' });
  });
});

describe('geometryWarnings', () => {
  it('warns when a Wenner layout is not AB = 3·MN', () => {
    expect(geometryWarnings('wenner', { innerM: 2, outerM: 6 })).toEqual([]);
    expect(geometryWarnings('wenner', { innerM: 2, outerM: 8 })[0].code).toBe('wenner-geometry');
  });

  it('warns when a Schlumberger MN is wider than AB/5', () => {
    expect(geometryWarnings('schlumberger', { innerM: 2, outerM: 10 })).toEqual([]);
    expect(geometryWarnings('schlumberger', { innerM: 3, outerM: 10 })[0].code).toBe('schlumberger-geometry');
  });
});

describe('plot helpers', () => {
  it('uses a for Wenner and AB/2 for Schlumberger', () => {
    expect(soundingSpacing('wenner', { innerM: 3, outerM: 9 })).toBe(3);
    expect(soundingSpacing('schlumberger', { innerM: 1, outerM: 30 })).toBe(15);
  });

  it('estimates depth of investigation from AB', () => {
    expect(approxDepth('wenner', { innerM: 10, outerM: 30 })).toBeCloseTo(5.19, 2);
    expect(approxDepth('schlumberger', { innerM: 2, outerM: 100 })).toBeCloseTo(19, 5);
  });
});
