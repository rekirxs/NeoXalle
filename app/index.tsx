import { MaterialCommunityIcons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { Buffer } from 'buffer';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  InteractionManager,
  PermissionsAndroid,
  Platform,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { Theme } from '../constants/theme';

// Configuracion del BLUETOOTH
const NEOXALLE_NAME = 'NEOXALLE';
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const CHAR_UUID    = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const bleManager = new BleManager();

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

  const BAR_WIDTH = 50;
  const LOGO_WIDTH = 320;
  // Start fully off left, sweep entirely past right, then reset (no reverse)
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [0, LOGO_WIDTH + BAR_WIDTH * 2],
  });

  return (
    <View style={{ width: 320, height: 120 }}>
      {/* Base logo */}
      <Image
        source={require('../assets/images/NeoXalle.png')}
        style={{ width: 320, height: 120, resizeMode: 'contain' }}
      />

      {/* Masked vertical sweep over text only */}
      <MaskedView
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        maskElement={
          <Image
            source={require('../assets/images/NeoXalle.png')}
            style={{ width: 320, height: 120, resizeMode: 'contain' }}
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
  // 🔵 STATE
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [status, setStatus] = useState('Disconnected');
  const [, setLastMessage] = useState('None');
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // 🔵 REF (prevents Android BLE race condition)
  const pendingDevice = useRef<Device | null>(null);

  // animated glow under device image
  // start at the lower subtle value so the first cycle doesn't snap
  const glowAnim = useRef(new Animated.Value(0.25)).current;
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    glowAnim.setValue(0.25);
    
    const startGlowAnimation = () => {
      glowLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.25,
            duration: 1600,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        { resetBeforeIteration: false }
      );
      glowLoopRef.current.start();
    };

    const handle = InteractionManager.runAfterInteractions(startGlowAnimation);
    const timeoutId = setTimeout(startGlowAnimation, 500); // Fallback if no interactions
    
    return () => {
      try { handle.cancel?.(); } catch {}
      clearTimeout(timeoutId);
      glowLoopRef.current?.stop();
    };
  }, [glowAnim]);

  // 🔵 CLEANUP
  useEffect(() => {
    return () => {
      bleManager.destroy();
    };
  }, []);

  // 🔵 ANDROID PERMISSIONS
  async function requestPermissions() {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
    }
  }

  // 🔵 SCAN → STOP → DELAY → CONNECT (SAFE)
  async function startScan() {
    if (isScanning || isConnecting || connectedDevice) return;

    await requestPermissions();

    setStatus('Scanning...');
    setIsScanning(true);
    pendingDevice.current = null;

    try {
      bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.log('Scan error:', error);
          setStatus('Scan error');
          setIsScanning(false);
          return;
        }

        if (
          device?.name === NEOXALLE_NAME &&
          !pendingDevice.current
        ) {
          console.log('🔍 Neoxalle found, stopping scan...');
          pendingDevice.current = device;

          try {
            bleManager.stopDeviceScan();
          } catch (stopErr) {
            console.warn('stopDeviceScan failed:', stopErr);
          }

          setIsScanning(false);
          setStatus('Device found');

          // ⏱ CRITICAL DELAY (Android BLE stability)
          setTimeout(() => {
            connect(device).catch((err) => {
              console.warn('connect error (delayed):', err);
            });
          }, 800);
        }
      });
    } catch (e) {
      console.warn('startDeviceScan threw:', e);
      setStatus('Scan failed');
      setIsScanning(false);
    }

    // Safety stop
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  }

  // 🔵 CONNECT (HARDENED)
  async function connect(device: Device) {
    if (connectedDevice || isConnecting) return;

    setIsConnecting(true);
    setStatus('Connecting...');

    try {
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();

      try {
        connected.monitorCharacteristicForService(
          SERVICE_UUID,
          CHAR_UUID,
          (error, characteristic) => {
            if (error) {
              console.log('Notify error:', error);
              return;
            }

            if (characteristic?.value) {
              try {
                const value = Buffer
                  .from(characteristic.value, 'base64')
                  .toString('utf-8');

                console.log('📡 From Neoxalle:', value);
                setLastMessage(value);
              } catch (parseErr) {
                console.warn('Failed to parse characteristic value:', parseErr);
              }
            }
          }
        );
      } catch (monErr) {
        console.warn('monitorCharacteristicForService failed:', monErr);
      }

      setConnectedDevice(connected);
      setStatus('Connected');
      setIsConnecting(false);
      pendingDevice.current = null;

    } catch (e) {
      console.log('Connection error:', e);
      setStatus('Connection failed');
      setIsConnecting(false);
      pendingDevice.current = null;
    }
  }

  // 🔵 DISCONNECT
  async function disconnectDevice() {
    if (!connectedDevice) return;
    try {
      setStatus('Disconnecting...');
      await connectedDevice.cancelConnection();
    } catch (e) {
      console.log('Disconnect error:', e);
    }
    setConnectedDevice(null);
    setStatus('Disconnected');
  }

  // 🔵 SEND COMMAND
 /* async function sendCommand(cmd: string) {
    if (!connectedDevice) return;

    await connectedDevice.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CHAR_UUID,
      Buffer.from(cmd).toString('base64')
    );
  }*/

  // UI
  return (
    <LinearGradient
      colors={[Theme.background.darkPrimary, Theme.background.darkSecondary, Theme.neon.purpleDark]}
      start={[0, 0]}
      end={[1, 1]}
      style={{ flex: 1, padding: 24 }}
    >
      {/*HEADER*/}
     <View style={{ alignItems: 'center', marginTop: 24 }}>
      <MaskedLogoSweep />

  <Text
    style={{
      fontSize: 14,
      color: '#888',
      marginTop: -20,
    }}
  >
    Excelle with NeoXalle 
  </Text>

  {/* Status connected or not */}
  <View
    style={{
      alignItems: 'center',
      marginTop: 80,
    }}
  >
    
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: status === 'Connected' ? '#3DFF9A' : '#666',
          fontSize: 14,
          marginRight: 6,
        }}
      >
        ●
      </Text>

      <Text
        style={{
          color: status === 'Connected' ? '#3DFF9A' : '#666',
          fontSize: 14,
          fontWeight: '500',
        }}
      >
        {status}
      </Text>
    </View>
    <View style={{ marginTop: 15, width: 280, height: 180, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 12,
          width: 240,
          height: 70,
          borderRadius: 100,
          backgroundColor: Theme.glow.soft,
          transform: [
            { scale: glowAnim.interpolate({ inputRange: [0.25, 1], outputRange: [0.95, 1.12] }) }
          ],
          opacity: glowAnim.interpolate({ inputRange: [0.25, 1], outputRange: [0.45, 0.95] }),
          shadowColor: Theme.neon.purple,
          shadowRadius: 24,
        }}
      />
      {/*<Image
        source={require('../../assets/images/NeoXalle.png')}
        style={{ width: 320, height: 200, resizeMode: 'contain' }}
      />*/}
    </View>
  </View>
  
  </View>

    <BlurView intensity={60} tint="dark" style={{
  backgroundColor: Theme.glass.cardBg,
  borderColor: Theme.glass.border,
  borderWidth: 1,
  padding: 12,
  borderRadius: 12,
  marginTop: 100,
  shadowColor: Theme.neon.purpleDark,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.18,
  shadowRadius: 24,
  elevation: 8,
  overflow: 'hidden'
}}>
  <Text style={{ color: '#fff', fontWeight: '600', marginBottom: 6 }}>Device</Text>
  <Text style={{ color: '#ccc', fontSize: 13 }}>Status: {status}</Text>
