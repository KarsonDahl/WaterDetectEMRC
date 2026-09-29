import { Alert } from 'react-native';

/** Ask before a destructive action. Resolves true if the user confirms. */
export function confirmDestructive(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export function showError(title: string, error: unknown) {
  Alert.alert(title, error instanceof Error ? error.message : String(error));
}
