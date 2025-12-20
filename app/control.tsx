import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Buffer } from 'buffer';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Theme } from '../constants/theme';

const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const bleManager = new BleManager();

export default function ControlScreen() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [connectedDevice, setConnectedDevice] = useState<any>(null);

  // Check connection status when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      bleManager.connectedDevices([SERVICE_UUID]).then((devices) => {
        if (devices.length > 0) {
          setIsConnected(true);
          setConnectedDevice(devices[0]);
          setupNotifications(devices[0]);
        } else {
          setIsConnected(false);
          setConnectedDevice(null);
        }
      }).catch(() => {
        setIsConnected(false);
        setConnectedDevice(null);
      });
    }, [])
  );

  // Setup notifications to receive messages from ESP32
  const setupNotifications = async (device: any) => {
    try {
      device.monitorCharacteristicForService(
        SERVICE_UUID,
        CHAR_UUID,
        (error: any, characteristic: any) => {
          if (error) {
            console.log('Notify error:', error);
            return;
          }

          if (characteristic?.value) {
            try {
              const value = Buffer
                .from(characteristic.value, 'base64')
                .toString('utf-8');
              
              console.log('📡 From ESP32:', value);
              setMessages(prev => [...prev, `📩 ${new Date().toLocaleTimeString()}: ${value}`]);
            } catch (parseErr) {
              console.warn('Failed to parse:', parseErr);
            }
          }
        }
      );
    } catch (err) {
      console.warn('Failed to setup notifications:', err);
    }
  };

  // Send command to ESP32
  const sendCommand = async () => {
    if (!isConnected || !connectedDevice || !commandInput.trim()) return;

    try {
      const encoded = Buffer.from(commandInput, 'utf-8').toString('base64');
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHAR_UUID,
        encoded
      );
      
      setMessages(prev => [...prev, `📤 ${new Date().toLocaleTimeString()}: ${commandInput}`]);
      setCommandInput('');
      console.log('✅ Command sent:', commandInput);
    } catch (err) {
      console.error('Failed to send command:', err);
      setMessages(prev => [...prev, `❌ Error: Failed to send command`]);
    }
  };

  // Quick command buttons
  const quickCommands = [
    { label: 'Status', value: 'STATUS' },
    { label: 'Test', value: 'TEST' },
    { label: 'Reset', value: 'RESET' },
    { label: 'Hello', value: 'HELLO' },
  ];

  return (
    <LinearGradient
      colors={[Theme.neon.purpleDark, '#1a1a1a', '#0d0d0d']}
      start={[0, 0]}
      end={[0, 1]}
      style={{ flex: 1, padding: 24 }}
    >
      <View style={{ marginTop: 40 }}>
        <Image
          source={require('../assets/images/Control.png')}
          style={{ width: 320, height: 120, resizeMode: 'contain', alignSelf: 'center' }}
        />

        {/* Connection Status */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
          <Text style={{ color: isConnected ? '#3DFF9A' : '#666', fontSize: 14, marginRight: 6 }}>●</Text>
          <Text style={{ color: isConnected ? '#3DFF9A' : '#666', fontSize: 14, fontWeight: '500' }}>
            {isConnected ? 'Connected to Master' : 'Not Connected'}
          </Text>
        </View>

        {!isConnected && (
          <Text style={{ marginTop: 8, color: '#888', textAlign: 'center', fontSize: 13 }}>
            Connect to NeoXalle from the Bluetooth screen
          </Text>
        )}

        {isConnected && (
          <>
            {/* Quick Commands */}
            <View style={{ marginTop: 24 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
                Quick Commands
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {quickCommands.map((cmd) => (
                  <TouchableOpacity
                    key={cmd.value}
                    onPress={() => {
                      setCommandInput(cmd.value);
                      setTimeout(() => sendCommand(), 100);
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 10,
                      backgroundColor: 'rgba(160,32,192,0.2)',
                      borderWidth: 1,
                      borderColor: 'rgba(160,32,192,0.4)',
                    }}
                  >
                    <Text style={{ color: Theme.neon.purpleLight, fontSize: 14, fontWeight: '600' }}>
                      {cmd.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom Command Input */}
            <View style={{ marginTop: 24 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
                Send Custom Command
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={commandInput}
                  onChangeText={setCommandInput}
                  placeholder="Enter command..."
                  placeholderTextColor="#666"
                  onSubmitEditing={sendCommand}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    color: '#fff',
                    fontSize: 14,
                  }}
                />
                <TouchableOpacity
                  onPress={sendCommand}
                  disabled={!commandInput.trim()}
                  style={{
                    backgroundColor: commandInput.trim() ? Theme.neon.purple : 'rgba(255,255,255,0.1)',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 10,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="send" size={20} color={commandInput.trim() ? '#fff' : '#666'} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Message Log */}
            <View style={{ marginTop: 24, flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
                Communication Log
              </Text>
              <BlurView
                intensity={60}
                tint="dark"
                style={{
                  backgroundColor: Theme.glass.cardBg,
                  borderColor: Theme.glass.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  flex: 1,
                  maxHeight: 300,
                  overflow: 'hidden',
                }}
              >
                <ScrollView
                  style={{ padding: 16 }}
                  contentContainerStyle={{ flexGrow: 1 }}
                >
                  {messages.length === 0 ? (
                    <Text style={{ color: '#666', fontSize: 13, textAlign: 'center', marginTop: 20 }}>
                      No messages yet
                    </Text>
                  ) : (
                    messages.map((msg, idx) => (
                      <Text key={idx} style={{ color: '#ccc', fontSize: 12, marginBottom: 8, fontFamily: 'monospace' }}>
                        {msg}
                      </Text>
                    ))
                  )}
                </ScrollView>
              </BlurView>
              
              {messages.length > 0 && (
                <TouchableOpacity
                  onPress={() => setMessages([])}
                  style={{ marginTop: 8, alignSelf: 'center' }}
                >
                  <Text style={{ color: '#888', fontSize: 13 }}>Clear Log</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </LinearGradient>
  );
}
