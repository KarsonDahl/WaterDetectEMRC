/**
 * Unit handling and number parsing/formatting.
 *
 * The database stores SI values only (V, A, m). The UI lets operators type in
 * whatever range the multimeter is on (mV or V, mA or A) and converts here.
 */

export type VoltageUnit = 'V' | 'mV';
export type CurrentUnit = 'A' | 'mA';
/** Distance unit the operator works in. Storage is always metres. */
export type LengthUnit = 'm' | 'ft';

export const FEET_TO_METRES = 0.3048;

/** Typed distance (in `unit`) → metres. */
export function lengthToSI(value: number, unit: LengthUnit): number {
  return cleanFloat(unit === 'ft' ? value * FEET_TO_METRES : value);
}

/** Metres → distance in `unit`, rounded to 2 decimals for display/editing. */
export function lengthFromSI(value: number, unit: LengthUnit): number {
  return unit === 'ft' ? Math.round((value / FEET_TO_METRES) * 100) / 100 : cleanFloat(value);
}

const FACTOR: Record<VoltageUnit | CurrentUnit, number> = {
  V: 1,
  mV: 1e-3,
  A: 1,
  mA: 1e-3,
};

/** Convert a value typed in `unit` to SI. */
export function toSI(value: number, unit: VoltageUnit | CurrentUnit): number {
  return cleanFloat(value * FACTOR[unit]);
}

/** Convert an SI value to `unit` for display/editing. */
export function fromSI(value: number, unit: VoltageUnit | CurrentUnit): number {
  return cleanFloat(value / FACTOR[unit]);
}

/** Strip binary floating-point noise, e.g. 0.1 * 3 → 0.3 rather than 0.30000000000000004. */
export function cleanFloat(n: number): number {
  return Number(n.toPrecision(12));
}

/**
 * Parse what an operator typed. Accepts a comma as the decimal separator
 * (common on French-locale phones) and a leading + or −. Returns null for
 * empty or unparseable input.
 */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
  if (normalized === '' || normalized === '-' || normalized === '+' || normalized === '.') return null;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  return Number(normalized);
}

/** Flip the sign of a typed number without disturbing how it was typed. */
export function toggleSign(text: string): string {
  const t = text.trim();
  if (t.startsWith('-') || t.startsWith('−')) return t.slice(1);
  if (t.startsWith('+')) return '-' + t.slice(1);
  return '-' + t;
}

/** Number → string suitable for putting back into a text field. */
export function toInputText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return String(cleanFloat(n));
}

/**
 * Format with roughly `sig` significant figures, never using exponent
 * notation (field crews read these off a phone in the sun).
 */
export function formatSig(n: number | null | undefined, sig = 3): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const magnitude = Math.floor(Math.log10(Math.abs(n)));
  const decimals = Math.min(Math.max(0, sig - 1 - magnitude), 10);
  return n.toFixed(decimals);
}
