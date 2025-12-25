import { MaterialCommunityIcons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { Buffer } from 'buffer';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PermissionsAndroid,
  Platform,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { Theme } from '../constants/theme';


const NEOXALLE_NAME = 'NEOXALLE';
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const bleManager = new BleManager();
function PodImage({ connected, loading }: { connected: boolean; loading: boolean }) {
  const glowX = useRef(new Animated.Value(-950)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const unlockScale = useRef(new Animated.Value(1)).current;
  const wasConnected = useRef(false);
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const burst1Scale = useRef(new Animated.Value(1)).current;
  const burst1Opacity = useRef(new Animated.Value(0)).current;
  const burst2Scale = useRef(new Animated.Value(1)).current;
  const burst2Opacity = useRef(new Animated.Value(0)).current;
  const burst3Scale = useRef(new Animated.Value(1)).current;
  const burst3Opacity = useRef(new Animated.Value(0)).current;
  
  const spinnerRotate = useRef(new Animated.Value(0)).current;
  const spinnerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const spinnerScale = useRef(new Animated.Value(1)).current;
  const spinnerScaleLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const reset = () => {
      glowX.setValue(-950);
      glowOpacity.setValue(0);
      unlockScale.setValue(1);
      pulseScale.setValue(1);
      pulseOpacity.setValue(0);
    };

    if (!connected) {
      if (glowLoopRef.current) { try { glowLoopRef.current.stop(); } catch {} glowLoopRef.current = null; }
      if (pulseLoopRef.current) { try { pulseLoopRef.current.stop(); } catch {} pulseLoopRef.current = null; }
      if (spinnerLoopRef.current) { try { spinnerLoopRef.current.stop(); } catch {} spinnerLoopRef.current = null; }
      if (spinnerScaleLoopRef.current) { try { spinnerScaleLoopRef.current.stop(); } catch {} spinnerScaleLoopRef.current = null; }

      if (wasConnected.current) {
        Animated.parallel([
          Animated.timing(glowOpacity, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(unlockScale, { toValue: 0.98, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(unlockScale, { toValue: 1, duration: 160, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        ]).start(() => { reset(); wasConnected.current = false; });
      } else { reset(); wasConnected.current = false; }

      
      spinnerRotate.setValue(0);
      const spinnerDuration = loading ? 900 : 1400;
      const spinLoop = Animated.loop(Animated.timing(spinnerRotate, { toValue: 1, duration: spinnerDuration, easing: Easing.linear, useNativeDriver: true }));
      spinnerLoopRef.current = spinLoop;
      spinLoop.start();
      
      spinnerScale.setValue(1);
      const zoomLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(spinnerScale, { toValue: 1.03, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(spinnerScale, { toValue: 0.97, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
      spinnerScaleLoopRef.current = zoomLoop;
      zoomLoop.start();
      return;
    }

   
    if (glowLoopRef.current) { try { glowLoopRef.current.stop(); } catch {} glowLoopRef.current = null; }
    if (pulseLoopRef.current) { try { pulseLoopRef.current.stop(); } catch {} pulseLoopRef.current = null; }
    if (spinnerLoopRef.current) { try { spinnerLoopRef.current.stop(); } catch {} spinnerLoopRef.current = null; }
    if (spinnerScaleLoopRef.current) { try { spinnerScaleLoopRef.current.stop(); } catch {} spinnerScaleLoopRef.current = null; }

    Animated.sequence([
      Animated.timing(unlockScale, { toValue: 1.02, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(unlockScale, { toValue: 1, duration: 160, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      wasConnected.current = true;
      Animated.timing(glowOpacity, { toValue: 0.3, duration: 220, easing: Easing.linear, useNativeDriver: true }).start(() => {
        glowX.setValue(-950);
        const sweepDuration = loading ? 2100 : 2400;
        const loop = Animated.loop(Animated.sequence([
          Animated.timing(glowX, { toValue: 450, duration: sweepDuration, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(glowX, { toValue: -950, duration: sweepDuration, easing: Easing.linear, useNativeDriver: true })
        ]));
        glowLoopRef.current = loop; loop.start();

        pulseOpacity.setValue(0.08); pulseScale.setValue(1);
        const pulseLoop = Animated.loop(Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseOpacity, { toValue: 0.18, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pulseScale, { toValue: 1.03, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseOpacity, { toValue: 0.08, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pulseScale, { toValue: 1.0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        ]));
        pulseLoopRef.current = pulseLoop; pulseLoop.start();

        
        burst1Scale.setValue(0.95); burst1Opacity.setValue(0.0);
        burst2Scale.setValue(0.95); burst2Opacity.setValue(0.0);
        burst3Scale.setValue(0.95); burst3Opacity.setValue(0.0);
        Animated.sequence([
          Animated.parallel([
            Animated.timing(burst1Opacity, { toValue: 0.25, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(burst1Scale, { toValue: 1.26, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
          Animated.timing(burst1Opacity, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]).start();
        setTimeout(() => {
          Animated.sequence([
            Animated.parallel([
              Animated.timing(burst2Opacity, { toValue: 0.22, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(burst2Scale, { toValue: 1.22, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]),
            Animated.timing(burst2Opacity, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]).start();
        }, 120);
        setTimeout(() => {
          Animated.sequence([
            Animated.parallel([
              Animated.timing(burst3Opacity, { toValue: 0.18, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(burst3Scale, { toValue: 1.18, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]),
            Animated.timing(burst3Opacity, { toValue: 0, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]).start();
        }, 240);
      });
    });
  }, [connected, loading, glowX, glowOpacity, unlockScale, pulseScale, pulseOpacity, spinnerRotate, spinnerScale, burst1Scale, burst1Opacity, burst2Scale, burst2Opacity, burst3Scale, burst3Opacity]);

  return (
    <View style={{ marginBottom: 30, alignItems: 'center', justifyContent: 'center', width: 240, height: 240 }}>
      <Animated.View style={{ transform: [{ scale: unlockScale }] }}>
        <Image
          source={require('../assets/images/pod-transparent.png')}
          style={{ width: 220, height: 220, resizeMode: 'contain', tintColor: connected ? undefined : '#888', opacity: connected ? 1 : 0.7 }}
        />
      </Animated.View>

      
      {!connected && (
        <View style={{ position: 'absolute', width: 240, height: 240 }}>
          
          <Animated.View style={{ position: 'absolute', left: 120 - 12, top: 120 - 12, transform: [{ scale: spinnerScale }] }}>
            <MaterialCommunityIcons name="magnify" size={24} color="#000" />
          </Animated.View>
        
          <Animated.View
            style={{ position: 'absolute', width: 240, height: 240, transform: [
              { rotate: spinnerRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
              { scale: spinnerScale },
            ] }}
          >
            {Array.from({ length: 12 }).map((_, i: number) => {
              const center = 120;
              const radius = 118;
              const angle = (2 * Math.PI * i) / 12;
              const size = 6;
              const left = center + radius * Math.cos(angle) - size / 2;
              const top = center + radius * Math.sin(angle) - size / 2;
              const ramp = [1.0, 0.85, 0.7, 0.55, 0.4, 0.3, 0.22, 0.16, 0.12, 0.1, 0.08, 0.06];
              const alpha = ramp[i % ramp.length];
              return <View key={`dot-${i}`} style={{ position: 'absolute', left, top, width: size, height: size, borderRadius: size / 2, backgroundColor: `rgba(154,160,166,${alpha})` }} />;
            })}
          </Animated.View>
        </View>
      )}

    
      {connected && (
        <MaskedView style={{ position: 'absolute', width: 220, height: 220 }} maskElement={<Image source={require('../assets/images/pod-transparent.png')} style={{ width: 220, height: 220, resizeMode: 'contain' }} />}>
          <Animated.View style={{ width: 900, height: 220, opacity: glowOpacity, transform: [{ translateX: glowX }] }}>
            <LinearGradient colors={['transparent', Theme.neon.purpleLight, Theme.neon.purple, 'transparent']} start={[0, 0]} end={[1, 0]} style={{ flex: 1 }} />
          </Animated.View>
        </MaskedView>
      )}

      
      {connected && (
        <Animated.View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 2, borderColor: Theme.neon.purpleLight, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }} />
      )}

      
      {connected && (
        <>
          <Animated.View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 2, borderColor: Theme.neon.purpleLight, opacity: burst1Opacity, transform: [{ scale: burst1Scale }] }} />
          <Animated.View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 2, borderColor: Theme.neon.purpleLight, opacity: burst2Opacity, transform: [{ scale: burst2Scale }] }} />
          <Animated.View style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 2, borderColor: Theme.neon.purpleLight, opacity: burst3Opacity, transform: [{ scale: burst3Scale }] }} />
        </>
      )}

    </View>
  );
}

export default function ConnectScreen() {
  const router = useRouter();
  
  
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [status, setStatus] = useState('Disconnected');
  const [, setLastMessage] = useState('None');
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [scanDotCount, setScanDotCount] = useState(0);
  const [connectDotCount, setConnectDotCount] = useState(0);

 
  const pendingDevice = useRef<Device | null>(null);

  
  useEffect(() => {
    return () => {
      bleManager.destroy();
    };
  }, []);

 
  useEffect(() => {
    if (isScanning) {
      setScanDotCount(1);
      const id = setInterval(() => {
        setScanDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
      }, 500);
      return () => clearInterval(id);
    } else {
      setScanDotCount(0);
    }
  }, [isScanning]);

  
  useEffect(() => {
    if (isConnecting) {
      setConnectDotCount(1);
      const id = setInterval(() => {
        setConnectDotCount((prev) => (prev >= 3 ? 1 : prev + 1));
      }, 500);
      return () => clearInterval(id);
    } else {
      setConnectDotCount(0);
    }
  }, [isConnecting]);

  
  async function requestPermissions() {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
    }
  }

 
  async function startScan() {
    if (isScanning || isConnecting || connectedDevice) return;

    await requestPermissions();

    setStatus('Scanning...');
    setIsScanning(true);
    pendingDevice.current = null;

    try {
      bleManager.startDeviceScan(null, null, (error: any, device: Device | null) => {
        if (error) {
          console.log('Scan error:', error);
          setStatus('Scan error');
          setIsScanning(false);
          return;
        }

        if (device?.name === NEOXALLE_NAME && !pendingDevice.current) {
          console.log('🔍 Neoxalle found, stopping scan...');
          pendingDevice.current = device;

          try {
            bleManager.stopDeviceScan();
          } catch (stopErr) {
            console.warn('stopDeviceScan failed:', stopErr);
          }

          setIsScanning(false);
          setStatus('Device found');

         
          setTimeout(() => {
            connect(device).catch((err: unknown) => {
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

 
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  }

 
  async function connect(device: Device) {
    if (connectedDevice || isConnecting) return;

    setIsConnecting(true);
    setStatus('Connecting...');

    try {
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();

      // Monitor disconnection
      bleManager.onDeviceDisconnected(connected.id, (error: any, disconnectedDevice: Device | null) => {
        console.log('Device disconnected:', disconnectedDevice?.id);
        if (error) {
          console.log('Disconnection error:', error);
        }
        setConnectedDevice(null);
        setStatus('Disconnected');
        setIsConnecting(false);
        pendingDevice.current = null;
      });

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

                console.log('From Neoxalle:', value);
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

 
  async function disconnectDevice() {
    if (!connectedDevice) return;
    try {
      setStatus('Disconnecting...');
      await connectedDevice.cancelConnection();
      setConnectedDevice(null);
      setStatus('Disconnected');
      setIsConnecting(false);
      pendingDevice.current = null;
      console.log('Disconnected and cleaned up');
    } catch (e) {
      console.log('Disconnect error:', e);
      setConnectedDevice(null);
      setStatus('Disconnected');
      setIsConnecting(false);
      pendingDevice.current = null;
    }
  }

  
  return (
    <LinearGradient
      colors={[Theme.neon.purpleDark, '#1a1a1a', '#0d0d0d']}
      start={[0, 0]}
      end={[0, 1]}
      style={{ flex: 1, padding: 24 }}
    >
   
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          position: 'absolute',
          top: 40,
          left: 24,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.1)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginTop: 80 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: Theme.neon.purpleLight, marginBottom: 40 }}>
          HUB Connection
        </Text>

       
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 30 }}>
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
            {isScanning ? `Scanning${'.'.repeat(scanDotCount)}` : isConnecting ? `Connecting${'.'.repeat(connectDotCount)}` : status}
          </Text>
        </View>

        
        <PodImage connected={!!connectedDevice} loading={isScanning || isConnecting} />

       
        <BlurView
          intensity={60}
          tint="dark"
          style={{
            backgroundColor: Theme.glass.cardBg,
            borderColor: Theme.glass.border,
            borderWidth: 1,
            padding: 16,
            borderRadius: 12,
            width: '100%',
            marginBottom: 20,
            shadowColor: Theme.neon.purpleDark,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 24,
            elevation: 8,
            overflow: 'hidden',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', marginBottom: 6 }}>Device</Text>
          <Text style={{ color: '#ccc', fontSize: 13 }}>Status: {isScanning ? `Scanning${'.'.repeat(scanDotCount)}` : isConnecting ? `Connecting${'.'.repeat(connectDotCount)}` : status}</Text>
        </BlurView>

        <View style={{ flexDirection: 'row', width: '100%' }}>
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
              borderColor: 'rgba(255,255,255,0.04)',
            }}
          >
            <LinearGradient
              colors={[Theme.neon.purple, Theme.neon.purpleLight]}
              start={[0, 0]}
              end={[1, 0]}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 14, opacity: 0.12 }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="magnify" size={18} color={Theme.neon.purpleLight} style={{ marginRight: 8 }} />
              <Text style={{ color: Theme.neon.purpleLight, fontSize: 16, fontWeight: '700' }}>
                {isScanning ? `Scanning${'.'.repeat(scanDotCount)}` : isConnecting ? `Connecting${'.'.repeat(connectDotCount)}` : 'Scan Devices'}
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
              borderColor: 'rgba(255,255,255,0.04)',
            }}
          >
            <LinearGradient
              colors={[Theme.neon.purple, Theme.neon.purpleLight]}
              start={[0, 0]}
              end={[1, 0]}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 14, opacity: 0.08 }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="bluetooth-off" size={18} color={connectedDevice ? Theme.neon.purpleLight : '#888'} style={{ marginRight: 8 }} />
              <Text style={{ color: connectedDevice ? Theme.neon.purpleLight : '#888', fontSize: 16, fontWeight: '700' }}>
                Disconnect
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}
