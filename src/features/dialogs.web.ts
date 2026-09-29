// react-native-web has no Alert; the browser's dialogs are fine for the dev preview.

export async function confirmDestructive(title: string, message: string, _confirmLabel: string): Promise<boolean> {
  return window.confirm(`${title}\n\n${message}`);
}

export function showError(title: string, error: unknown) {
  window.alert(`${title}\n\n${error instanceof Error ? error.message : String(error)}`);
}
