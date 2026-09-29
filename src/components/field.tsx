import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

/** A labelled form row. */
export function Field({ label, hint, children }: FieldProps) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function TextField({ style, ...props }: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      {...props}
      style={[
        styles.input,
        props.multiline && styles.multiline,
        { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one + 2,
  },
  input: {
    minHeight: TouchTarget,
    borderRadius: Radius,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 18,
  },
  multiline: {
    minHeight: 96,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
});
