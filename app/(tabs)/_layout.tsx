import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { COLORS, FONT } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.borderStrong,
        tabBarLabelStyle: { fontFamily: FONT.bodySemi, fontSize: 9.5 },
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="diagnose"
        options={{
          title: '진단',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'camera' : 'camera-outline'} size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shops"
        options={{
          title: '업체',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: '마이',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
