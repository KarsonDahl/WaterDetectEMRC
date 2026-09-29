import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Field, TextField } from '@/components/field';
import { Card, Screen, SectionTitle } from '@/components/layout';
import { NumberInput } from '@/components/number-input';
import { ResistivityChart } from '@/components/resistivity-chart';
import { ThemedText } from '@/components/themed-text';
import { WarningList } from '@/components/warning-list';
import { Radius, Spacing } from '@/constants/theme';
import { useLiveQuery } from '@/db/live';
import { createReading, deleteReading, getSurvey, listReadings, updateReading } from '@/db/repo';
import type { Reading, ReadingInput, Survey } from '@/db/types';
import { confirmDestructive, showError } from '@/features/dialogs';
import { useTheme } from '@/hooks/use-theme';
import { chartPoints, chartX, chartXLabel, readingResult, suggestNextReading } from '@/lib/survey';
import { formatSig, fromSI, parseDecimal, toInputText, toSI, type CurrentUnit, type VoltageUnit } from '@/lib/units';

export default function ReadingScreen() {
  const { id, readingId } = useLocalSearchParams<{ id: string; readingId?: string }>();
  const { data } = useLiveQuery(
    async (db) => ({ survey: await getSurvey(db, id), readings: await listReadings(db, id) }),
    [id],
  );
  const [savedSeq, setSavedSeq] = useState<number | null>(null);

  if (!data?.survey) return null;
  const { survey, readings } = data;
  const editing = readingId ? readings.find((r) => r.id === readingId) : undefined;
  if (readingId && !editing) return null;
  const nextSeq = Math.max(0, ...readings.map((r) => r.seq)) + 1;

  return (
    <>
      <Stack.Screen options={{ title: `Reading ${editing ? editing.seq : nextSeq}` }} />
      <ReadingForm
        // A new reading count remounts the form, prefilled with the next suggested spacing.
        key={editing ? editing.id : `new-${readings.length}`}
        survey={survey}
        readings={readings}
        editing={editing}
        savedSeq={editing ? null : savedSeq}
        onSavedAndNext={() => setSavedSeq(nextSeq)}
      />
    </>
  );
}

type FormProps = {
  survey: Survey;
  readings: Reading[];
  editing?: Reading;
  savedSeq: number | null;
  onSavedAndNext: () => void;
};

function initialState(survey: Survey, readings: Reading[], editing?: Reading) {
  if (editing) {
    const v = (x: number | null) => (x == null ? '' : toInputText(fromSI(x, editing.vUnit)));
    const i = (x: number | null) => (x == null ? '' : toInputText(fromSI(x, editing.iUnit)));
    return {
      position: toInputText(editing.positionM),
      inner: toInputText(editing.innerM),
      outer: toInputText(editing.outerM),
      v1: v(editing.v1),
      i1: i(editing.i1),
      v2: v(editing.v2),
      i2: i(editing.i2),
      vUnit: editing.vUnit,
      iUnit: editing.iUnit,
      note: editing.note,
    };
  }
  const last = readings.at(-1);
  const next = suggestNextReading(survey, readings);
  return {
    position: toInputText(next?.positionM ?? null),
    inner: toInputText(next?.innerM ?? last?.innerM),
    outer: toInputText(next?.outerM ?? last?.outerM),
    v1: '',
    i1: '',
    v2: '',
    i2: '',
    // Meter ranges change gradually, so start from whatever was used last.
    vUnit: last?.vUnit ?? ('mV' as VoltageUnit),
    iUnit: last?.iUnit ?? ('mA' as CurrentUnit),
    note: '',
  };
}

