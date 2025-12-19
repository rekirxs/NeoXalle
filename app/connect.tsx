import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Buffer } from 'buffer';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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

export default function ConnectScreen() {
  const router = useRouter();
  
  // 🔵 STATE
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [status, setStatus] = useState('Disconnected');
  const [, setLastMessage] = useState('None');
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // 🔵 REF (prevents Android BLE race condition)
  const pendingDevice = useRef<Device | null>(null);

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

  // UI
  return (
    <LinearGradient
      colors={[Theme.neon.purpleDark, '#1a1a1a', '#0d0d0d']}
      start={[0, 0]}
      end={[0, 1]}
      style={{ flex: 1, padding: 24 }}
    >
      {/* Back Button */}
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
          Connect Device
        </Text>

        {/* Status */}
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
            {status}
          </Text>
        </View>

        {/* Device Info Card */}
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
          <Text style={{ color: '#ccc', fontSize: 13 }}>Status: {status}</Text>
        </BlurView>

        {/* Action Buttons */}
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
