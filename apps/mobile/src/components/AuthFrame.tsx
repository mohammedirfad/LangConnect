import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { AppText } from './AppText';
import { BrandMark } from './BrandMark';
import { theme } from '../theme';

interface AuthFrameProps extends PropsWithChildren {
  title: string;
  subtitle: string;
  footer: ReactNode;
  eyebrow?: string;
}

function useMotionPreference() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

function AmbientOrb({ style, delay = 0 }: { style: object; delay?: number }) {
  const reduceMotion = useMotionPreference();
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      drift.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(drift, { toValue: 1, duration: 5200, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 5200, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, drift, reduceMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        style,
        {
          opacity: drift.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.16] }),
          transform: [
            { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
            { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
          ],
        },
      ]}
    />
  );
}

export function AuthFrame({
  title,
  subtitle,
  footer,
  children,
  eyebrow = 'LAND, WELL CONNECTED',
}: AuthFrameProps) {
  const reduceMotion = useMotionPreference();
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      duration: 460,
      useNativeDriver: true,
    }).start();
  }, [entrance, reduceMotion]);

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <AmbientOrb delay={250} style={styles.orbTop} />
        <AmbientOrb delay={900} style={styles.orbBottom} />
        <View style={styles.decorativeLine} />
      </View>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: entrance,
                transform: [
                  {
                    translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.brandHeader}>
              <BrandMark />
              <AppText style={styles.brand}>LandConnect</AppText>
              <AppText style={styles.brandCaption}>Find your ground. Make it yours.</AppText>
            </View>
            <View style={styles.card}>
              <View style={styles.cardAccent} />
              <AppText style={styles.eyebrow}>{eyebrow}</AppText>
              <AppText style={styles.title}>{title}</AppText>
              <AppText style={styles.subtitle}>{subtitle}</AppText>
              {children}
            </View>
            <View style={styles.footer}>{footer}</View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background, overflow: 'hidden' },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 30 },
  content: { width: '100%', maxWidth: 500, alignSelf: 'center' },
  brandHeader: { alignItems: 'center', marginBottom: 25 },
  brand: {
    color: theme.colors.brand,
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginTop: 11,
  },
  brandCaption: {
    color: theme.colors.muted,
    fontSize: 12,
    letterSpacing: 0.35,
    marginTop: 3,
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: '#E9E8DF',
    padding: 25,
    shadowColor: '#294333',
    shadowOpacity: 0.07,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 13 },
    elevation: 3,
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 25,
    width: 44,
    height: 4,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: theme.colors.accent,
  },
  eyebrow: {
    color: theme.colors.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginTop: 3,
    marginBottom: 9,
  },
  title: { color: theme.colors.text, fontSize: 29, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 21,
  },
  footer: { marginTop: 21, alignItems: 'center' },
  orb: { position: 'absolute', borderRadius: 999 },
  orbTop: { width: 280, height: 280, top: -100, right: -100, backgroundColor: '#7EAA79' },
  orbBottom: { width: 230, height: 230, bottom: -100, left: -80, backgroundColor: '#D2A954' },
  decorativeLine: {
    position: 'absolute',
    width: 420,
    height: 420,
    top: -280,
    left: -240,
    borderWidth: 1,
    borderColor: '#174B3A12',
    borderRadius: 210,
  },
});
