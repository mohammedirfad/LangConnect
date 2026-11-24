import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export function BrandMark({ size = 58 }: { size?: number }) {
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.34 }]}>
      <Ionicons name="map-outline" size={size * 0.49} color={theme.colors.white} />
      <View style={[styles.pin, { width: size * 0.2, height: size * 0.2 }]}>
        <Ionicons name="location" size={size * 0.15} color={theme.colors.brandDark} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brand,
    shadowColor: theme.colors.brandDark,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  pin: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    borderRadius: 99,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
