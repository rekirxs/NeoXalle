import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Buffer } from 'buffer';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
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
      fontSize: 50
      ,
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
      marginTop: 6,
    }}
  >
    Excelle with NeoXalle 
  </Text>

  {/* Status connected or not */}
  <View
    style={{
      alignItems: 'center',
      marginTop: 100,
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
    <Image
      source={require('../../assets/images/NeoXalle.png')}
      style={{ width: 280, height: 160, resizeMode: 'contain', marginTop: 15, scaleX: 2, scaleY: 2  }}
    />
  </View>
  
  </View>

     <View style={{
  backgroundColor: '#0F1113',
  borderColor: '#232428',
  borderWidth: 1,
  padding: 12,
  borderRadius: 12,
  marginTop: 100,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 6,
  elevation: 6
}}>
  <Text style={{ color: '#fff', fontWeight: '600', marginBottom: 6 }}>Device</Text>
  <Text style={{ color: '#ccc', fontSize: 13 }}>Status: {status}</Text>
</View>
        

      {/* Action Buttons: Scan (🔍) and Disconnect */}
      <View style={{ flexDirection: 'row', marginTop: 15 }}>
        <TouchableOpacity
          onPress={startScan}
          disabled={isScanning || isConnecting || !!connectedDevice}
          style={{
            flex: 1,
            marginRight: 8,
            backgroundColor: '#A855F7',
            paddingVertical: 16,
            borderRadius: 14,
            opacity: isScanning || isConnecting || connectedDevice ? 0.6 : 1,
            alignItems: 'center'
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="magnify" size={18} color="#000" style={{ marginRight: 8 }} />
            <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>
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
            backgroundColor: connectedDevice ? '#FF6B6B' : '#3A3A3A',
            paddingVertical: 16,
            borderRadius: 14,
            opacity: connectedDevice ? 1 : 0.6,
            alignItems: 'center'
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="bluetooth-off" size={18} color={connectedDevice ? '#000' : '#888'} style={{ marginRight: 8 }} />
            <Text style={{ color: connectedDevice ? '#000' : '#888', fontSize: 16, fontWeight: '700' }}>
              Disconnect
            </Text>
          </View>
        </TouchableOpacity>
      </View>
          
      
      </View>
      
  );
}
