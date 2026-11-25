import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../components/AppText';

export default function CallRoom() {
  return (
    <View style={styles.screen}>
      <AppText style={styles.title}>Calls need the mobile app</AppText>
      <AppText style={styles.body}>
        LiveKit calls use the Android or iOS development build. Open LandConnect on two mobile
        devices to join this call.
      </AppText>
      <Pressable onPress={() => router.replace('/calls')} style={styles.button}>
        <AppText style={styles.buttonText}>Back to calls</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F6F4EC' },
  title: { color: '#18271F', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  body: { color: '#68766C', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  button: {
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 15,
    backgroundColor: '#174B3A',
    marginTop: 24,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
