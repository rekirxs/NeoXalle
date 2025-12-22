import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BleManager, Characteristic, Device } from 'react-native-ble-plx';
import { Theme } from '../constants/theme';
import { saveGameRecord } from './database';

const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const bleManager = new BleManager();

interface SlaveInfo {
  id: number;
  connected: boolean;
  address?: string;
  lastEvent?: string;
  responseTime?: number;
}

export default function ControlScreen() {
  const [isConnected, setIsConnected] = useState(false);
  const [slaves, setSlaves] = useState<SlaveInfo[]>([]);
  const [gameMode, setGameMode] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [gameDuration, setGameDuration] = useState(30);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [scores, setScores] = useState<{[key: number]: number}>({});
  
  const deviceRef = useRef<Device | null>(null);
  const charRef = useRef<Characteristic | null>(null);
  const timerRef = useRef<number | null>(null);
  const messageBufferRef = useRef<string>('');
  
  const handleMasterMessage = useCallback((message: string) => {
    console.log('📥 Parsing message:', message);
    
    try {
      const data = JSON.parse(message);
      console.log('✅ Parsed data:', JSON.stringify(data));
      
      if (data.event === 'status') {
        // Update slave connection status
        console.log('📊 Status update - slaves:', data.slaves);
        setSlaves(data.slaves || []);
      } else if (data.event === 'slave_connected') {
        console.log(`🔗 Slave ${data.slave} connected at ${data.address}`);
      } else if (data.event === 'slave_disconnected') {
        console.log(`⚠️ Slave ${data.slave} disconnected`);
      } else if (data.event === 'light_on') {
        console.log(`💡 Slave ${data.slave} light turned on`);
      } else if (data.event === 'pressed') {
        // Slave was pressed!
        const slaveId = data.slave;
        const responseTime = data.time;
        
        console.log(`Slave ${slaveId} pressed in ${responseTime}ms`);
        
        // Update score
        setScores(prev => ({
          ...prev,
          [slaveId]: (prev[slaveId] || 0) + 1
        }));
        
        // Update slave info
        setSlaves(prev => prev.map(s => 
          s.id === slaveId 
            ? { ...s, lastEvent: 'pressed', responseTime } 
            : s
        ));
      }
    } catch (e) {
      console.error('Failed to parse master message:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Reset message buffer on focus
      messageBufferRef.current = '';
      
      // Check if master is connected
      bleManager.connectedDevices([SERVICE_UUID]).then(async (devices) => {
        if (devices.length > 0) {
          setIsConnected(true);
          deviceRef.current = devices[0];
          
          // Request larger MTU for longer messages
          try {
            const mtu = await deviceRef.current.requestMTU(512);
            console.log('📏 MTU set to:', mtu);
          } catch (e) {
            console.log('⚠️ MTU request failed, using default:', e);
          }
          
          // Get characteristic
          const device = await deviceRef.current.discoverAllServicesAndCharacteristics();
          const services = await device.services();
          const service = services.find(s => s.uuid === SERVICE_UUID);
          if (service) {
            const chars = await service.characteristics();
            const char = chars.find(c => c.uuid === CHAR_UUID);
            if (char) {
              charRef.current = char;
              
              // Subscribe to notifications from master
              char.monitor((error, characteristic) => {
                if (error) {
                  console.error('Monitor error:', error);
                  return;
                }
                
                if (characteristic?.value) {
                  try {
                    const data = atob(characteristic.value);
                    console.log('📡 Raw from Master:', data);
                    
                    // Try direct parse first (for complete messages)
                    try {
                      const parsed = JSON.parse(data);
                      console.log('✅ Direct parse success:', parsed);
                      handleMasterMessage(JSON.stringify(parsed));
                      return;
                    } catch (e) {
                      console.log('⚠️ Not complete JSON, buffering...');
                    }
                    
                    // Buffer the data
                    messageBufferRef.current += data;
                    console.log('📦 Buffer now:', messageBufferRef.current);
                    
                    // Try to parse complete JSON messages
                    let startIndex = 0;
                    for (let i = 0; i < messageBufferRef.current.length; i++) {
                      if (messageBufferRef.current[i] === '{') {
                        startIndex = i;
                      } else if (messageBufferRef.current[i] === '}') {
                        // Found a complete JSON object
                        const jsonStr = messageBufferRef.current.substring(startIndex, i + 1);
                        try {
                          JSON.parse(jsonStr); // Validate it's valid JSON
                          console.log('✅ Buffered parse success:', jsonStr);
                          handleMasterMessage(jsonStr);
                          // Remove processed message from buffer
                          messageBufferRef.current = messageBufferRef.current.substring(i + 1);
                          i = -1; // Reset to start searching again
                          startIndex = 0;
                        } catch (e) {
                          // Not a complete valid JSON yet, continue
                          console.log('⚠️ Parse failed, continuing...');
                        }
                      }
                    }
                  } catch (error) {
                    console.error('❌ Processing error:', error);
                  }
                }
              });
              
              // Request slave scan
              sendCommand('{"command":"scan_slaves"}');
            }
          }
        } else {
          setIsConnected(false);
        }
      }).catch((err) => {
        console.error('Connection check error:', err);
        setIsConnected(false);
      });
      
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }, [handleMasterMessage])
  );
  
  const sendCommand = (command: string) => {
    if (!charRef.current) {
      console.error('No characteristic available');
      return;
    }
    
    console.log('Sending to master:', command);
    charRef.current.writeWithResponse(btoa(command))
      .catch(err => console.error('Write error:', err));
  };
  
  const startGame = (mode: string) => {
    const connectedSlaves = slaves.filter(s => s.connected);
    
    if (connectedSlaves.length < 2) {
      Alert.alert('Not Ready', 'Please wait for at least 2 slaves to connect');
      return;
    }
    
    setGameMode('playing');
    setTimeRemaining(gameDuration);
    setScores({});
    
    // Send start game command
    sendCommand(JSON.stringify({
      command: 'start_game',
      mode: mode,
      duration: gameDuration,
      slaves: connectedSlaves.length
    }));
    
    // Start timer
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          stopGame();
          return 0;
        }
        return prev - 1;
      });
      
      // Randomly light up a slave
      const randomSlave = connectedSlaves[Math.floor(Math.random() * connectedSlaves.length)];
      sendCommand(JSON.stringify({
        command: 'light_on',
        slave: randomSlave.id,
        color: 'random'
      }));
    }, 1000);
  };
  
  const stopGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setGameMode('finished');
    
    sendCommand('{"command":"stop_game"}');
    
    // Save game to database
    const winner = Object.entries(scores).reduce((max, [id, score]) => 
      score > (scores[max] || 0) ? parseInt(id) : max, 
      parseInt(Object.keys(scores)[0] || '0')
    );
    
    saveGameRecord({
      timestamp: Date.now(),
      gameType: 'Reaction Game',
      duration: gameDuration,
      players: Object.keys(scores).length,
      scores: scores,
      winner: winner,
    });
  };
  
  const resetGame = () => {
    setGameMode('idle');
    setScores({});
    setTimeRemaining(gameDuration);
  };
  
  const testSlave = (slaveId: number) => {
    sendCommand(JSON.stringify({
      command: 'light_on',
      slave: slaveId,
      color: 'random'
    }));
    
    setTimeout(() => {
      sendCommand(JSON.stringify({
        command: 'light_off',
        slave: slaveId
      }));
    }, 2000);
  };

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

          <Text style={{ marginTop: 12, color: '#aaa', textAlign: 'center', fontSize: 13 }}>
            {isConnected ? 'Master Connected • Ready to Play' : 'Connect to NeoXalle Master first'}
          </Text>
          
          {/* Game Timer (when playing) */}
          {gameMode === 'playing' && (
            <BlurView
              intensity={80}
              tint="dark"
              style={{
                backgroundColor: 'rgba(160,32,192,0.15)',
                borderColor: Theme.neon.purple,
                borderWidth: 2,
                padding: 24,
                borderRadius: 16,
                marginTop: 24,
                overflow: 'hidden',
              }}
            >
              <Text style={{ color: '#888', textAlign: 'center', fontSize: 12, marginBottom: 8 }}>
                TIME REMAINING
              </Text>
              <Text style={{ 
                color: timeRemaining <= 10 ? '#FF4444' : Theme.neon.purpleLight, 
                textAlign: 'center', 
                fontSize: 64, 
                fontWeight: '700' 
              }}>
                {timeRemaining}
              </Text>
              <TouchableOpacity
                onPress={stopGame}
                style={{
                  marginTop: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255,68,68,0.2)',
                  borderWidth: 1,
                  borderColor: '#FF4444',
                  alignSelf: 'center',
                }}
              >
                <Text style={{ color: '#FF4444', fontWeight: '600' }}>STOP GAME</Text>
              </TouchableOpacity>
            </BlurView>
          )}
          
          {/* Game Results (when finished) */}
          {gameMode === 'finished' && (
            <BlurView
              intensity={80}
              tint="dark"
              style={{
                backgroundColor: 'rgba(61,255,154,0.1)',
                borderColor: '#3DFF9A',
                borderWidth: 2,
                padding: 24,
                borderRadius: 16,
                marginTop: 24,
                overflow: 'hidden',
              }}
            >
              <Text style={{ color: '#3DFF9A', textAlign: 'center', fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
                🏆 GAME COMPLETE!
              </Text>
              
              {Object.entries(scores).map(([slaveId, score]) => (
                <View key={slaveId} style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between', 
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.1)'
                }}>
                  <Text style={{ color: '#fff', fontSize: 16 }}>Slave {parseInt(slaveId) + 1}</Text>
                  <Text style={{ color: '#3DFF9A', fontSize: 18, fontWeight: '700' }}>{score} hits</Text>
                </View>
              ))}
              
              <TouchableOpacity
                onPress={resetGame}
                style={{
                  marginTop: 20,
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                  borderRadius: 8,
                  backgroundColor: 'rgba(160,32,192,0.3)',
                  borderWidth: 1,
                  borderColor: Theme.neon.purple,
                  alignSelf: 'center',
                }}
              >
                <Text style={{ color: Theme.neon.purpleLight, fontWeight: '700' }}>PLAY AGAIN</Text>
              </TouchableOpacity>
            </BlurView>
          )}

        {/* Slave Status */}
        {isConnected && (
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Connected Slaves</Text>
              <View style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: slaves.filter(s => s.connected).length >= 2 ? 'rgba(61,255,154,0.15)' : 'rgba(255,68,68,0.15)',
              }}>
                <Text style={{ 
                  color: slaves.filter(s => s.connected).length >= 2 ? '#3DFF9A' : '#FF4444', 
                  fontWeight: '600', 
                  fontSize: 12 
                }}>
                  {slaves.filter(s => s.connected).length}/2
                </Text>
              </View>
            </View>
            
            {slaves.length === 0 ? (
              <Text style={{ color: '#666', textAlign: 'center', paddingVertical: 20 }}>
                Scanning for slaves...
              </Text>
            ) : (
              <View style={{ gap: 12 }}>
                {slaves.map((slave) => (
                  <View
                    key={slave.id}
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: 10,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: slave.connected ? 'rgba(61,255,154,0.3)' : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: slave.connected ? 'rgba(61,255,154,0.2)' : 'rgba(255,255,255,0.1)',
                          borderWidth: 1,
                          borderColor: slave.connected ? '#3DFF9A' : '#666',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Text style={{ 
                            color: slave.connected ? '#3DFF9A' : '#666', 
                            fontWeight: '700', 
                            fontSize: 16 
                          }}>
                            {slave.id + 1}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
                            Slave {slave.id + 1}
                          </Text>
                          <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                            {slave.connected ? 'Ready' : 'Disconnected'}
                          </Text>
                          {slave.responseTime && (
                            <Text style={{ color: '#3DFF9A', fontSize: 10, marginTop: 2 }}>
                              Last: {slave.responseTime}ms
                            </Text>
                          )}
                        </View>
                      </View>
                      
                      {slave.connected && gameMode === 'idle' && (
                        <TouchableOpacity
                          onPress={() => testSlave(slave.id)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 6,
                            backgroundColor: 'rgba(160,32,192,0.2)',
                            borderWidth: 1,
                            borderColor: Theme.neon.purple,
                          }}
                        >
                          <Text style={{ color: Theme.neon.purpleLight, fontSize: 11, fontWeight: '600' }}>
                            TEST
                          </Text>
                        </TouchableOpacity>
                      )}
                      
                      {gameMode === 'playing' && (
                        <View style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 8,
                          backgroundColor: 'rgba(160,32,192,0.15)',
                        }}>
                          <Text style={{ color: Theme.neon.purpleLight, fontSize: 12, fontWeight: '700' }}>
                            {scores[slave.id] || 0}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </BlurView>
        )}
        
        {/* Game Mode Selection */}
        {isConnected && gameMode === 'idle' && slaves.filter(s => s.connected).length >= 2 && (
          <>
            {/* Duration Selector */}
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
                marginTop: 16,
                overflow: 'hidden',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', marginBottom: 16, fontSize: 16 }}>
                Game Duration
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {[15, 30, 45, 60].map(duration => (
                  <TouchableOpacity
                    key={duration}
                    onPress={() => setGameDuration(duration)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 8,
                      backgroundColor: gameDuration === duration ? 'rgba(160,32,192,0.3)' : 'rgba(255,255,255,0.05)',
                      borderWidth: 1,
                      borderColor: gameDuration === duration ? Theme.neon.purple : 'rgba(255,255,255,0.1)',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ 
                      color: gameDuration === duration ? Theme.neon.purpleLight : '#888', 
                      fontWeight: '600',
                      fontSize: 16
                    }}>
                      {duration}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </BlurView>
            
            {/* Game Modes */}
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
                marginTop: 16,
                overflow: 'hidden',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', marginBottom: 16, fontSize: 16 }}>
                Select Game Mode
              </Text>
              
              {/* 1v1 Mode */}
              <TouchableOpacity
                onPress={() => startGame('1v1')}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderRadius: 10,
                  backgroundColor: 'rgba(160,32,192,0.2)',
                  borderWidth: 1,
                  borderColor: Theme.neon.purple,
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                      ⚔️ 1v1 Battle
                    </Text>
                    <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>
                      Compete head-to-head • Most hits wins
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color={Theme.neon.purpleLight} />
                </View>
              </TouchableOpacity>
              
              {/* Free Play Mode */}
              <TouchableOpacity
                onPress={() => startGame('freeplay')}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderRadius: 10,
                  backgroundColor: 'rgba(61,255,154,0.1)',
                  borderWidth: 1,
                  borderColor: '#3DFF9A',
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                      🎯 Free Play
                    </Text>
                    <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>
                      Hit as many as you can • Beat your record
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#3DFF9A" />
                </View>
              </TouchableOpacity>
              
              {/* Endurance Mode */}
              <TouchableOpacity
                onPress={() => startGame('endurance')}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,165,0,0.1)',
                  borderWidth: 1,
                  borderColor: '#FFA500',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                      ⚡ Endurance
                    </Text>
                    <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>
                      Increasing speed • Don&apos;t miss any!
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#FFA500" />
                </View>
              </TouchableOpacity>
            </BlurView>
          </>
        )}
      </View>
      </ScrollView>
    </LinearGradient>
  );
}
