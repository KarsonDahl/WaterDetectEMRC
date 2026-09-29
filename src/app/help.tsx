import Constants from 'expo-constants';
import { StyleSheet } from 'react-native';

import { Card, Screen, SectionTitle } from '@/components/layout';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';

export default function HelpScreen() {
  return (
    <Screen>
      <SectionTitle>The layout</SectionTitle>
      <Card>
        <Formula>A ─── M ─── N ─── B</Formula>
        <ThemedText>
          A and B are the outer stakes that push current into the ground. M and N are the inner stakes; the voltmeter
          reads between them. AB is the full outer span, MN the inner span.
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Wider stakes see deeper. As a rough guide a reading reflects ground down to about a fifth of AB.
        </ThemedText>
      </Card>

      <SectionTitle>Each reading</SectionTitle>
      <Card>
        <ThemedText>
          Read V₁ and I₁, flip the DPDT switch, then read V₂ and I₂. Reversing the current cancels the natural voltage
          already in the ground.
        </ThemedText>
        <Formula>R = |V₁ − V₂| / (|I₁| + |I₂|)</Formula>
        <ThemedText themeColor="textSecondary">
          This “Signed ±” method needs each voltage entered with the sign the meter shows. The “Average” method
          instead uses R = (|V₁|/|I₁| + |V₂|/|I₂|) / 2 and ignores signs. Change it per survey under Edit.
        </ThemedText>
      </Card>

      <SectionTitle>Apparent resistivity</SectionTitle>
      <Card>
        <Formula>K = π (AB² − MN²) / (4 · MN)</Formula>
        <Formula>ρa = K · R   (Ω·m)</Formula>
        <ThemedText themeColor="textSecondary">
          One formula covers both arrays. For Wenner (AB = 3a) it is K = 2πa. Lower ρa can mean wetter ground, but
          clay and salty water also read low — look at the shape of the curve, not a single number.
        </ThemedText>
      </Card>

      <SectionTitle>The curve</SectionTitle>
      <Card>
        <ThemedText>
          Soundings plot ρa against spacing on log–log axes: AB/2 for Schlumberger, a for Wenner. Profiles plot ρa
          against position along the line.
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          A point far off the smooth curve is usually a bad reading — check stake contact and retake it while you are
          still on site.
        </ThemedText>
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card>
        <ThemedText>
          Everything is stored on this phone and works with no signal. Export CSV sends a file you can open in Excel.
          Uninstalling the app deletes the data, so export regularly.
        </ThemedText>
      </Card>

      <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
        Version {Constants.expoConfig?.version ?? '?'}
      </ThemedText>
    </Screen>
  );
}

function Formula({ children }: { children: string }) {
  return <ThemedText style={styles.formula}>{children}</ThemedText>;
}

const styles = StyleSheet.create({
  formula: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    fontWeight: 600,
  },
  version: {
    textAlign: 'center',
  },
});
