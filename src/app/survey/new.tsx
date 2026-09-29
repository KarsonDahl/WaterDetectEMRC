import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { SurveyForm } from '@/components/survey-form';
import { useLiveQuery } from '@/db/live';
import { createSurvey, getLatestSurvey } from '@/db/repo';
import type { Survey, SurveyInput } from '@/db/types';
import { defaultSurveyName } from '@/lib/format';

/** Carry over the crew's usual settings from their last survey; location is always fresh. */
function initialValues(latest: Survey | null): SurveyInput {
  return {
    name: defaultSurveyName(),
    mode: latest?.mode ?? 'sounding',
    arrayType: latest?.arrayType ?? 'schlumberger',
    polarityMethod: latest?.polarityMethod ?? 'reversal',
    latitude: null,
    longitude: null,
    altitudeM: null,
    gpsAccuracyM: null,
    operator: latest?.operator ?? '',
    notes: '',
    profileInnerM: latest?.profileInnerM ?? null,
    profileOuterM: latest?.profileOuterM ?? null,
    profileStepM: latest?.profileStepM ?? null,
  };
}

export default function NewSurveyScreen() {
  const db = useSQLiteContext();
  const { data: latest } = useLiveQuery((db) => getLatestSurvey(db), []);

  // Wait for the lookup so the form starts with the right defaults.
  if (latest === undefined) return null;

  return (
    <SurveyForm
      initial={initialValues(latest)}
      submitLabel="Create survey"
      onSubmit={async (input) => {
        const id = await createSurvey(db, input);
        router.replace({ pathname: '/survey/[id]', params: { id } });
      }}
    />
  );
}
