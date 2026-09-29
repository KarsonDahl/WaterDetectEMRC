import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Write `content` to the app cache and open the Android share sheet, so the
 * crew can send it by WhatsApp, email, Bluetooth, or save it to Drive/USB.
 */
export async function shareTextFile(fileName: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
}
