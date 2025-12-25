import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as NavigationBar from 'expo-navigation-bar';
import { Tabs, usePathname } from 'expo-router';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef } from 'react';
import { Animated, StatusBar, View } from 'react-native';
import { Theme } from '../constants/theme';

SystemUI.setBackgroundColorAsync(Theme.background.darkPrimary);


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
      } catch {
        
      }
    };

    ['activateKeepAwake', 'deactivateKeepAwake', 'preventAutoHideAsync', 'allowAutoHideAsync'].forEach(wrap);
  } catch {
   
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
    database: 'database',
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
            bottom: 25,
            left: 0,
            right: 0,
            backgroundColor: Theme.background.darkPrimary,
            borderTopColor: 'rgba(255,255,255,0.05)',
            transform: [{ translateY: tabBarTranslate }],
            height: 60,
            paddingBottom: 5,
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
        <Tabs.Screen name="database" options={{ title: '' }} />
        <Tabs.Screen name="connect" options={{ href: null }} />
        <Tabs.Screen name="custom-mode" options={{ href: null }} />
        
        <Tabs.Screen name="modal" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
