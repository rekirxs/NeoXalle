import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';
import { Tabs, usePathname } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef } from 'react';
import { Animated, StatusBar, View } from 'react-native';
import { Theme } from '../constants/theme';

SystemUI.setBackgroundColorAsync(Theme.background.darkPrimary);

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
  const pathname = usePathname();
  const tabBarTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(Theme.background.darkPrimary);
    NavigationBar.setBackgroundColorAsync(Theme.background.darkPrimary);
    NavigationBar.setButtonStyleAsync('light');
  }, []);

  useEffect(() => {
    Animated.timing(tabBarTranslate, {
      toValue: pathname === '/connect' ? 100 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [pathname, tabBarTranslate]);

  const iconMap: Record<string, string> = {
    index: 'home',
    control: 'gamepad-variant',
    explore: 'compass-outline',
    modal: 'dots-horizontal'
  };

  return (
    <View style={{ flex: 1, backgroundColor: Theme.background.darkPrimary }}>
      <StatusBar barStyle="light-content" backgroundColor={Theme.background.darkPrimary} />
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: Theme.background.darkPrimary,
            borderTopColor: 'rgba(255,255,255,0.05)',
            transform: [{ translateY: tabBarTranslate }],
          },
          tabBarActiveTintColor: Theme.neon.purpleLight,
          tabBarInactiveTintColor: '#777',
          tabBarIcon: ({ color, size }) => {
            const name = iconMap[route.name] ?? 'circle-outline';
            return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
          },
          tabBarShowLabel: false,
          animation: 'shift',
          sceneStyle: {
            backgroundColor: Theme.background.darkPrimary,
          },
        })}
      >
        <Tabs.Screen name="index" options={{ title: '' }} />
        <Tabs.Screen name="control" options={{ title: '' }} />
        <Tabs.Screen name="connect" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
