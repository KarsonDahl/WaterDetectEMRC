import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button } from '@/components/button';
import { SurveyForm } from '@/components/survey-form';
import { useLiveQuery } from '@/db/live';
import { deleteSurvey, getSurvey, updateSurvey } from '@/db/repo';
import { confirmDestructive } from '@/features/dialogs';

export default function EditSurveyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { data: survey } = useLiveQuery((db) => getSurvey(db, id), [id]);

  if (!survey) return null;

  async function onDelete() {
    const confirmed = await confirmDestructive(
      'Delete survey?',
      `"${survey!.name}" and all its readings will be removed from this phone. Export first if you need a copy.`,
      'Delete',
    );
    if (!confirmed) return;
    await deleteSurvey(db, id);
    router.dismissTo('/');
  }

  return (
    <SurveyForm
      initial={survey}
      submitLabel="Save changes"
      onSubmit={async (input) => {
        await updateSurvey(db, id, input);
        router.back();
      }}>
      <Button title="Delete survey" variant="danger" onPress={onDelete} />
    </SurveyForm>
  );
}
