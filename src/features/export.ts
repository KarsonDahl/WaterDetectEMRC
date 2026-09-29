import type { SQLiteDatabase } from 'expo-sqlite';

import { loadSurveysWithReadings } from '@/db/repo';
import { shareTextFile } from '@/features/share-file';
import { buildCsv, exportFileName } from '@/lib/csv';

/** Export one survey, or every survey when `surveyId` is omitted, as CSV via the share sheet. */
export async function exportCsv(db: SQLiteDatabase, label: string, surveyId?: string): Promise<void> {
  const data = await loadSurveysWithReadings(db, surveyId);
  await shareTextFile(exportFileName(label), buildCsv(data), 'text/csv');
}
