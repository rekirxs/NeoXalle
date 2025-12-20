import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { Theme } from '../constants/theme';

const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const bleManager = new BleManager();

export default function ControlScreen() {
  const [slaveCount, setSlaveCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useFocusEffect(
    useCallback(() => {
      bleManager.connectedDevices([SERVICE_UUID]).then((devices) => {
        setIsConnected(devices.length > 0);
      }).catch(() => {
        setIsConnected(false);
      });
    }, [])
  );

  return (
    <LinearGradient
      colors={[Theme.neon.purpleDark, '#1a1a1a', '#0d0d0d']}
      start={[0, 0]}
      end={[0, 1]}
      style={{ flex: 1 }}
    >
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: 40 }}>
          <Image
            source={require('../assets/images/Control.png')}
            style={{ width: 320, height: 120, resizeMode: 'contain', alignSelf: 'center' }}
          />

          <Text style={{ marginTop: 12, color: '#aaa', textAlign: 'center' }}>
            Control your NeoXalle pods here
          </Text>

        {/* Slave Management */}
        {isConnected ? (
          <BlurView
            intensity={60}
            tint="dark"
            style={{
              backgroundColor: Theme.glass.cardBg,
              borderColor: Theme.glass.border,
              borderWidth: 1,
              padding: 20,
              borderRadius: 12,
              width: '100%',
              marginTop: 32,
              overflow: 'hidden',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', marginBottom: 20, textAlign: 'center', fontSize: 16 }}>Connected Slaves</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity
                onPress={() => setSlaveCount(Math.max(0, slaveCount - 1))}
                disabled={slaveCount === 0}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: slaveCount === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(160,32,192,0.2)',
                  borderWidth: 1,
                  borderColor: slaveCount === 0 ? 'rgba(255,255,255,0.1)' : Theme.neon.purple,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialCommunityIcons name="minus" size={28} color={slaveCount === 0 ? '#666' : Theme.neon.purpleLight} />
              </TouchableOpacity>

              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 56, fontWeight: '700', color: Theme.neon.purpleLight }}>{slaveCount}</Text>
                <Text style={{ fontSize: 13, color: '#888', marginTop: -8 }}>of 4 slaves</Text>
              </View>

              <TouchableOpacity
                onPress={() => setSlaveCount(Math.min(4, slaveCount + 1))}
                disabled={slaveCount === 4}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: slaveCount === 4 ? 'rgba(255,255,255,0.05)' : 'rgba(160,32,192,0.2)',
                  borderWidth: 1,
                  borderColor: slaveCount === 4 ? 'rgba(255,255,255,0.1)' : Theme.neon.purple,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialCommunityIcons name="plus" size={28} color={slaveCount === 4 ? '#666' : Theme.neon.purpleLight} />
              </TouchableOpacity>
            </View>
          </BlurView>
        ) : (
          <Text style={{ marginTop: 32, color: '#666', textAlign: 'center', fontSize: 14 }}>
            Connect to NeoXalle Master to manage slaves
          </Text>
        )}

        {/* Slave Status List */}
        {isConnected && slaveCount > 0 && (
          <View style={{ marginTop: 16, gap: 12 }}>
            {Array.from({ length: slaveCount }).map((_, index) => (
              <BlurView
                key={index}
                intensity={60}
                tint="dark"
                style={{
                  backgroundColor: Theme.glass.cardBg,
                  borderColor: Theme.glass.border,
                  borderWidth: 1,
                  padding: 16,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* Slave Name/Number */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: 'rgba(160,32,192,0.2)',
                      borderWidth: 1,
                      borderColor: Theme.neon.purple,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{ color: Theme.neon.purpleLight, fontWeight: '700', fontSize: 16 }}>{index + 1}</Text>
                    </View>
                    <View>
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Slave {index + 1}</Text>
                      <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                        {index % 3 === 0 ? 'Connected' : index % 3 === 1 ? 'Connecting...' : 'Idle'}
                      </Text>
                    </View>
                  </View>

                  {/* Battery & Signal */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {/* Signal Strength */}
                    <View style={{ alignItems: 'center' }}>
                      <MaterialCommunityIcons 
                        name="signal" 
                        size={16} 
                        color={index % 2 === 0 ? '#3DFF9A' : '#FFA500'} 
                      />
                      <Text style={{ color: '#888', fontSize: 10, marginTop: 2 }}>
                        {index % 2 === 0 ? 'Strong' : 'Weak'}
                      </Text>
                    </View>

                    {/* Battery */}
                    <View style={{ alignItems: 'center' }}>
                      <MaterialCommunityIcons 
                        name={index % 3 === 0 ? 'battery-high' : index % 3 === 1 ? 'battery-medium' : 'battery-low'} 
                        size={18} 
                        color={index % 3 === 0 ? '#3DFF9A' : index % 3 === 1 ? '#FFA500' : '#FF4444'} 
                      />
                      <Text style={{ color: '#888', fontSize: 10, marginTop: 2 }}>
                        {index % 3 === 0 ? '85%' : index % 3 === 1 ? '52%' : '18%'}
                      </Text>
                    </View>
                  </View>
                </View>
              </BlurView>
            ))}
          </View>
        )}
      </View>
      </ScrollView>
    </LinearGradient>
  );
}
