import { Buffer } from 'buffer';
import { useEffect, useRef, useState } from 'react';
import {
  PermissionsAndroid,
  Platform,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

// Configuracion del BLUETOOTH
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
    <View 
      style={{  
        flex: 1, 
        backgroundColor: '#0B0B0F', 
        padding: 24 
      }}
    >
      {/*HEADER*/}
     <View style={{ alignItems: 'center', marginTop: 40 }}>
  <Text
    style={{
      fontSize: 32,
      fontWeight: '700',
      color: '#9B4DFF',
    }}
  >
    NEOXALLE
  </Text>

  <Text
    style={{
      fontSize: 14,
      color: '#888',
      marginTop: 4,
    }}
  >
    Excelle with NeoXalle 
  </Text>

    {/* Status connected or not */}
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
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
  </View>


        

      {/* Action Button */}
      <TouchableOpacity onPress={startScan} disabled={isScanning || isConnecting} 
        style={{marginTop: 40, backgroundColor: '#A855F7', paddingVertical: 16, borderRadius: 14, opacity: isScanning || isConnecting ? 0.6 : 1}}
        > 
          <Text style={{color: '#000', fontSize: 16, fontWeight: '700', textAlign: 'center'}}
         > {isScanning ? 'Scanning...' : isConnecting ? 'Connecting...' : 'Connect to Neoxalle'}</Text>
          
          </TouchableOpacity>
          
      
      </View>
  );
}
