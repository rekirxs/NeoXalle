import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Theme } from '../constants/theme';

type Mode = {
  name: string;
  time: number;
  pods: number;
  timesPlayed: number;
};

export default function CustomModeScreen() {
  const router = useRouter();
  const { index } = useLocalSearchParams(); // Get index for editing
  const [name, setName] = useState('');
  const [time, setTime] = useState('30');
  const [pods, setPods] = useState('2');
  const [timesPlayed, setTimesPlayed] = useState('0');

  useEffect(() => {
    if (index) {
      loadMode(parseInt(index as string));
    }
  }, [index]);

  const loadMode = async (idx: number) => {
    try {
      const storedModes = await AsyncStorage.getItem('neoxalleModes');
      if (storedModes) {
        const modes: Mode[] = JSON.parse(storedModes);
        const mode = modes[idx];
        if (mode) {
          setName(mode.name);
          setTime(mode.time.toString());
          setPods(mode.pods.toString());
          setTimesPlayed(mode.timesPlayed.toString());
        }
      }
    } catch (error) {
      console.error('Error loading mode:', error);
    }
  };

  const startMode = async () => {
    if (!name.trim()) return;

    const mode: Mode = {
      name: name.trim(),
      time: parseInt(time) || 30,
      pods: parseInt(pods) || 2,
      timesPlayed: parseInt(timesPlayed) || 0,
    };

    const storedModes = await AsyncStorage.getItem('neoxalleModes');
    let modes: Mode[] = storedModes ? JSON.parse(storedModes) : [];

    if (index) {
      // Editing
      modes[parseInt(index as string)] = mode;
    } else {
      // Creating
      modes.push(mode);
    }

    await AsyncStorage.setItem('neoxalleModes', JSON.stringify(modes));
    router.push('/control');
  };

  return (
    <LinearGradient
      colors={[Theme.neon.purpleDark, '#1a1a1a', '#0d0d0d']}
      start={[0, 0]}
      end={[0, 1]}
      style={{ flex: 1, padding: 24 }}
    >
      <View style={{ alignItems: 'center', marginTop: 50 }}>
        <Text style={{ fontSize: 24, color: '#fff', marginBottom: 40 }}>{index ? `Edit ${name}` : 'Create Custom Mode'}</Text>
        
        <View style={{ width: '80%', marginBottom: 20 }}>
          <Text style={{ fontSize: 18, color: '#aaa', marginBottom: 10 }}>Name</Text>
          <TextInput
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 5,
              padding: 10,
              color: '#fff',
              fontSize: 16,
            }}
            value={name}
            onChangeText={setName}
            placeholder="Enter mode name"
            placeholderTextColor="#666"
          />
        </View>

        <View style={{ width: '80%', marginBottom: 20 }}>
          <Text style={{ fontSize: 18, color: '#aaa', marginBottom: 10 }}>Time (seconds)</Text>
          <TextInput
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 5,
              padding: 10,
              color: '#fff',
              fontSize: 16,
            }}
            value={time}
            onChangeText={setTime}
            keyboardType="numeric"
            placeholder="e.g., 30"
            placeholderTextColor="#666"
          />
        </View>

        <View style={{ width: '80%', marginBottom: 20 }}>
          <Text style={{ fontSize: 18, color: '#aaa', marginBottom: 10 }}>Amount of Pods</Text>
          <TextInput
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 5,
              padding: 10,
              color: '#fff',
              fontSize: 16,
            }}
            value={pods}
            onChangeText={setPods}
            keyboardType="numeric"
            placeholder="e.g., 2"
            placeholderTextColor="#666"
          />
        </View>

        <View style={{ width: '80%', marginBottom: 40 }}>
          <Text style={{ fontSize: 18, color: '#aaa', marginBottom: 10 }}>Times Played Before</Text>
          <TextInput
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 5,
              padding: 10,
              color: '#fff',
              fontSize: 16,
            }}
            value={timesPlayed}
            onChangeText={setTimesPlayed}
            keyboardType="numeric"
            placeholder="e.g., 0"
            placeholderTextColor="#666"
          />
        </View>

        <TouchableOpacity
          onPress={startMode}
          style={{
            backgroundColor: Theme.neon.purpleDark,
            paddingHorizontal: 40,
            paddingVertical: 15,
            borderRadius: 5,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18 }}>{index ? 'Save Mode' : 'Create Mode'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 20,
            padding: 10,
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#aaa" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}