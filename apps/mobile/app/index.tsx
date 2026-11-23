import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>LandConnect</Text>
      <Text style={styles.subtitle}>A better way to find your next piece of land.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6faf7' },
  title: { color: '#075e54', fontSize: 32, fontWeight: '700' },
  subtitle: { color: '#50645a', fontSize: 16, marginTop: 10 },
});
