import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { Theme } from '../constants/theme';

export default function ControlScreen() {
  return (
    <LinearGradient
      colors={[
        Theme.background.darkPrimary,
        Theme.background.darkSecondary,
      ]}
      style={{ flex: 1, padding: 24 }}
    >
      <View style={{ marginTop: 40 }}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: '700',
            color: Theme.neon.purpleLight,
            textAlign: 'center',
          }}
        >
          CONTROL
        </Text>

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
