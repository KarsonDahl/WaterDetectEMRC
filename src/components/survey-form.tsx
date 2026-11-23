import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Field, TextField } from '@/components/field';
import { Card, Screen, SectionTitle } from '@/components/layout';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { SurveyInput } from '@/db/types';
import { captureGps } from '@/features/gps';
import type { ArrayType, PolarityMethod } from '@/lib/resistivity';
import { parseDecimal, toInputText } from '@/lib/units';

type Props = {
  initial: SurveyInput;
  submitLabel: string;
  onSubmit: (input: SurveyInput) => Promise<void>;
  /** Extra content under the form, e.g. a delete button. */
  children?: ReactNode;
};

export function SurveyForm({ initial, submitLabel, onSubmit, children }: Props) {
  const [name, setName] = useState(initial.name);
  const [arrayType, setArrayType] = useState<ArrayType>(initial.arrayType);
  const [polarityMethod, setPolarityMethod] = useState<PolarityMethod>(initial.polarityMethod);
  const [operator, setOperator] = useState(initial.operator);
  const [notes, setNotes] = useState(initial.notes);
  const [latitude, setLatitude] = useState(toInputText(initial.latitude));
  const [longitude, setLongitude] = useState(toInputText(initial.longitude));
  const [altitudeM, setAltitudeM] = useState<number | null>(initial.altitudeM);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(initial.gpsAccuracyM);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const lat = parseDecimal(latitude);
  const lon = parseDecimal(longitude);

  const problems: string[] = [];
  if (!name.trim()) problems.push('Give the survey a name.');
  if (latitude.trim() && (lat == null || Math.abs(lat) > 90)) problems.push('Latitude must be between −90 and 90.');
  if (longitude.trim() && (lon == null || Math.abs(lon) > 180)) problems.push('Longitude must be between −180 and 180.');
  if ((lat == null) !== (lon == null)) problems.push('Enter both latitude and longitude, or neither.');

  async function onCaptureGps() {
    setGpsBusy(true);
    setGpsError(null);
    try {
      const fix = await captureGps();
      setLatitude(toInputText(Number(fix.latitude.toFixed(6))));
      setLongitude(toInputText(Number(fix.longitude.toFixed(6))));
      setAltitudeM(fix.altitudeM);
      setGpsAccuracyM(fix.accuracyM);
    } catch (e) {
      setGpsError((e as Error).message);
    } finally {
      setGpsBusy(false);
    }
  }

  async function submit() {
    setSaving(true);
    setSubmitError(null);
    try {
      const hasCoords = lat != null && lon != null;
      await onSubmit({
        name,
        // The survey type is no longer asked: the repo derives it from the readings.
        // Existing values pass through untouched (and updateSurvey ignores them).
        mode: initial.mode,
        arrayType,
        polarityMethod,
        operator,
        notes,
        latitude: hasCoords ? lat : null,
        longitude: hasCoords ? lon : null,
        // Altitude/accuracy only mean something alongside the fix they came with.
        altitudeM: hasCoords ? altitudeM : null,
        gpsAccuracyM: hasCoords ? gpsAccuracyM : null,
        profileInnerM: initial.profileInnerM,
        profileOuterM: initial.profileOuterM,
        profileStepM: initial.profileStepM,
      });
    } catch (e) {
      setSubmitError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <Screen
      footer={
        <Button title={submitLabel} onPress={submit} busy={saving} disabled={problems.length > 0} style={styles.grow} />
      }>
      <Field label="Name">
        <TextField value={name} onChangeText={setName} placeholder="e.g. Village well site 3" />
      </Field>

      <Field
        label="Electrode array"
        hint={
          arrayType === 'wenner'
            ? 'All four stakes equally spaced: AB = 3 × MN.'
            : 'Inner stakes close together: MN no more than AB/5.'
        }>
        <Segmented<ArrayType>
          accessibilityLabel="Electrode array"
          options={[
            { value: 'schlumberger', label: 'Schlumberger' },
            { value: 'wenner', label: 'Wenner' },
          ]}
          value={arrayType}
          onChange={setArrayType}
        />
      </Field>

      <Card>
        <SectionTitle detail="GPS works without phone signal; the first fix can take a minute.">Location</SectionTitle>
        <Button title={gpsBusy ? 'Getting GPS fix…' : 'Capture GPS'} variant="secondary" onPress={onCaptureGps} busy={gpsBusy} />
        {gpsError ? (
          <ThemedText type="small" themeColor="danger">
            {gpsError}
          </ThemedText>
        ) : null}
        <View style={styles.row}>
          <View style={styles.grow}>
            <Field label="Latitude">
              <TextField value={latitude} onChangeText={setLatitude} keyboardType="numeric" placeholder="decimal degrees" />
            </Field>
          </View>
          <View style={styles.grow}>
            <Field label="Longitude">
              <TextField value={longitude} onChangeText={setLongitude} keyboardType="numeric" placeholder="decimal degrees" />
            </Field>
          </View>
        </View>
        {gpsAccuracyM != null && lat != null ? (
          <ThemedText type="small" themeColor="textSecondary">
            GPS accuracy ±{Math.round(gpsAccuracyM)} m
            {altitudeM != null ? ` · altitude ${Math.round(altitudeM)} m` : ''}
          </ThemedText>
        ) : null}
      </Card>

      <Field label="Operator">
        <TextField value={operator} onChangeText={setOperator} placeholder="Who is taking readings" />
      </Field>

      <Field label="Notes">
        <TextField value={notes} onChangeText={setNotes} multiline placeholder="Ground conditions, weather, landmarks…" />
      </Field>

      <Field
        label="Combining the two switch positions"
        hint={
          polarityMethod === 'reversal'
            ? 'Type each voltage with the sign the meter shows (use ±). Cancels natural ground voltage.'
            : 'Signs ignored; the two V/I ratios are averaged. Use if signs were not written down.'
        }>
        <Segmented<PolarityMethod>
          accessibilityLabel="Polarity method"
          options={[
            { value: 'reversal', label: 'Signed (±)' },
            { value: 'average', label: 'Average' },
          ]}
          value={polarityMethod}
          onChange={setPolarityMethod}
        />
      </Field>

      {problems.length > 0 || submitError ? (
        <View style={styles.problems}>
          {[...problems, ...(submitError ? [submitError] : [])].map((p) => (
            <ThemedText key={p} type="small" themeColor="textSecondary">
              • {p}
            </ThemedText>
          ))}
        </View>
      ) : null}

      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  grow: {
    flex: 1,
  },
  problems: {
    gap: Spacing.one,
  },
});
