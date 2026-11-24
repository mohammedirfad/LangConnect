import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UserRole } from '../auth/types';
import { AppText } from './AppText';
import { theme } from '../theme';

const roles: {
  value: UserRole;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}[] = [
  {
    value: 'BUYER',
    label: 'Buyer',
    icon: 'search-outline',
    description: 'Discover land for your next move.',
  },
  { value: 'SELLER', label: 'Seller', icon: 'leaf-outline', description: 'Showcase land you own.' },
  {
    value: 'BROKER',
    label: 'Broker',
    icon: 'briefcase-outline',
    description: 'Connect clients with the right land.',
  },
];

export function RoleSelector({
  value,
  onChange,
}: {
  value: UserRole;
  onChange: (role: UserRole) => void;
}) {
  const selectedRole = roles.find((role) => role.value === value) ?? roles[0]!;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <AppText style={styles.label}>I AM A</AppText>
        <AppText style={styles.required}>CHOOSE ONE</AppText>
      </View>
      <View style={styles.options} accessibilityRole="radiogroup">
        {roles.map((role) => {
          const selected = role.value === value;
          return (
            <Pressable
              key={role.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${role.label}. ${role.description}`}
              onPress={() => onChange(role.value)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>
                <Ionicons
                  name={role.icon}
                  size={19}
                  color={selected ? theme.colors.white : theme.colors.muted}
                />
              </View>
              <AppText style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {role.label}
              </AppText>
              {selected ? (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={12} color={theme.colors.brand} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.description}>
        <View style={styles.descriptionDot} />
        <AppText style={styles.descriptionText}>{selectedRole.description}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 1, marginBottom: 18 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  label: { color: theme.colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.25 },
  required: { color: '#929B91', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  options: { flexDirection: 'row', gap: 9 },
  option: {
    flex: 1,
    minHeight: 80,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 17,
    backgroundColor: theme.colors.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  optionSelected: {
    borderColor: theme.colors.brand,
    backgroundColor: theme.colors.brand,
    shadowColor: theme.colors.brandDark,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  optionPressed: { transform: [{ scale: 0.97 }] },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF0E9',
  },
  iconBoxSelected: { backgroundColor: '#FFFFFF20' },
  optionLabel: { color: theme.colors.text, fontSize: 12, fontWeight: '700' },
  optionLabelSelected: { color: theme.colors.white },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
    marginTop: 5,
    paddingHorizontal: 3,
  },
  descriptionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
  descriptionText: { color: theme.colors.muted, fontSize: 12, flexShrink: 1 },
});
