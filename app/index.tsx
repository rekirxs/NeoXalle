import { MaterialCommunityIcons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  InteractionManager,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Theme } from '../constants/theme';

function MaskedLogoSweep() {
  const sweep = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    sweep.setValue(0);
    const handle = InteractionManager.runAfterInteractions(() => {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(1100),
        ]),
        { resetBeforeIteration: true }
      );
      animRef.current.start();
    });

    return () => {
      try { handle.cancel?.(); } catch {}
      animRef.current?.stop();
    };
  }, [sweep]);

  const BAR_WIDTH = 20;
  const LOGO_WIDTH = 120;
  // Start fully off left, sweep entirely past right, then reset (no reverse)
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [0, LOGO_WIDTH + BAR_WIDTH * 2],
  });

  return (
    <View style={{ width: 120, height: 45 }}>
      {/* Base logo */}
      <Image
        source={require('../assets/images/NeoXalle.png')}
        style={{ width: 120, height: 45, resizeMode: 'contain' }}
      />

      {/* Masked vertical sweep over text only */}
      <MaskedView
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        maskElement={
          <Image
            source={require('../assets/images/NeoXalle.png')}
            style={{ width: 120, height: 45, resizeMode: 'contain' }}
          />
        }
      >
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, bottom: 0, left: -BAR_WIDTH, width: BAR_WIDTH, transform: [{ translateX }] }}
        >
          <LinearGradient
            colors={[ 'rgba(0,0,0,0)', Theme.neon.purpleLight, 'rgba(0,0,0,0)' ]}
            start={[0, 0]}
            end={[0, 1]}
            style={{ flex: 1, opacity: 0.9 }}
          />
        </Animated.View>
      </MaskedView>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  // UI
  return (
    <LinearGradient
      colors={[Theme.neon.purpleDark, '#1a1a1a', '#0d0d0d']}
      start={[0, 0]}
      end={[0, 1]}
      style={{ flex: 1, padding: 24 }}
    >
      {/* Bluetooth Button - Top Right */}
      <View style={{ position: 'absolute', top: 50, right: 24, zIndex: 10, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => router.push('/connect')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#666',
          }}
        >
          <MaterialCommunityIcons name="bluetooth-off" size={20} color="#666" />
        </TouchableOpacity>
        <Text style={{ fontSize: 9, color: '#666', marginTop: 4 }}>Disconnected</Text>
      </View>

      {/* Logo - Top Center */}
      <View style={{ alignItems: 'center', marginTop: 27 }}>
        <MaskedLogoSweep />
      </View>

    </LinearGradient>
  );
}
