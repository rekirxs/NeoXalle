import { LinearGradient } from 'expo-linear-gradient';
import { Image, Text, View } from 'react-native';
import { Theme } from '../constants/theme';

export default function ControlScreen() {
  return (
    <LinearGradient
      colors={[
        Theme.neon.purpleDark,
        '#1a1a1a',
        '#0d0d0d',
      ]}
      start={[0, 0]}
      end={[0, 1]}
      style={{ flex: 1, padding: 24 }}
    >
      <View style={{ marginTop: 40 }}>
        <Image
          source={require('../assets/images/Control.png')}
          style={{ width: 320, height: 120, resizeMode: 'contain', alignSelf: 'center' }}
        />

        <Text
          style={{
            marginTop: 12,
            color: '#aaa',
            textAlign: 'center',
          }}
        >
          NeoXalle controls will live here
        </Text>
      </View>
    </LinearGradient>
  );
}
