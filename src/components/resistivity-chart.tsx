import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChartPoint } from '@/lib/survey';
import { formatSig } from '@/lib/units';

type Props = {
  points: ChartPoint[];
  /** The reading being entered, not yet saved. */
  draft?: { x: number; y: number } | null;
  xScale: 'log' | 'linear';
  xLabel: string;
  yLabel: string;
  height?: number;
};

const MARGIN = { top: 12, right: 14, bottom: 40, left: 52 };
const POINT_RADIUS = 4.5;
const HIT_RADIUS = 18;
const FONT = Fonts?.sans;
/** The chart always sits on a Card; marker rings use its color so they read as a gap. */
const SURFACE = (theme: { backgroundElement: string }) => theme.backgroundElement;

/**
 * Apparent resistivity plot. Soundings use log-log axes (the standard VES
 * curve); profiles use a linear position axis. ρa is always log — it spans
 * orders of magnitude between wet clay and dry rock.
 */
export function ResistivityChart({ points, draft, xScale, xLabel, yLabel, height = 260 }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const usable = points.filter((p) => isPlottable(p.x, xScale) && p.y > 0 && Number.isFinite(p.y));
  const usableDraft = draft && isPlottable(draft.x, xScale) && draft.y > 0 ? draft : null;
  const all = usableDraft ? [...usable, { ...usableDraft, id: 'draft', group: '' }] : usable;

  const selected = usable.find((p) => p.id === selectedId) ?? null;
  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = height - MARGIN.top - MARGIN.bottom;

  if (all.length === 0) {
    return (
      <View style={[styles.empty, { height: 120, borderColor: theme.chartGrid }]}>
        <ThemedText type="small" themeColor="textSecondary">
          The curve appears here after the first reading.
        </ThemedText>
      </View>
    );
  }

  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const xAxis = xScale === 'log' ? logAxis(xs) : linearAxis(xs);
  const yAxis = logAxis(ys);
  const sx = (v: number) => MARGIN.left + xAxis.scale(v) * plotW;
  const sy = (v: number) => MARGIN.top + (1 - yAxis.scale(v)) * plotH;

  const groups = new Map<string, ChartPoint[]>();
  for (const p of usable) groups.set(p.group, [...(groups.get(p.group) ?? []), p]);

  return (
    <View>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.headerText}>
          {selected
            ? `${xLabel} ${formatSig(selected.x, 3)} · ρa ${formatSig(selected.y, 3)} Ω·m`
            : 'Tap a point for its values'}
        </ThemedText>
        {usableDraft ? (
          <View style={styles.legend}>
            <LegendKey color={theme.chartSeries} label="Saved" />
            <LegendKey color={theme.chartDraft} label="This reading" />
          </View>
        ) : null}
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 ? (
          <Svg
            width={width}
            height={height}
            accessibilityLabel={`Apparent resistivity against ${xLabel}, ${usable.length} points`}>
            {/* Grid */}
            {xAxis.minor.map((v) => (
              <Line key={`xm${v}`} x1={sx(v)} x2={sx(v)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke={theme.chartGrid} strokeWidth={1} />
            ))}
            {yAxis.minor.map((v) => (
              <Line key={`ym${v}`} x1={MARGIN.left} x2={MARGIN.left + plotW} y1={sy(v)} y2={sy(v)} stroke={theme.chartGrid} strokeWidth={1} />
            ))}
            {/* Axes */}
            <Line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke={theme.chartAxis} strokeWidth={1} />
            <Line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={MARGIN.top + plotH} y2={MARGIN.top + plotH} stroke={theme.chartAxis} strokeWidth={1} />
            {xAxis.ticks.map((v) => (
              <SvgText key={`xt${v}`} x={sx(v)} y={MARGIN.top + plotH + 16} fontSize={11} fontFamily={FONT} fill={theme.chartMuted} textAnchor="middle">
                {tickLabel(v)}
              </SvgText>
            ))}
            {yAxis.ticks.map((v) => (
              <SvgText key={`yt${v}`} x={MARGIN.left - 6} y={sy(v) + 4} fontSize={11} fontFamily={FONT} fill={theme.chartMuted} textAnchor="end">
                {tickLabel(v)}
              </SvgText>
            ))}
            <SvgText x={MARGIN.left + plotW / 2} y={height - 6} fontSize={12} fontFamily={FONT} fill={theme.chartMuted} textAnchor="middle">
              {`${xLabel} (m)`}
            </SvgText>
            <SvgText
              x={12}
              y={MARGIN.top + plotH / 2}
              fontSize={12}
              fontFamily={FONT}
              fill={theme.chartMuted}
              textAnchor="middle"
              transform={`rotate(-90 12 ${MARGIN.top + plotH / 2})`}>
              {yLabel}
            </SvgText>

            {/* Data */}
            {[...groups.values()].map((group) => {
              const sorted = [...group].sort((a, b) => a.x - b.x);
              return sorted.length > 1 ? (
                <Polyline
                  key={`line${sorted[0].id}`}
                  points={sorted.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
                  fill="none"
                  stroke={theme.chartSeries}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null;
            })}
            {usable.map((p) => (
              <Circle
                key={p.id}
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={p.id === selectedId ? POINT_RADIUS + 2 : POINT_RADIUS}
                fill={theme.chartSeries}
                stroke={SURFACE(theme)}
                strokeWidth={2}
              />
            ))}
            {usableDraft ? (
              <Circle
                cx={sx(usableDraft.x)}
                cy={sy(usableDraft.y)}
                r={POINT_RADIUS + 2}
                fill={theme.chartDraft}
                stroke={SURFACE(theme)}
                strokeWidth={2}
              />
            ) : null}
          </Svg>
        ) : null}
        {/* Touch targets as plain views: SVG press handling is unreliable across platforms. */}
        {width > 0
          ? usable.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${xLabel} ${formatSig(p.x, 3)} metres, rho a ${formatSig(p.y, 3)} ohm metres`}
                onPress={() => setSelectedId(p.id === selectedId ? null : p.id)}
                style={[styles.hit, { left: sx(p.x) - HIT_RADIUS, top: sy(p.y) - HIT_RADIUS }]}
              />
            ))
          : null}
      </View>
    </View>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendKey}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function isPlottable(x: number, scale: 'log' | 'linear') {
  return Number.isFinite(x) && (scale === 'linear' || x > 0);
}

type Axis = { scale: (v: number) => number; ticks: number[]; minor: number[] };

/** Log axis snapped outward to 1-2-5 steps, labelled at 1-2-5 (or decades when crowded). */
export function logAxis(values: number[]): Axis {
  const min = Math.min(...values);
  const max = Math.max(...values);
  let lo = niceLogFloor(min);
  let hi = niceLogCeil(max);
  if (hi <= lo) {
    lo = niceLogFloor(min / 2);
    hi = niceLogCeil(max * 2);
  }
  const [logLo, logHi] = [Math.log10(lo), Math.log10(hi)];
  const scale = (v: number) => (Math.log10(v) - logLo) / (logHi - logLo);

  const oneTwoFive: number[] = [];
  const minor: number[] = [];
  for (let e = Math.floor(logLo); e <= Math.ceil(logHi); e++) {
    for (let m = 1; m <= 9; m++) {
      const v = cleanTick(m * 10 ** e);
      if (v < lo * 0.999 || v > hi * 1.001) continue;
      minor.push(v);
      if (m === 1 || m === 2 || m === 5) oneTwoFive.push(v);
    }
  }
  const decades = oneTwoFive.filter((v) => Number.isInteger(Math.round(Math.log10(v) * 1e6) / 1e6));
  const ticks = oneTwoFive.length <= 7 ? oneTwoFive : decades.length >= 2 ? decades : oneTwoFive;
  return { scale, ticks: withEnds(ticks, lo, hi), minor };
}

/** Linear axis with ~5 round ticks, padded so end points aren't on the frame. */
export function linearAxis(values: number[]): Axis {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1e-9) {
    min -= 1;
    max += 1;
  }
  const step = niceStep((max - min) / 5);
  const lo = Math.floor(min / step) * step - (min % step === 0 ? step / 2 : 0);
  const hi = Math.ceil(max / step) * step + (max % step === 0 ? step / 2 : 0);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(cleanTick(v));
  return { scale: (v) => (v - lo) / (hi - lo), ticks, minor: ticks };
}

function withEnds(ticks: number[], lo: number, hi: number) {
  return ticks.length >= 2 ? ticks : [lo, hi];
}

function niceLogFloor(v: number) {
  const e = Math.floor(Math.log10(v));
  const m = v / 10 ** e;
  return cleanTick((m >= 5 ? 5 : m >= 2 ? 2 : 1) * 10 ** e);
}

function niceLogCeil(v: number) {
  const e = Math.floor(Math.log10(v));
  const m = v / 10 ** e;
  return cleanTick((m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * 10 ** e);
}

function niceStep(raw: number) {
  const e = Math.floor(Math.log10(raw));
  const m = raw / 10 ** e;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * 10 ** e;
}

function cleanTick(v: number) {
  return Number(v.toPrecision(10));
}

function tickLabel(v: number) {
  if (Math.abs(v) >= 10000) return `${cleanTick(v / 1000)}k`;
  return String(cleanTick(v));
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  headerText: {
    flexShrink: 1,
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  legendKey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  hit: {
    position: 'absolute',
    width: HIT_RADIUS * 2,
    height: HIT_RADIUS * 2,
    borderRadius: HIT_RADIUS,
  },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
});
