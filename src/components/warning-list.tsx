import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ReadingWarning } from '@/lib/resistivity';

/** Data-quality warnings. Always icon + words, never color alone. */
export function WarningList({ warnings }: { warnings: ReadingWarning[] }) {
  const theme = useTheme();
  if (warnings.length === 0) return null;
  return (
    <View style={styles.list}>
      {warnings.map((w) => {
        const isError = w.level === 'error';
        return (
          <View
            key={w.code}
            accessibilityRole="alert"
            style={[styles.item, { backgroundColor: isError ? theme.errorBackground : theme.warningBackground }]}>
            <ThemedText style={[styles.icon, { color: isError ? theme.danger : theme.warningText }]}>
              {isError ? '✕' : '⚠'}
            </ThemedText>
            <ThemedText type="small" style={[styles.text, { color: isError ? theme.danger : theme.warningText }]}>
              {w.message}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.two + 4,
    borderRadius: Radius,
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: 700,
  },
  text: {
    flex: 1,
  },
});