function ReadingForm({ survey, readings, editing, savedSeq, onSavedAndNext }: FormProps) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [initial] = useState(() => initialState(survey, readings, editing));
  const [position, setPosition] = useState(initial.position);
  const [inner, setInner] = useState(initial.inner);
  const [outer, setOuter] = useState(initial.outer);
  const [v1, setV1] = useState(initial.v1);
  const [i1, setI1] = useState(initial.i1);
  const [v2, setV2] = useState(initial.v2);
  const [i2, setI2] = useState(initial.i2);
  const [vUnit, setVUnit] = useState<VoltageUnit>(initial.vUnit);
  const [iUnit, setIUnit] = useState<CurrentUnit>(initial.iUnit);
  const [note, setNote] = useState(initial.note);
  const [saving, setSaving] = useState(false);

  const volts = (text: string) => nullable(parseDecimal(text), (n) => toSI(n, vUnit));
  const amps = (text: string) => nullable(parseDecimal(text), (n) => toSI(n, iUnit));
  const innerM = parseDecimal(inner);
  const outerM = parseDecimal(outer);
  const positionM = parseDecimal(position);

  const measurement = {
    innerM: innerM ?? NaN,
    outerM: outerM ?? NaN,
    v1: volts(v1),
    i1: amps(i1),
    v2: volts(v2),
    i2: amps(i2),
  };
  const result = readingResult(survey, measurement);
  const draftX = chartX(survey, { ...measurement, positionM });

  const problems: string[] = [];
  if (innerM == null || outerM == null) problems.push('Enter both stake spacings.');
  if (survey.mode === 'profile' && positionM == null) problems.push('Enter the station position.');
  if (measurement.v1 == null || measurement.i1 == null) problems.push('Enter at least the switch position 1 voltage and current.');
  if (result.warnings.some((w) => w.level === 'error')) problems.push('Fix the errors above.');
  const invalidText = [position, inner, outer, v1, i1, v2, i2].some((t) => t.trim() !== '' && parseDecimal(t) == null);
  if (invalidText) problems.push('One of the numbers could not be read — check the red box.');

  function onInnerChange(text: string) {
    setInner(text);
    const a = parseDecimal(text);
    if (survey.arrayType === 'wenner' && a != null) setOuter(toInputText(3 * a));
  }

  function toInput(): ReadingInput {
    return {
      positionM: survey.mode === 'profile' ? positionM : null,
      innerM: innerM!,
      outerM: outerM!,
      v1: measurement.v1,
      i1: measurement.i1,
      v2: measurement.v2,
      i2: measurement.i2,
      vUnit,
      iUnit,
      source: editing?.source ?? 'manual',
      note,
    };
  }

  async function save(andNext: boolean) {
    setSaving(true);
    try {
      if (editing) {
        await updateReading(db, editing.id, toInput());
        router.back();
      } else {
        await createReading(db, survey.id, toInput());
        if (andNext) onSavedAndNext();
        else router.back();
      }
    } catch (e) {
      showError('Could not save', e);
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editing) return;
    const ok = await confirmDestructive('Delete reading?', `Reading ${editing.seq} will be removed.`, 'Delete');
    if (!ok) return;
    await deleteReading(db, editing.id);
    router.back();
  }

  const canSave = problems.length === 0 && !saving;
  const halfAB = outerM != null ? outerM / 2 : null;

  return (
    <Screen
      footer={
        editing ? (
          <>
            <Button title="Delete" variant="danger" onPress={onDelete} style={styles.grow} />
            <Button title="Save changes" onPress={() => save(false)} disabled={!canSave} busy={saving} style={styles.grow} />
          </>
        ) : (
          <>
            <Button title="Save" variant="secondary" onPress={() => save(false)} disabled={!canSave} style={styles.grow} />
            <Button title="Save & next" onPress={() => save(true)} disabled={!canSave} busy={saving} style={styles.grow} />
          </>
        )
      }>
      {savedSeq != null ? (
        <View style={[styles.banner, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">✓ Reading {savedSeq} saved. Move the stakes for the next one.</ThemedText>
        </View>
      ) : null}

      <SectionTitle detail={survey.arrayType === 'wenner' ? 'Wenner: AB is set to 3 × MN for you.' : undefined}>
        Stakes
      </SectionTitle>
      {survey.mode === 'profile' ? (
        <Field label="Station position along the line">
          <NumberInput accessibilityLabel="Station position" value={position} onChangeText={setPosition} suffix="m" />
        </Field>
      ) : null}
      <View style={styles.row}>
        <View style={styles.grow}>
          <Field label="Inner M–N">
            <NumberInput accessibilityLabel="Inner spacing MN" value={inner} onChangeText={onInnerChange} suffix="m" />
          </Field>
        </View>
        <View style={styles.grow}>
          <Field label="Outer A–B (full)">
            <NumberInput accessibilityLabel="Outer spacing AB" value={outer} onChangeText={setOuter} suffix="m" />
          </Field>
        </View>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {halfAB != null ? `AB/2 = ${formatSig(halfAB, 3)} m` : ''}
        {result.depthM != null ? ` · sees roughly ${formatSig(result.depthM, 2)} m deep` : ''}
      </ThemedText>

      <SectionTitle
        detail={
          survey.polarityMethod === 'reversal'
            ? 'Voltage across the inner stakes, with the sign the meter shows.'
            : 'Voltage across the inner stakes.'
        }>
        Switch position 1
      </SectionTitle>
      <Field label="Voltage V₁ (M–N)">
        <NumberInput
          accessibilityLabel="Voltage 1"
          value={v1}
          onChangeText={setV1}
          signed
          unit={{ options: VOLT_UNITS, value: vUnit, onChange: setVUnit }}
        />
      </Field>
      <Field label="Current I₁">
        <NumberInput
          accessibilityLabel="Current 1"
          value={i1}
          onChangeText={setI1}
          unit={{ options: AMP_UNITS, value: iUnit, onChange: setIUnit }}
        />
      </Field>

      <View style={[styles.flip, { borderColor: theme.tint }]}>
        <ThemedText style={[styles.flipText, { color: theme.tint }]}>⇅ Flip the DPDT switch</ThemedText>
      </View>

      <SectionTitle
        detail={survey.polarityMethod === 'reversal' ? 'The voltage usually changes sign — tap ± if so.' : undefined}>
        Switch position 2
      </SectionTitle>
      <Field label="Voltage V₂ (M–N)">
        <NumberInput accessibilityLabel="Voltage 2" value={v2} onChangeText={setV2} signed suffix={vUnit} />
      </Field>
      <Field label="Current I₂">
        <NumberInput accessibilityLabel="Current 2" value={i2} onChangeText={setI2} suffix={iUnit} />
      </Field>

      <Card>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Apparent resistivity ρa
        </ThemedText>
        <ThemedText style={styles.hero} accessibilityLiveRegion="polite">
          {result.rhoA != null ? `${formatSig(result.rhoA, 3)} Ω·m` : '—'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          R = {formatSig(result.resistance, 3)} Ω · K = {formatSig(result.k, 3)} m
          {result.sp != null ? ` · ground voltage ${formatSig(fromSI(result.sp, vUnit), 3)} ${vUnit}` : ''}
        </ThemedText>
        <WarningList warnings={result.warnings} />
        <ResistivityChart
          points={chartPoints(survey, readings.filter((r) => r.id !== editing?.id))}
          draft={draftX != null && result.rhoA != null ? { x: draftX, y: result.rhoA } : null}
          xScale={survey.mode === 'sounding' ? 'log' : 'linear'}
          xLabel={chartXLabel(survey)}
          yLabel="ρa (Ω·m)"
          height={220}
        />
      </Card>

      <Field label="Note (optional)">
        <TextField value={note} onChangeText={setNote} placeholder="e.g. stake B in wet sand" />
      </Field>

      {problems.length > 0 ? (
        <View style={styles.problems}>
          {problems.map((p) => (
            <ThemedText key={p} type="small" themeColor="textSecondary">
              • {p}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const VOLT_UNITS = [
  { value: 'mV' as const, label: 'mV' },
  { value: 'V' as const, label: 'V' },
];
const AMP_UNITS = [
  { value: 'mA' as const, label: 'mA' },
  { value: 'A' as const, label: 'A' },
];

function nullable<T, U>(value: T | null, map: (v: T) => U): U | null {
  return value == null ? null : map(value);
}

const styles = StyleSheet.create({
  grow: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  banner: {
    borderRadius: Radius,
    padding: Spacing.three,
  },
  flip: {
    borderWidth: 2,
    borderRadius: Radius,
    paddingVertical: Spacing.two + 4,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  flipText: {
    fontSize: 17,
    fontWeight: 700,
  },
  hero: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: 700,
  },
  problems: {
    gap: Spacing.one,
  },
});
