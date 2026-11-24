import { Pressable, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { theme } from '../theme';

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <AppText style={styles.text}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { color: theme.colors.brand, fontWeight: '700', fontSize: 15 },
});
