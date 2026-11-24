import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/auth/store';
import { theme } from '../src/theme';

export default function HomeScreen() {
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const user = useAuthStore((state) => state.user);

  if (isHydrating) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
      </View>
    );
  }
  return <Redirect href={user ? '/home' : '/login'} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
});
