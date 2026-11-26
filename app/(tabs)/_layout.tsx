import { Feather } from '@expo/vector-icons';
import TopTabs from 'expo-router/js-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../src/theme';

/**
 * Pyyhkäistävät välilehdet: Ladut ⇄ Kartta.
 * Expo Routerin oma "top tabs" -navigaattori sijoitettuna alareunaan, jotta osioiden välillä voi pyyhkäistä.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <TopTabs
      tabBarPosition="bottom"
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarShowIcon: true,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, textTransform: 'none', margin: 0 },
        tabBarIndicatorStyle: { backgroundColor: colors.accent, top: 0, height: 3 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.lineSoft,
          paddingBottom: insets.bottom,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarPressColor: colors.accentSoft,
      }}
    >
      <TopTabs.Screen
        name="index"
        options={{ title: 'Ladut', tabBarIcon: ({ color }) => <Feather name="list" size={22} color={color} /> }}
      />
      <TopTabs.Screen
        name="kartta"
        options={{
          title: 'Kartta',
          tabBarIcon: ({ color }) => <Feather name="map" size={22} color={color} />,
          // Kartalla sivuttaisveto liikuttaa karttaa. Takaisin listaan pääsee välilehdestä
          // tai pyyhkäisemällä oikealle alapaneelin päällä.
          swipeEnabled: false,
        }}
      />
    </TopTabs>
  );
}
