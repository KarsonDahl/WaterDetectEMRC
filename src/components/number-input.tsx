import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Segmented, type SegmentedOption } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseDecimal, toggleSign } from '@/lib/units';

type UnitPicker<U extends string> = {
  options: SegmentedOption<U>[];
  value: U;
  onChange: (unit: U) => void;
};

type Props<U extends string> = {
  value: string;
  onChangeText: (text: string) => void;
  accessibilityLabel: string;
  /** Show a ± button — Android number pads often have no minus key. */
  signed?: boolean;
  /** Switchable unit (e.g. mV / V), shown to the right. */
  unit?: UnitPicker<U>;
  /** Fixed unit label, e.g. "m". */
  suffix?: string;
  placeholder?: string;
};

export function NumberInput<U extends string>({
  value,
  onChangeText,
  accessibilityLabel,
  signed,
  unit,
  suffix,
  placeholder,
}: Props<U>) {
  const theme = useTheme();
  const invalid = value.trim() !== '' && parseDecimal(value) == null;

  return (
    <View style={styles.row}>
      {signed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Flip sign of ${accessibilityLabel}`}
          onPress={() => onChangeText(toggleSign(value))}
          style={({ pressed }) => [
            styles.sign,
            { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 },
          ]}>
          <ThemedText style={styles.signLabel}>±</ThemedText>
        </Pressable>
      ) : null}
      <View
        style={[
          styles.inputBox,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: invalid ? theme.danger : theme.border,
            borderWidth: invalid ? 2 : 1,
          },
        ]}>
        <TextInput
          accessibilityLabel={accessibilityLabel}
          value={value}
          onChangeText={onChangeText}
          keyboardType={signed ? 'numeric' : 'decimal-pad'}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          selectTextOnFocus
          style={[styles.input, { color: theme.text }]}
        />
        {suffix ? (
          <ThemedText themeColor="textSecondary" style={styles.suffix}>
            {suffix}
          </ThemedText>
        ) : null}
      </View>
      {unit ? (
        <Segmented
          compact
          accessibilityLabel={`${accessibilityLabel} unit`}
          options={unit.options}
          value={unit.value}
          onChange={unit.onChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sign: {
    width: TouchTarget,
    height: TouchTarget,
    borderRadius: Radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signLabel: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: 700,
  },
  inputBox: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: 600,
    paddingVertical: 10,
    fontVariant: ['tabular-nums'],
  },
  suffix: {
    fontSize: 16,
    marginLeft: Spacing.two,
  },
});
