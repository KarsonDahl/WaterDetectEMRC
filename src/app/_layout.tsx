import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { migrateDbIfNeeded } from '@/db/migrations';

/** Lives in the app's private storage; survives restarts and app updates, removed on uninstall. */
const DATABASE_NAME = 'waterdetect.db';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, primary: colors.tint, background: colors.background, card: colors.background, text: colors.text, border: colors.border },
      }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
        <Stack screenOptions={{ headerTitleStyle: { fontWeight: '700' }, headerShadowVisible: false }}>
          <Stack.Screen name="index" options={{ title: 'Surveys' }} />
          <Stack.Screen name="help" options={{ title: 'How it works' }} />
          <Stack.Screen name="survey/new" options={{ title: 'New survey' }} />
          <Stack.Screen name="survey/[id]/index" options={{ title: '' }} />
          <Stack.Screen name="survey/[id]/edit" options={{ title: 'Edit survey' }} />
          <Stack.Screen name="survey/[id]/reading" options={{ title: 'Reading' }} />
        </Stack>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
