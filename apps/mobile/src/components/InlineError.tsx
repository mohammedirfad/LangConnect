import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { theme } from '../theme';

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={styles.box}>
      <AppText style={styles.text}>{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 13,
    backgroundColor: theme.colors.dangerBackground,
    borderWidth: 1,
    borderColor: '#F3D5CE',
    padding: 13,
    marginBottom: 16,
  },
  text: { color: theme.colors.danger, fontSize: 14, lineHeight: 20 },
});
