import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentedOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
  accessibilityLabel?: string;
};

/** A row of mutually exclusive choices. Every option is visible — no hidden dropdowns in the field. */
export function Segmented<T extends string>({ options, value, onChange, compact, accessibilityLabel }: Props<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.option,
              compact && styles.compact,
              selected && { backgroundColor: theme.tint },
            ]}>
            <ThemedText
              style={[styles.label, { color: selected ? theme.onTint : theme.text }]}
              numberOfLines={1}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: Radius,
    padding: 3,
    gap: 3,
  },
  option: {
    flex: 1,
    minHeight: TouchTarget - 6,
    borderRadius: Radius - 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  compact: {
    flex: 0,
    minWidth: 52,
  },
  label: {
    fontSize: 16,
    fontWeight: 600,
  },
});
