import { Link, Stack, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { HeaderLink } from '@/components/header-link';
import { Card, Screen } from '@/components/layout';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/db/live';
import { listSurveys } from '@/db/repo';
import type { SurveySummary } from '@/db/types';
import { showError } from '@/features/dialogs';
import { exportCsv } from '@/features/export';
import { useTheme } from '@/hooks/use-theme';
import { capitalize, formatDateTime } from '@/lib/format';

export default function SurveysScreen() {
  const db = useSQLiteContext();
  const { data: surveys } = useLiveQuery((db) => listSurveys(db), []);
  const [exporting, setExporting] = useState(false);

  async function onExportAll() {
    setExporting(true);
    try {
      await exportCsv(db, 'all-surveys');
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
          headerRight: () => <HeaderLink href="/help" label="Help" />,
        }}
      />
      <Screen
        footer={
          <>
            {surveys && surveys.length > 0 ? (
              <Button title="Export all" variant="secondary" onPress={onExportAll} busy={exporting} style={styles.grow} />
            ) : null}
            <Button title="New survey" onPress={() => router.push('/survey/new')} style={styles.grow} />
          </>
        }>
        {surveys?.length === 0 ? <EmptyState /> : null}
        {surveys?.map((s) => <SurveyRow key={s.id} survey={s} />)}
      </Screen>
    </>
  );
}

function SurveyRow({ survey }: { survey: SurveySummary }) {
  const theme = useTheme();
  const count = survey.readingCount;
  return (
    <Link href={{ pathname: '/survey/[id]', params: { id: survey.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.75 : 1 }]}>
        <ThemedText style={styles.rowTitle} numberOfLines={1}>
          {survey.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {capitalize(survey.mode)} · {capitalize(survey.arrayType)} · {count} {count === 1 ? 'reading' : 'readings'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDateTime(survey.createdAt)}
          {survey.latitude != null ? ' · GPS saved' : ' · no GPS'}
          {survey.operator ? ` · ${survey.operator}` : ''}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

function EmptyState() {
  return (
    <Card>
      <ThemedText style={styles.rowTitle}>No surveys yet</ThemedText>
      <ThemedText themeColor="textSecondary">
        A survey is one spot (a sounding) or one line (a profile). Create one when you arrive on site, then add a
        reading for each stake spacing.
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        Everything is saved on this phone and works with no signal. Use Export to send a CSV when you are back online.
      </ThemedText>
    </Card>
  );
}


const styles = StyleSheet.create({
  grow: {
    flex: 1,
  },
  row: {
    borderRadius: Radius + 4,
    padding: Spacing.three,
    gap: 2,
  },
  rowTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
});
