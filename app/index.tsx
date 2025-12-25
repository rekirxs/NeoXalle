import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Theme } from '../constants/theme';

function MaskedLogoSweep() {
  const sweep = useRef(new Animated.Value(0)).current;
  const animRef = useRef<any>(null);

  useEffect(() => {
    const startAnimation = () => {
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
    };

    requestAnimationFrame(startAnimation);
    
    return () => {
      if (animRef.current) {
        animRef.current.stop();
      }
    };
  }, [sweep]);

  const BAR_WIDTH = 20;
  const LOGO_WIDTH = 120;
  
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [0, LOGO_WIDTH + BAR_WIDTH * 2],
  });

  return (
    <View style={{ width: 120, height: 45 }}>
      <Image
        source={require('../assets/images/NeoXalle.png')}
        style={{ width: 120, height: 45, resizeMode: 'contain' }}
      />
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
            colors={[ 'rgba(160,32,192,0)', 'rgba(160,32,192,1)', 'rgba(160,32,192,0)' ]}
            start={[0, 0.5]}
            end={[1, 0.5]}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </MaskedView>
    </View>
  );
}

const bleManager = new BleManager();

const predefinedModes = ['Light Chase', 'Color Wave', 'Pulse Mode', 'Reaction Time']; // Added Reaction Time

type Mode = {
  name: string;
  time: number;
  pods: number;
  timesPlayed: number;
};

export default function HomeScreen() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [modes, setModes] = useState<Mode[]>([]);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    loadModes();
  }, []);

  const loadModes = async () => {
    try {
      const storedModes = await AsyncStorage.getItem('neoxalleModes');
      if (storedModes) {
        setModes(JSON.parse(storedModes));
      }
    } catch (error) {
      console.error('Error loading modes:', error);
    }
  };

  const removeMode = async (index: number) => {
    const newModes = modes.filter((_, i) => i !== index);
    setModes(newModes);
    await AsyncStorage.setItem('neoxalleModes', JSON.stringify(newModes));
    setDeletingIndex(null);
  };

  const editMode = (index: number) => {
    router.push(`/custom-mode?index=${index}`);
    setEditingIndex(null);
  };

  const selectMode = (mode: Mode | string) => {
    const isPredefined = typeof mode === 'string' && predefinedModes.includes(mode);
    if (isPredefined) {
      router.push('/control');
    } else {
      router.push('/control');
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadModes(); 
      setEditingIndex(null); // Reset edit icon
      setDeletingIndex(null); // Reset delete icon
      const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
      bleManager.connectedDevices([SERVICE_UUID]).then((devices) => {
        console.log('Connected devices:', devices.length);
        setIsConnected(devices.length > 0);
      }).catch((err) => {
        console.log('Error checking devices:', err);
        setIsConnected(false);
      });
    }, [])
  );

  return (
    <LinearGradient
      colors={[Theme.neon.purpleDark, '#1a1a1a', '#0d0d0d']}
      start={[0, 0]}
      end={[0, 1]}
      style={{ flex: 1, padding: 24 }}
    >
      <View style={{ position: 'absolute', top: 50, right: 24, zIndex: 10, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => router.push('/connect')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: isConnected ? 'rgba(61,255,154,0.15)' : 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: isConnected ? '#3DFF9A' : '#666',
          }}
        >
          <MaterialCommunityIcons name={isConnected ? "bluetooth-connect" : "bluetooth-off"} size={20} color={isConnected ? '#3DFF9A' : '#666'} />
        </TouchableOpacity>
        <Text style={{ fontSize: 9, color: isConnected ? '#3DFF9A' : '#666', marginTop: 4 }}>{isConnected ? 'Connected' : 'Disconnected'}</Text>
      </View>

      <View style={{ alignItems: 'center', marginTop: 27 }}>
        <MaskedLogoSweep />
      </View>

      {/* Minigame Modes Layout */}
      <View style={{ marginTop: 40 }}>
        <Text style={{ fontSize: 18, color: '#aaa', textAlign: 'left', marginBottom: 20 }}>Start with your Custom Modes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
          {modes.map((mode, index) => (
            <View key={index} style={{ position: 'relative', marginRight: 10 }}>
              <TouchableOpacity
                onPress={() => selectMode(mode)}
                onLongPress={() => {
                  setEditingIndex(index);
                  setDeletingIndex(index);
                }}
                style={{
                  paddingHorizontal: 30,
                  paddingVertical: 15,
                  borderRadius: 5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(40, 167, 69, 0.1)',
                  borderWidth: 2,
                  borderColor: '#28a745',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16 }}>{mode.name}</Text>
              </TouchableOpacity>
              {editingIndex === index && (
                <TouchableOpacity
                  onPress={() => editMode(index)}
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: '#007bff',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="pencil" size={12} color="#fff" />
                </TouchableOpacity>
              )}
              {deletingIndex === index && (
                <TouchableOpacity
                  onPress={() => removeMode(index)}
                  style={{
                    position: 'absolute',
                    top: 30,
                    right: 5,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: '#ff4444',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="trash-can" size={12} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity
            onPress={() => router.push('/custom-mode')}
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: 'transparent',
              borderWidth: 2,
              borderColor: Theme.neon.purpleDark,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <MaterialCommunityIcons name="plus" size={30} color={Theme.neon.purpleDark} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Pre-made Modes Layout */}
      <View style={{ marginTop: 40 }}>
        <Text style={{ fontSize: 18, color: '#aaa', textAlign: 'left', marginBottom: 20 }}>Try our pre-made Modes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
          {predefinedModes.map((mode, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => selectMode(mode)}
              style={{
                paddingHorizontal: 30,
                paddingVertical: 15,
                borderRadius: 5,
                marginRight: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderWidth: 2,
                borderColor: '#007bff',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16 }}>{mode}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

    </LinearGradient>
  );
}