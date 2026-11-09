import { nextProfilePosition, nextSoundingGeometry, soundingPlan } from '@/lib/plans';
import { formatSig, fromSI, lengthFromSI, lengthToSI, parseDecimal, toSI, toggleSign } from '@/lib/units';

describe('parseDecimal', () => {
  it.each([
    ['12.5', 12.5],
    ['12,5', 12.5],
    [' -0.03 ', -0.03],
    ['−4', -4],
    ['+7', 7],
    ['.5', 0.5],
    ['3.', 3],
  ])('reads %p as %p', (text, expected) => {
    expect(parseDecimal(text)).toBe(expected);
  });

  it.each(['', '-', '.', 'abc', '1.2.3', '1e3', '12 mV'])('rejects %p', (text) => {
    expect(parseDecimal(text)).toBeNull();
  });
});

describe('toggleSign', () => {
  it('adds and removes a leading minus', () => {
    expect(toggleSign('12')).toBe('-12');
    expect(toggleSign('-12')).toBe('12');
    expect(toggleSign('')).toBe('-');
    expect(toggleSign('+3')).toBe('-3');
  });
});

describe('unit conversion', () => {
  it('round-trips without floating-point noise', () => {
    expect(toSI(12.3, 'mV')).toBe(0.0123);
    expect(fromSI(0.0123, 'mV')).toBe(12.3);
    expect(toSI(250, 'mA')).toBe(0.25);
    expect(toSI(1.5, 'V')).toBe(1.5);
  });
});

describe('formatSig', () => {
  it.each([
    [123.456, '123'],
    [0.012345, '0.0123'],
    [1234.5, '1235'],
    [5, '5.00'],
    [0, '0'],
    [null, '—'],
  ])('formats %p as %p', (n, expected) => {
    expect(formatSig(n, 3)).toBe(expected);
  });
});

describe('spacing plans', () => {
  it('keeps Wenner at AB = 3a', () => {
    for (const g of soundingPlan('wenner')) expect(g.outerM).toBeCloseTo(3 * g.innerM, 10);
  });

  it('keeps Schlumberger MN at or below AB/5 and widening', () => {
    const plan = soundingPlan('schlumberger');
    for (const g of plan) expect(g.innerM).toBeLessThanOrEqual(g.outerM / 5);
    for (let k = 1; k < plan.length; k++) expect(plan[k].outerM).toBeGreaterThan(plan[k - 1].outerM);
  });

  it('suggests the first step wider than anything measured', () => {
    expect(nextSoundingGeometry('schlumberger', [])).toEqual({ innerM: 0.5, outerM: 3 });
    expect(nextSoundingGeometry('schlumberger', [{ innerM: 0.5, outerM: 20 }])).toEqual({ innerM: 2, outerM: 24 });
    expect(nextSoundingGeometry('wenner', [{ innerM: 2, outerM: 6 }])).toEqual({ innerM: 3, outerM: 9 });
    expect(nextSoundingGeometry('wenner', [{ innerM: 100, outerM: 300 }])).toBeNull();
  });

  it('steps along a profile line', () => {
    expect(nextProfilePosition([], 5)).toBe(0);
    expect(nextProfilePosition([0, 5, 10], 5)).toBe(15);
  });
});

describe('length units', () => {
  it('converts feet to metres with 0.3048 and back', () => {
    expect(lengthToSI(100, 'ft')).toBeCloseTo(30.48, 10);
    expect(lengthToSI(5, 'm')).toBe(5);
    expect(lengthFromSI(30.48, 'ft')).toBe(100);
    expect(lengthFromSI(5, 'm')).toBe(5);
  });
});
