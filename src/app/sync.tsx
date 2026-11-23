import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button } from '@/components/button';
import { Field, TextField } from '@/components/field';
import { Screen } from '@/components/layout';
import { ThemedText } from '@/components/themed-text';
import { showError } from '@/features/dialogs';
import { loadSyncSettings, saveSyncSettings } from '@/features/sync';
import { syncEndpoint } from '@/lib/sync-payload';

/** Where uploads go and the key that authorises them. Stored on this device only. */
export default function SyncSettingsScreen() {
  const [loaded, setLoaded] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    loadSyncSettings().then((s) => {
      setServerUrl(s.serverUrl);
      setApiKey(s.apiKey);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return null;

  const endpoint = serverUrl.trim() ? syncEndpoint(serverUrl) : null;
  const urlError = endpoint && 'error' in endpoint ? endpoint.error : null;

  async function save() {
    try {
      await saveSyncSettings({ serverUrl, apiKey });
      router.back();
    } catch (e) {
      showError('Could not save', e);
    }
  }

  return (
    <Screen footer={<Button title="Save" onPress={save} disabled={urlError != null} />}>
      <ThemedText themeColor="textSecondary">
        Uploading is optional and only happens when you tap Upload on a survey. Everything keeps working with no signal.
      </ThemedText>
      <Field label="Server address" hint={urlError ?? 'For example water-detection-delta.vercel.app'}>
        <TextField
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </Field>
      <Field label="API key" hint="Given to you by whoever runs the server. Stored on this device only.">
        <TextField
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="wd_…"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      </Field>
    </Screen>
  );
}
