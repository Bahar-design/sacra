import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Text, StatusBar, View, ActivityIndicator } from "react-native";
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
import { C } from "./src/theme";
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

// Floating glass tab bar — sits 18px off the bottom with rounded corners
function MainTabs(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const tabBarBottom = 18 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          bottom: tabBarBottom,
          left: 18,
          right: 18,
          height: 66,
          borderRadius: 24,
          backgroundColor: "rgba(255,255,255,0.92)",
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: C.hair,
          elevation: 12,
          shadowColor: C.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 1,
          shadowRadius: 24,
        },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.text3,
        tabBarLabelStyle: {
          fontFamily: "HankenGrotesk_700Bold",
          fontSize: 10,
          letterSpacing: 0.2,
          marginTop: -2,
        },
        tabBarItemStyle: { paddingTop: 10 },
      }}
    >
      <Tab.Screen
        name="Discover"
        component={HomeStack}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20, lineHeight: 22 }}>✦</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Listen"
        component={ListenStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 20 }}>
              {[8, 14, 20, 14, 8].map((h, i) => (
                <View key={i} style={{ width: 2.5, height: h, backgroundColor: color, borderRadius: 2 }} />
              ))}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStack}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 19, lineHeight: 22 }}>⊙</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Sacred"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18, lineHeight: 22 }}>◆</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setShowAuth(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSplashFinish = () => setSplashDone(true);
  const handleAuthSuccess = () => setShowAuth(false);

  // Wait for fonts before showing anything meaningful
  if (!fontsLoaded && splashDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={C.accent} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

        {!splashDone && <SplashScreen onFinish={handleSplashFinish} />}

        {splashDone && authReady && showAuth && (
          <AuthScreen onSuccess={handleAuthSuccess} />
        )}

        {splashDone && authReady && !showAuth && (
          <NavigationContainer>
            <MainTabs />
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
