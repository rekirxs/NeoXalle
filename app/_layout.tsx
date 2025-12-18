import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Theme } from '../constants/theme';

// Guard expo-keep-awake calls to avoid native activation crashes at runtime.
// This dynamically wraps common keep-awake functions with try/catch so
// if the native module fails to activate, the app won't throw an uncaught error.
(async () => {
  try {
    const KeepAwake = await import('expo-keep-awake');
    const wrap = (name: string) => {
      try {
        const orig = (KeepAwake as any)[name];
        if (typeof orig === 'function') {
          (KeepAwake as any)[name] = async (...args: any[]) => {
            try {
              return await orig(...args);
            } catch (e) {
               
              console.warn(`suppressed keep-awake ${name} error:`, e);
              return undefined;
            }
          };
        }
      } catch (_) {}
    };

    ['activateKeepAwake', 'deactivateKeepAwake', 'preventAutoHideAsync', 'allowAutoHideAsync'].forEach(wrap);
  } catch (e) {
    // ignore
  }
})();

export default function TabsLayout() {
  const iconMap: Record<string, string> = {
    index: 'bluetooth',
    control: 'gamepad-variant',
    explore: 'compass-outline',
    modal: 'dots-horizontal'
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Theme.background.darkPrimary,
          borderTopColor: 'rgba(255,255,255,0.05)',
        },
        tabBarActiveTintColor: Theme.neon.purpleLight,
        tabBarInactiveTintColor: '#777',
        tabBarIcon: ({ color, size }) => {
          const name = iconMap[route.name] ?? 'circle-outline';
          return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Connect' }} />
      <Tabs.Screen name="control" options={{ title: 'Control' }} />
    </Tabs>
  );
}
