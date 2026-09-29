import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /** Pinned to the bottom, above the keyboard — for the main action. */
  footer?: ReactNode;
};

export function Screen({ children, footer }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: footer ? Spacing.four : insets.bottom + Spacing.four }]}>
        <View style={styles.column}>{children}</View>
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + Spacing.two, borderTopColor: theme.border, backgroundColor: theme.background },
          ]}>
          <View style={[styles.column, styles.footerRow]}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Card({ style, ...props }: ViewProps) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]} {...props} />;
}

export function SectionTitle({ children, detail }: { children: string; detail?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText style={styles.sectionText}>{children}</ThemedText>
      {detail ? (
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  footerRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius + 4,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  sectionTitle: {
    gap: 2,
    marginTop: Spacing.two,
  },
  sectionText: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
});
