import { Link, type Href } from 'expo-router';
import { Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Text button for the navigation header's right side. */
export function HeaderLink({ href, label }: { href: Href; label: string }) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" hitSlop={12}>
        <ThemedText style={{ color: theme.tint, fontWeight: 600, fontSize: 17 }}>{label}</ThemedText>
      </Pressable>
    </Link>
  );
}
