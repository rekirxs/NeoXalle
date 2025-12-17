import { Buffer } from 'buffer';
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  PermissionsAndroid,
  Platform,
  Text,
  View,
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

// 🔵 BLE CONFIG
const NEOXALLE_NAME = 'NEOXALLE';
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const CHAR_UUID    = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const bleManager = new BleManager();

export default function HomeScreen() {
  // 🔵 STATE
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [status, setStatus] = useState('Disconnected');
  const [lastMessage, setLastMessage] = useState('None');
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

        bleManager.stopDeviceScan();
        setIsScanning(false);
        setStatus('Device found');

        // ⏱ CRITICAL DELAY (Android BLE stability)
        setTimeout(() => {
          connect(device);
        }, 800);
      }
    });

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

      connected.monitorCharacteristicForService(
        SERVICE_UUID,
        CHAR_UUID,
        (error, characteristic) => {
          if (error) {
            console.log('Notify error:', error);
            return;
          }

          if (characteristic?.value) {
            const value = Buffer
              .from(characteristic.value, 'base64')
              .toString('utf-8');

            console.log('📡 From Neoxalle:', value);
            setLastMessage(value);
          }
        }
      );

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

  // 🔵 SEND COMMAND
  async function sendCommand(cmd: string) {
    if (!connectedDevice) return;

    await connectedDevice.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CHAR_UUID,
      Buffer.from(cmd).toString('base64')
    );
  }

  // 🔵 UI (REAL APP)
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 32, fontWeight: 'bold', textAlign: 'center' }}>
        NEOXALLE
      </Text>

      <View style={{ alignItems: 'center', marginVertical: 20 }}>
        <Text
          style={{
            fontSize: 18,
            color: status === 'Connected' ? 'green' : 'red',
          }}
        >
          ● {status}
        </Text>
      </View>

      {connectedDevice && (
        <View style={{ marginVertical: 20 }}>
          <Button title="START" onPress={() => sendCommand('START')} />
        </View>
      )}

      <Text style={{ textAlign: 'center', marginTop: 10 }}>
        Neoxalle says: {lastMessage}
      </Text>

      {!connectedDevice && (
        <View style={{ marginTop: 30 }}>
          <Button
            title={
              isScanning
                ? 'Scanning...'
                : isConnecting
                ? 'Connecting...'
                : 'Connect Neoxalle'
            }
            onPress={startScan}
            disabled={isScanning || isConnecting}
          />
        </View>
      )}
    </View>
  );
}
