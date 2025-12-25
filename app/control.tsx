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
  const [gameMode, setGameMode] = useState<'idle' | 'playing' | 'finished' | 'reaction_ready' | 'reaction_countdown' | 'reaction_wait' | 'reaction' | 'select_players'>('idle');
  const [gameDuration, setGameDuration] = useState(30);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [scores, setScores] = useState<{[key: number]: number}>({});
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [currentMode, setCurrentMode] = useState<string>('');
  const [countdown, setCountdown] = useState(0);
  const [selectedSlave, setSelectedSlave] = useState<number | null>(null);
  const [numPlayers, setNumPlayers] = useState<number | null>(null);
  const [roundTimes, setRoundTimes] = useState<{[key: number]: number}>({});
  const [currentRoundResults, setCurrentRoundResults] = useState<{[key: number]: number} | null>(null);
  
  const deviceRef = useRef<Device | null>(null);
  const charRef = useRef<Characteristic | null>(null);
  const timerRef = useRef<number | null>(null);
  const messageBufferRef = useRef<string>('');
  const scanSentRef = useRef<boolean>(false);
  const lastStatusRef = useRef<string>('');
  const lastPressTimes = useRef<{[key: number]: number}>({});
  const lastMonitorErrorRef = useRef<string>('');
  
  const handleMasterMessage = useCallback((message: string) => {
    console.log('Parsing message:', message);
    
    try {
      const data = JSON.parse(message);
      console.log('Parsed data:', JSON.stringify(data));
      
      if (data.event === 'status') {
        const statusStr = JSON.stringify(data.slaves);
        const isChanged = lastStatusRef.current !== statusStr;
        lastStatusRef.current = statusStr;
        
        if (isChanged) {
          console.log('Status update - slaves:', data.slaves);
        }
        setSlaves(data.slaves || []);
      } else if (data.event === 'slave_connected') {
        console.log(`Slave ${data.slave} connected at ${data.address}`);
      } else if (data.event === 'slave_disconnected') {
        console.log(`Slave ${data.slave} disconnected`);
      } else if (data.event === 'pressed') {
        // Slave was pressed!
        const slaveId = data.slave;
        const now = Date.now();
        const responseTime = data.time;
        
        if (gameMode !== 'reaction' && lastPressTimes.current[slaveId] && now - lastPressTimes.current[slaveId] < 500) {
          console.log(`Debounced duplicate press for slave ${slaveId}`);
          return;
        }
        lastPressTimes.current[slaveId] = now;
        
        if (gameMode === 'reaction') {
         
          setRoundTimes(prev => {
            const newTimes = { ...prev, [slaveId]: responseTime };
            console.log('Reaction times updated:', newTimes);
            
            const expectedPresses = numPlayers || 1;
            if (Object.keys(newTimes).length === expectedPresses) {
              console.log('All reaction presses received');
              setCurrentRoundResults(newTimes);
              setGameMode('finished');
              
              // Turn off all lights with delay to avoid BLE congestion
              slaves.filter(s => s.connected).forEach((slave, index) => {
                setTimeout(() => {
                  sendCommand(JSON.stringify({
                    command: 'light_off',
                    slave: slave.id
                  }));
                }, index * 100); // 100ms delay between commands
              });
            }
            
            return newTimes;
          });
        } else {
          console.log(`Slave ${slaveId} pressed in ${responseTime}ms`);
          
          // For playing mode, collect round times
          if (gameMode === 'playing') {
            setRoundTimes(prev => {
              const newTimes = { ...prev, [slaveId]: responseTime };
              console.log('Round times updated:', newTimes);
              
              // Check if all expected presses received
              const expectedPresses = numPlayers || 1;
              if (Object.keys(newTimes).length === expectedPresses) {
                console.log('Round complete, processing results');
                setCurrentRoundResults(newTimes);
                
                // Update scores
                if (numPlayers === 1) {
                  setScores(prev => ({ ...prev, [slaveId]: (prev[slaveId] || 0) + 1 }));
                } else {
                  // For 2 players, give point to faster press
                  const times = Object.entries(newTimes);
                  const faster = times.reduce((min, [id, time]) => time < newTimes[min] ? parseInt(id) : min, parseInt(times[0][0]));
                  console.log('Faster player:', faster);
                  setScores(prev => ({ ...prev, [faster]: (prev[faster] || 0) + 1 }));
                }
                
                // Clear results after 2 seconds
                setTimeout(() => {
                  setCurrentRoundResults(null);
                  setRoundTimes({});
                }, 2000);
              }
              
              return newTimes;
            });
          } else {
            // For idle mode or other, just update score
            setScores(prev => ({
              ...prev,
              [slaveId]: (prev[slaveId] || 0) + 1
            }));
          }
          
          // Update slave info
          setSlaves(prev => prev.map(s => 
            s.id === slaveId 
              ? { ...s, lastEvent: 'pressed', responseTime } 
              : s
          ));
        }
      } else if (data.event === 'light_on') {
        console.log(`Slave ${data.slave} light turned on`);
        if (gameMode === 'reaction') {
          // Start timing from when the light actually turns on
          setStartTime(Date.now());
        }
      }
    } catch (e) {
      console.error('Failed to parse master message:', e);
    }
  }, [gameMode, startTime, numPlayers]);

  useFocusEffect(
    useCallback(() => {
      
      messageBufferRef.current = '';
      
      
      bleManager.connectedDevices([SERVICE_UUID]).then(async (devices) => {
        if (devices.length > 0) {
          setIsConnected(true);
          deviceRef.current = devices[0];
          lastMonitorErrorRef.current = ''; // Reset error tracking
          
         
          try {
            const mtu = await deviceRef.current.requestMTU(512);
            console.log('MTU set to:', mtu);
          } catch (e) {
            console.log('MTU request failed, using default:', e);
          }
          
       
          const device = await deviceRef.current.discoverAllServicesAndCharacteristics();
          const services = await device.services();
          const service = services.find(s => s.uuid === SERVICE_UUID);
          if (service) {
            const chars = await service.characteristics();
            const char = chars.find(c => c.uuid === CHAR_UUID);
            if (char) {
              charRef.current = char;
              
             
              char.monitor((error, characteristic) => {
                if (error) {
                  const errorStr = error.toString();
                  if (lastMonitorErrorRef.current !== errorStr) {
                    console.error('Monitor error:', error);
                    lastMonitorErrorRef.current = errorStr;
                  }
                  return;
                }
                
                if (characteristic?.value) {
                  try {
                    const data = atob(characteristic.value);
                    console.log('Raw from Master:', data);
                    
                    // Try direct parse first (for complete messages)
                    try {
                      const parsed = JSON.parse(data);
                      console.log('Direct parse success:', parsed);
                      handleMasterMessage(JSON.stringify(parsed));
                      return;
                    } catch {
                      console.log('Not complete JSON, buffering...');
                    }
                    
                  
                    messageBufferRef.current += data;
                    console.log('Buffer now:', messageBufferRef.current);
                    
             
                    let startIndex = 0;
                    for (let i = 0; i < messageBufferRef.current.length; i++) {
                      if (messageBufferRef.current[i] === '{') {
                        startIndex = i;
                      } else if (messageBufferRef.current[i] === '}') {
                        
                        const jsonStr = messageBufferRef.current.substring(startIndex, i + 1);
                        try {
                          JSON.parse(jsonStr); 
                          console.log('Buffered parse success:', jsonStr);
                          handleMasterMessage(jsonStr);
                          
                          messageBufferRef.current = messageBufferRef.current.substring(i + 1);
                          i = -1; 
                          startIndex = 0;
                        } catch {
                          
                          console.log('Parse failed, continuing...');
                        }
                      }
                    }
                  } catch (error) {
                    console.error('Processing error:', error);
                  }
                }
              });
              
              
              if (!scanSentRef.current) {
                sendCommand('{"command":"scan_slaves"}');
                scanSentRef.current = true;
              }
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
        
        
      };
    }, [handleMasterMessage])
  );
  
  const sendCommand = (command: string) => {
    // Allow scan_slaves command even when not connected
    if (command.includes('scan_slaves')) {
      if (!charRef.current) {
        console.error('No characteristic available for command:', command);
        return;
      }
    } else if (!isConnected || !charRef.current) {
      console.error('No BLE connection available for command:', command);
      return;
    }
    
    console.log('Sending to master:', command);
    charRef.current.writeWithResponse(btoa(command))
      .then(() => console.log('Command sent successfully'))
      .catch(err => {
        console.error('Write error:', err);
        // Try to reconnect if write fails
        if (err.message && (err.message.includes('disconnected') || err.message.includes('not connected'))) {
          console.log('Connection lost, attempting to reconnect...');
          setIsConnected(false);
          // Trigger reconnection
          bleManager.connectedDevices([SERVICE_UUID]).then(async (devices) => {
            if (devices.length > 0) {
              console.log('Reconnected to device');
              setIsConnected(true);
              deviceRef.current = devices[0];
              lastMonitorErrorRef.current = ''; // Reset error tracking
              // Re-establish characteristic
              try {
                const device = await deviceRef.current.discoverAllServicesAndCharacteristics();
                const services = await device.services();
                const service = services.find(s => s.uuid === SERVICE_UUID);
                if (service) {
                  const chars = await service.characteristics();
                  const char = chars.find(c => c.uuid === CHAR_UUID);
                  if (char) {
                    charRef.current = char;
                    console.log('Characteristic re-established');
                  }
                }
              } catch (e) {
                console.error('Failed to re-establish characteristic:', e);
              }
            }
          }).catch(err => console.error('Reconnection failed:', err));
        }
      });
  };
  
  const startGame = (mode: string) => {
    console.log('startGame called with mode:', mode);
    setCurrentMode(mode);
    const connectedSlaves = slaves.filter(s => s.connected);
    console.log('Starting game:', mode, 'connected slaves:', connectedSlaves.length);
    
    if (connectedSlaves.length < 1) {
      Alert.alert('Not Ready', 'Please wait for at least 1 slave to connect');
      return;
    }
    
    // For all modes, go to player selection first
    setGameMode('select_players');
  };
  
  const startActualGame = () => {
    const connectedSlaves = slaves.filter(s => s.connected);
    if (!numPlayers || connectedSlaves.length < numPlayers) {
      Alert.alert('Not Ready', `Need at least ${numPlayers} connected slaves`);
      return;
    }
    
    if (currentMode === 'reaction_time') {
      // For reaction time, go to slave selection
      setGameMode('reaction_ready');
      return;
    }
    
    console.log('Setting gameMode to playing');
    setGameMode('playing');
    setTimeRemaining(gameDuration);
    setScores({});
    
    console.log('Sending start_game command');
    sendCommand(JSON.stringify({
      command: 'start_game',
      mode: currentMode,
      duration: gameDuration,
      slaves: connectedSlaves.length
    }));
    
    console.log('Starting timer with duration:', gameDuration);
    timerRef.current = setInterval(() => {
      console.log('Timer callback executing');
      if (currentRoundResults) {
        console.log('Waiting for current round to finish');
        return; // Wait for current round
      }
      
      setTimeRemaining(prev => {
        console.log('Timer tick, current time:', prev);
        if (prev <= 1) {
          console.log('Stopping game due to time up');
          stopGame();
          return 0;
        }
        return prev - 1;
      });
      
      // Start new round
      setRoundTimes({});
      setCurrentRoundResults(null);
      
      if (numPlayers === 1) {
        const randomSlave = connectedSlaves[Math.floor(Math.random() * connectedSlaves.length)];
        console.log('Lighting random slave:', randomSlave.id);
        sendCommand(JSON.stringify({
          command: 'light_on',
          slave: randomSlave.id,
          color: 'random'
        }));
      } else {
        // Light all slaves for 2 players
        connectedSlaves.forEach(slave => {
          console.log('Lighting slave:', slave.id);
          sendCommand(JSON.stringify({
            command: 'light_on',
            slave: slave.id,
            color: 'random'
          }));
        });
      }
    }, 1000);
  };
  
  const stopGame = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setGameMode('finished');
    
    sendCommand('{"command":"stop_game"}');
    
    
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setGameMode('idle');
    setScores({});
    setTimeRemaining(gameDuration);
    setReactionTime(null);
    setStartTime(null);
    setCurrentMode('');
    setCountdown(0);
    setSelectedSlave(null);
    setNumPlayers(null);
    setRoundTimes({});
    setCurrentRoundResults(null);
  };
  
  const startReactionGame = () => {
    setCountdown(3);
    setGameMode('reaction_countdown');
    
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          setGameMode('reaction_wait');
          
          // Wait 3-5 seconds before activating
          const waitTime = 3000 + Math.random() * 2000;
          setTimeout(() => {
            setGameMode('reaction');
            setReactionTime(null);
            
            if (numPlayers === 1 && selectedSlave !== null) {
              console.log('Starting Reaction Time with slave:', selectedSlave);
              const command = JSON.stringify({
                command: 'light_on',
                slave: selectedSlave,
                color: 'random'
              });
              console.log('Sending light_on command:', command);
              sendCommand(command);
            } else if (numPlayers === 2) {
              // Light all connected slaves for 2-player reaction test
              slaves.filter(s => s.connected).forEach(slave => {
                console.log('Starting Reaction Time with slave:', slave.id);
                const command = JSON.stringify({
                  command: 'light_on',
                  slave: slave.id,
                  color: 'random'
                });
                sendCommand(command);
              });
            }
          }, waitTime);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
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
              
              {currentRoundResults && (
                <View style={{ marginTop: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#FFD700', textAlign: 'center', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
                    Round Results
                  </Text>
                  {Object.entries(currentRoundResults).map(([slaveId, time]) => (
                    <Text key={slaveId} style={{ color: '#fff', textAlign: 'center', fontSize: 18 }}>
                      Slave {parseInt(slaveId) + 1}: {time}ms
                    </Text>
                  ))}
                </View>
              )}
              
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
              {currentMode === 'reaction_time' ? (
                <>
                  <Text style={{ color: '#3DFF9A', textAlign: 'center', fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
                    Reaction Time Results
                  </Text>
                  {currentRoundResults && Object.entries(currentRoundResults).map(([slaveId, time]) => (
                    <Text key={slaveId} style={{ color: '#fff', textAlign: 'center', fontSize: 36, fontWeight: '700', marginBottom: 8 }}>
                      Slave {parseInt(slaveId) + 1}: {time}ms
                    </Text>
                  ))}
                </>
              ) : (
                <>
                  <Text style={{ color: '#3DFF9A', textAlign: 'center', fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
                     Times UP!
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
                </>
              )}
              
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

          {gameMode === 'reaction' && (
            <BlurView
              intensity={80}
              tint="dark"
              style={{
                backgroundColor: 'rgba(255,215,0,0.15)',
                borderColor: '#FFD700',
                borderWidth: 2,
                padding: 24,
                borderRadius: 16,
                marginTop: 24,
                overflow: 'hidden',
              }}
            >
              <Text style={{ color: '#FFD700', textAlign: 'center', fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
                Reaction Time Test
              </Text>
              <Text style={{ color: '#fff', textAlign: 'center', fontSize: 16, marginBottom: 8 }}>
                Light is on - Press the pod as fast as possible!
              </Text>
              <Text style={{ color: '#aaa', textAlign: 'center', fontSize: 12 }}>
                Waiting for your reaction...
              </Text>
            </BlurView>
          )}

          {gameMode === 'reaction_ready' && (
            <BlurView
              intensity={80}
              tint="dark"
              style={{
                backgroundColor: 'rgba(255,215,0,0.15)',
                borderColor: '#FFD700',
                borderWidth: 2,
                padding: 24,
                borderRadius: 16,
                marginTop: 24,
                overflow: 'hidden',
              }}
            >
              <Text style={{ color: '#FFD700', textAlign: 'center', fontSize: 24, fontWeight: '700', marginBottom: 16 }}>
                Get Ready!
              </Text>
              <Text style={{ color: '#fff', textAlign: 'center', fontSize: 16, marginBottom: 24 }}>
                {numPlayers === 1 ? 'Select a slave pod for the reaction test' : 'Reaction test for both players'}
              </Text>
              
              {numPlayers === 1 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 }}>
                  {[0, 1].map((slaveId) => (
                    <View key={slaveId} style={{ alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={() => setSelectedSlave(slaveId)}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          backgroundColor: selectedSlave === slaveId ? '#FFD700' : 'rgba(255,255,255,0.1)',
                          borderWidth: 2,
                          borderColor: selectedSlave === slaveId ? '#FFD700' : '#666',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ 
                          color: selectedSlave === slaveId ? '#000' : '#fff', 
                          fontSize: 24, 
                          fontWeight: '700' 
                        }}>
                          {slaveId + 1}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => testSlave(slaveId)}
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
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 }}>
                  {slaves.filter(s => s.connected).map((slave) => (
                    <View key={slave.id} style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          borderWidth: 2,
                          borderColor: '#FFD700',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ 
                          color: '#fff', 
                          fontSize: 24, 
                          fontWeight: '700' 
                        }}>
                          {slave.id + 1}
                        </Text>
                      </View>
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
                    </View>
                  ))}
                </View>
              )}
              
              <TouchableOpacity
                onPress={numPlayers === 1 ? (selectedSlave !== null ? startReactionGame : undefined) : startReactionGame}
                disabled={numPlayers === 1 && selectedSlave === null}
                style={{
                  backgroundColor: (numPlayers === 1 && selectedSlave !== null) || numPlayers === 2 ? '#FFD700' : 'rgba(255,255,255,0.3)',
                  paddingVertical: 16,
                  paddingHorizontal: 32,
                  borderRadius: 8,
                  alignSelf: 'center',
                  opacity: (numPlayers === 1 && selectedSlave !== null) || numPlayers === 2 ? 1 : 0.5,
                }}
              >
                <Text style={{ 
                  color: (numPlayers === 1 && selectedSlave !== null) || numPlayers === 2 ? '#000' : '#666', 
                  fontSize: 18, 
                  fontWeight: '700' 
                }}>
                  START TEST
                </Text>
              </TouchableOpacity>
            </BlurView>
          )}

          {gameMode === 'reaction_countdown' && (
            <BlurView
              intensity={80}
              tint="dark"
              style={{
                backgroundColor: 'rgba(255,215,0,0.15)',
                borderColor: '#FFD700',
                borderWidth: 2,
                padding: 24,
                borderRadius: 16,
                marginTop: 24,
                overflow: 'hidden',
              }}
            >
              <Text style={{ color: '#FFD700', textAlign: 'center', fontSize: 48, fontWeight: '700' }}>
                {countdown > 0 ? countdown : 'GO!'}
              </Text>
            </BlurView>
          )}

          {gameMode === 'reaction_wait' && (
            <BlurView
              intensity={80}
              tint="dark"
              style={{
                backgroundColor: 'rgba(255,215,0,0.15)',
                borderColor: '#FFD700',
                borderWidth: 2,
                padding: 24,
                borderRadius: 16,
                marginTop: 24,
                overflow: 'hidden',
              }}
            >
              <Text style={{ color: '#FFD700', textAlign: 'center', fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
                Wait...
              </Text>
              <Text style={{ color: '#fff', textAlign: 'center', fontSize: 16 }}>
                Get ready for the light!
              </Text>
            </BlurView>
          )}

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
        
        {gameMode === 'select_players' && (
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
              Select Number of Players
            </Text>
            
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setGameMode('idle')}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <Text style={{ color: '#888', fontWeight: '600' }}>← Back</Text>
              </TouchableOpacity>
              {[1, 2].map(num => (
                <TouchableOpacity
                  key={num}
                  onPress={() => setNumPlayers(num)}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    borderRadius: 8,
                    backgroundColor: numPlayers === num ? Theme.neon.purple : 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    borderColor: numPlayers === num ? Theme.neon.purple : '#666',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ 
                    color: numPlayers === num ? '#000' : '#fff', 
                    fontSize: 18, 
                    fontWeight: '700' 
                  }}>
                    {num} Player{num > 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {numPlayers === 2 && (
              <>
                <Text style={{ color: '#fff', fontWeight: '600', marginBottom: 16, fontSize: 16 }}>
                  Test Slaves to Identify Them
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 }}>
                  {slaves.filter(s => s.connected).map((slave) => (
                    <View key={slave.id} style={{ alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={() => testSlave(slave.id)}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          borderWidth: 2,
                          borderColor: '#666',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ 
                          color: '#fff', 
                          fontSize: 24, 
                          fontWeight: '700' 
                        }}>
                          {slave.id + 1}
                        </Text>
                      </TouchableOpacity>
                      <Text style={{ color: '#aaa', fontSize: 12 }}>Test</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            
            <TouchableOpacity
              onPress={numPlayers ? startActualGame : undefined}
              disabled={!numPlayers}
              style={{
                backgroundColor: numPlayers ? Theme.neon.purple : 'rgba(255,255,255,0.3)',
                paddingVertical: 16,
                paddingHorizontal: 32,
                borderRadius: 8,
                alignSelf: 'center',
                opacity: numPlayers ? 1 : 0.5,
              }}
            >
              <Text style={{ 
                color: numPlayers ? '#000' : '#666', 
                fontSize: 18, 
                fontWeight: '700' 
              }}>
                START GAME
              </Text>
            </TouchableOpacity>
          </BlurView>
        )}
        
        {isConnected && gameMode === 'idle' && slaves.filter(s => s.connected).length >= 1 && (
          <>
            
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
              
              
              <TouchableOpacity
                onPress={() => startGame('reaction_time')}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,215,0,0.1)',
                  borderWidth: 1,
                  borderColor: '#FFD700',
                  marginBottom: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                      Reaction Time
                    </Text>
                    <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>
                      Test your reflexes • Press as fast as possible
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="lightning-bolt" size={24} color="#FFD700" />
                </View>
              </TouchableOpacity>
              
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
                       1v1 Battle
                    </Text>
                    <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>
                      Compete head-to-head • Most hits wins
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color={Theme.neon.purpleLight} />
                </View>
              </TouchableOpacity>
              
             
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
                      Free Play
                    </Text>
                    <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>
                      Hit as many as you can • Beat your record
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#3DFF9A" />
                </View>
              </TouchableOpacity>
              
             
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
                      Endurance
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