</BlurView>
        

      {/* Action Buttons: Scan (🔍) and Disconnect */}
      <View style={{ flexDirection: 'row', marginTop: 15 }}>
        <TouchableOpacity
          onPress={startScan}
          disabled={isScanning || isConnecting || !!connectedDevice}
          style={{
            flex: 1,
            marginRight: 8,
            backgroundColor: 'transparent',
            paddingVertical: 16,
            borderRadius: 14,
            opacity: isScanning || isConnecting || connectedDevice ? 0.6 : 1,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.04)'
          }}
        >
          <LinearGradient
            colors={[Theme.neon.purple, Theme.neon.purpleLight]}
            start={[0, 0]}
            end={[1, 0]}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 14, opacity: 0.12 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="magnify" size={18} color={Theme.neon.purpleDark} style={{ marginRight: 8 }} />
            <Text style={{ color: Theme.neon.purpleDark, fontSize: 16, fontWeight: '700' }}>
              {isScanning ? 'Scanning...' : isConnecting ? 'Connecting...' : 'Scan Devices'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={disconnectDevice}
          disabled={!connectedDevice}
          style={{
            flex: 1,
            marginLeft: 8,
            backgroundColor: 'transparent',
            paddingVertical: 16,
            borderRadius: 14,
            opacity: connectedDevice ? 1 : 0.6,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.04)'
          }}
        >
          <LinearGradient
            colors={[Theme.neon.purple, Theme.neon.purpleLight]}
            start={[0, 0]}
            end={[1, 0]}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 14, opacity: 0.08 }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="bluetooth-off" size={18} color={connectedDevice ? Theme.neon.purpleDark : '#888'} style={{ marginRight: 8 }} />
            <Text style={{ color: connectedDevice ? Theme.neon.purpleDark : '#888', fontSize: 16, fontWeight: '700' }}>
              Disconnect
            </Text>
          </View>
        </TouchableOpacity>
      </View>
          
      
    </LinearGradient>
  );
}
