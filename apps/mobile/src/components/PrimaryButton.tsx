import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { theme } from '../theme';

interface PrimaryButtonProps {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function PrimaryButton({
  title,
  loading = false,
  disabled = false,
  onPress,
}: PrimaryButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.white} />
      ) : (
        <AppText style={styles.text}>{title}</AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.brand,
    marginTop: 7,
    shadowColor: theme.colors.brandDark,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  disabled: { opacity: 0.55, elevation: 0, shadowOpacity: 0 },
  pressed: { backgroundColor: theme.colors.brandDark },
  text: { color: theme.colors.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
});
