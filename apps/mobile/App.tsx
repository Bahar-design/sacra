import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, StatusBar, View, ActivityIndicator, TouchableOpacity } from "react-native";
import { Session } from "@supabase/supabase-js";
import { useFonts } from "expo-font";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from "@expo-google-fonts/hanken-grotesk";
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
} from "@expo-google-fonts/newsreader";
import { initOfflineDB } from "./src/lib/offlineStorage";
import { supabase } from "./src/lib/supabase";
import { ThemeProvider, useTheme } from "./src/lib/ThemeContext";
import HomeScreen from "./src/screens/HomeScreen";
import ListenScreen from "./src/screens/ListenScreen";
import SearchScreen from "./src/screens/SearchScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import PrayerDetailScreen from "./src/screens/PrayerDetailScreen";
import CommunitySubmitScreen from "./src/screens/CommunitySubmitScreen";
import SplashScreen from "./src/screens/SplashScreen";
import AuthScreen from "./src/screens/AuthScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function ListenStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ListenMain" component={ListenScreen} />
      <Stack.Screen name="PrayerDetail" component={PrayerDetailScreen} />
    </Stack.Navigator>
  );
}
function SearchStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchMain" component={SearchScreen} />
      <Stack.Screen name="PrayerDetail" component={PrayerDetailScreen} />
    </Stack.Navigator>
  );
}
function ProfileStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="PrayerDetail" component={PrayerDetailScreen} />
      <Stack.Screen name="CommunitySubmit" component={CommunitySubmitScreen} />
      {/* Guests can navigate here from ProfileScreen to sign in */}
      <Stack.Screen
        name="Auth"
        component={({ navigation }: any) => (
          <AuthScreen onSuccess={() => navigation.goBack()} />
        )}
      />
    </Stack.Navigator>
  );
}
function HomeStack(): React.ReactElement {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="PrayerDetail" component={PrayerDetailScreen} />
    </Stack.Navigator>
  );
}

// ── Tab icon components matching Claude Design SVG paths ──────────────────────

function DiscoverIcon({ color }: { color: string }) {
  // 4-pointed star (matches Claude Design path d="M12 2.5c.55 4.6 2.9 6.95 7.5 7.5...")
  return <Text style={{ color, fontSize: 21, lineHeight: 23, includeFontPadding: false }}>✦</Text>;
}

function ListenIcon({ color }: { color: string }) {
  // 5 vertical bars matching M4 11v2 M8 7v10 M12 3v18 M16 7v10 M20 11v2
  const heights = [3, 11, 19, 11, 3];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2.5, height: 22 }}>
      {heights.map((h, i) => (
        <View key={i} style={{ width: 2.5, height: h, backgroundColor: color, borderRadius: 1.5 }} />
      ))}
    </View>
  );
}

function SearchIcon({ color }: { color: string }) {
  // Circle + diagonal handle — matches <circle cx="11" cy="11" r="6.5"/>  <line x1="16.5" y1="16.5" x2="21" y2="21"/>
  return (
    <View style={{ width: 22, height: 22 }}>
      <View style={{
        width: 14, height: 14,
        borderRadius: 7,
        borderWidth: 2.3,
        borderColor: color,
        position: "absolute",
        top: 0, left: 0,
      }} />
      <View style={{
        width: 2.5, height: 8,
        backgroundColor: color,
        borderRadius: 1.5,
        position: "absolute",
        bottom: 0, right: 0,
        transform: [{ rotate: "45deg" }],
      }} />
    </View>
  );
}

function SacredIcon({ color }: { color: string }) {
  // Filled bookmark matching M6 3h12a1 1 0 011 1v17l-7-4.5L5 21V4a1 1 0 011-1z
  const W = 15, bodyH = 14, tipH = 7;
  return (
    <View style={{ width: W, height: bodyH + tipH }}>
      <View style={{ width: W, height: bodyH, backgroundColor: color, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 0, height: 0, borderTopWidth: tipH, borderTopColor: color, borderRightWidth: W / 2, borderRightColor: "transparent" }} />
        <View style={{ width: 0, height: 0, borderTopWidth: tipH, borderTopColor: color, borderLeftWidth: W / 2, borderLeftColor: "transparent" }} />
      </View>
    </View>
  );
}

const TAB_ROUTES = [
  { name: "Discover", Icon: DiscoverIcon },
  { name: "Listen",   Icon: ListenIcon   },
  { name: "Search",   Icon: SearchIcon   },
  { name: "Sacred",   Icon: SacredIcon   },
] as const;

// Floating pill tab bar — matches Claude Design: left:18 right:18 bottom:18 h:66 radius:24 glass
function FloatingTabBar({ state, navigation }: any): React.ReactElement {
  const { C } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      position: "absolute",
      left: 18,
      right: 18,
      bottom: Math.max(insets.bottom + 8, 18),
      height: 66,
      borderRadius: 24,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.hair,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      paddingHorizontal: 6,
      elevation: 24,
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 1,
      shadowRadius: 20,
    }}>
      {TAB_ROUTES.map(({ name, Icon }, index) => {
        const focused = state.index === index;
        const color = focused ? C.accent : C.text3;
        return (
          <TouchableOpacity
            key={name}
            onPress={() => navigation.navigate(name)}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10 }}
            activeOpacity={0.7}
          >
            <Icon color={color} />
            <Text style={{
              fontFamily: "HankenGrotesk_700Bold",
              fontSize: 10,
              letterSpacing: 0.2,
              color,
              includeFontPadding: false,
            }}>
              {name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs(): React.ReactElement {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Discover" component={HomeStack} />
      <Tab.Screen name="Listen"   component={ListenStack} />
      <Tab.Screen name="Search"   component={SearchStack} />
      <Tab.Screen name="Sacred"   component={ProfileStack} />
    </Tab.Navigator>
  );
}

// Inner app component — has access to ThemeContext
function AppContent(): React.ReactElement {
  const { C, isDark } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [fontsLoaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
  });

  useEffect(() => {
    initOfflineDB();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setShowAuth(true);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setShowAuth(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSplashFinish = () => setSplashDone(true);
  const handleAuthSuccess  = () => setShowAuth(false);

  if (!fontsLoaded && splashDone) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={C.bg}
      />

      {!splashDone && <SplashScreen onFinish={handleSplashFinish} />}

      {splashDone && authReady && showAuth && (
        <AuthScreen onSuccess={handleAuthSuccess} />
      )}

      {splashDone && authReady && !showAuth && (
        <NavigationContainer>
          <MainTabs />
        </NavigationContainer>
      )}
    </>
  );
}

export default function App(): React.ReactElement {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
