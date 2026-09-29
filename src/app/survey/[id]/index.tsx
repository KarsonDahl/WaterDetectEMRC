import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { HeaderLink } from '@/components/header-link';
import { Card, Screen, SectionTitle } from '@/components/layout';
import { ResistivityChart } from '@/components/resistivity-chart';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/db/live';
import { getSurvey, listReadings } from '@/db/repo';
import type { Reading, Survey } from '@/db/types';
import { showError } from '@/features/dialogs';
import { exportCsv } from '@/features/export';
import { useTheme } from '@/hooks/use-theme';
import { capitalize } from '@/lib/format';
import { chartPoints, chartX, chartXLabel, describeLayout, readingResult, suggestNextReading } from '@/lib/survey';
import { formatSig } from '@/lib/units';

export default function SurveyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { data } = useLiveQuery(
    async (db) => ({ survey: await getSurvey(db, id), readings: await listReadings(db, id) }),
    [id],
  );
  const [exporting, setExporting] = useState(false);

  if (!data) return null;
  const { survey, readings } = data;
  if (!survey) {
    return (
      <Screen>
        <ThemedText>This survey no longer exists.</ThemedText>
      </Screen>
    );
  }

  const next = suggestNextReading(survey, readings);

  async function onExport() {
    setExporting(true);
    try {
      await exportCsv(db, survey!.name, id);
    } catch (e) {
      showError('Export failed', e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: survey.name,
          headerRight: () => <HeaderLink href={{ pathname: '/survey/[id]/edit', params: { id } }} label="Edit" />,
        }}
      />
      <Screen
        footer={
          <>
            <Button title="Export CSV" variant="secondary" onPress={onExport} busy={exporting} style={styles.grow} />
            <Button
              title="Add reading"
              onPress={() => router.push({ pathname: '/survey/[id]/reading', params: { id } })}
              style={styles.grow}
            />
          </>
        }>
        <SurveySummary survey={survey} />

        <Card>
          <ResistivityChart
            points={chartPoints(survey, readings)}
            xScale={survey.mode === 'sounding' ? 'log' : 'linear'}
            xLabel={chartXLabel(survey)}
            yLabel="ρa (Ω·m)"
          />
        </Card>

        <SectionTitle detail={next ? `Next: ${describeLayout(survey, next)}` : undefined}>
          {`Readings (${readings.length})`}
        </SectionTitle>
        {readings.length > 0 ? <ReadingTable survey={survey} readings={readings} /> : null}
      </Screen>
    </>
  );
}

function SurveySummary({ survey }: { survey: Survey }) {
  const parts = [
    capitalize(survey.mode),
    capitalize(survey.arrayType),
    survey.polarityMethod === 'reversal' ? 'signed ±' : 'averaged',
  ];
  return (
    <View style={styles.summary}>
      <ThemedText type="small" themeColor="textSecondary">
        {parts.join(' · ')}
        {survey.operator ? ` · ${survey.operator}` : ''}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {survey.latitude != null && survey.longitude != null
          ? `${survey.latitude.toFixed(5)}, ${survey.longitude.toFixed(5)}` +
            (survey.gpsAccuracyM != null ? ` (±${Math.round(survey.gpsAccuracyM)} m)` : '')
          : 'No GPS location'}
      </ThemedText>
      {survey.notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          {survey.notes}
        </ThemedText>
      ) : null}
    </View>
  );
}

function ReadingTable({ survey, readings }: { survey: Survey; readings: Reading[] }) {
  const theme = useTheme();
  const sounding = survey.mode === 'sounding';
  const xLabel = chartXLabel(survey);

  return (
    <View style={[styles.table, { borderColor: theme.border }]}>
      <View style={[styles.tr, { borderBottomColor: theme.border }]}>
        <Cell header narrow>#</Cell>
        <Cell header>{`${xLabel} (m)`}</Cell>
        <Cell header>{sounding ? 'MN (m)' : 'AB (m)'}</Cell>
        <Cell header wide>ρa (Ω·m)</Cell>
        <Cell header narrow> </Cell>
      </View>
      {readings.map((r) => {
        const result = readingResult(survey, r);
        const flagged = result.warnings.length > 0;
        const x = chartX(survey, r);
        return (
          <Link key={r.id} href={{ pathname: '/survey/[id]/reading', params: { id: survey.id, readingId: r.id } }} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reading ${r.seq}${flagged ? ', has warnings' : ''}`}
              style={({ pressed }) => [
                styles.tr,
                { borderBottomColor: theme.border, backgroundColor: pressed ? theme.backgroundSelected : 'transparent' },
              ]}>
              <Cell narrow>{String(r.seq)}</Cell>
              <Cell>{formatSig(x, 3)}</Cell>
              <Cell>{formatSig(sounding ? r.innerM : r.outerM, 3)}</Cell>
              <Cell wide strong>
                {formatSig(result.rhoA, 3)}
              </Cell>
              <Cell narrow>
                {result.warnings.some((w) => w.level === 'error') ? '✕' : flagged ? '⚠' : result.reversed ? '' : '·'}
              </Cell>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

function Cell({
  children,
  header,
  narrow,
  wide,
  strong,
}: {
  children: string;
  header?: boolean;
  narrow?: boolean;
  wide?: boolean;
  strong?: boolean;
}) {
  return (
    <ThemedText
      type={header ? 'smallBold' : 'default'}
      themeColor={header ? 'textSecondary' : 'text'}
      numberOfLines={1}
      style={[styles.td, narrow && styles.narrow, wide && styles.wide, strong && styles.strong]}>
      {children}
    </ThemedText>
  );
}


const styles = StyleSheet.create({
  grow: {
    flex: 1,
  },
  summary: {
    gap: 2,
  },
  table: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.one,
  },
  td: {
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  narrow: {
    flex: 0,
    width: 32,
  },
  wide: {
    flex: 1.3,
    textAlign: 'right',
    paddingRight: Spacing.two,
  },
  strong: {
    fontWeight: 700,
  },
});
