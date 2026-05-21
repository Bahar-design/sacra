import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Text, StatusBar } from "react-native";
import { Session } from "@supabase/supabase-js";
import { initOfflineDB } from "./src/lib/offlineStorage";
import { supabase } from "./src/lib/supabase";
import { theme } from "./src/theme";
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

// Each tab wraps its screen in a Stack so it can push to PrayerDetail
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

// Tab bar needs insets so it sits above the Android gesture bar
function MainTabs(): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.goldBorder,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
        },
        tabBarActiveTintColor: theme.colors.gold,
        tabBarInactiveTintColor: theme.colors.parchmentMuted,
        tabBarLabelStyle: {
          fontFamily: "System",
          fontSize: 9,
          letterSpacing: 1,
          textTransform: "uppercase",
        },
      }}
    >
      <Tab.Screen
        name="Discover"
        component={HomeStack}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>✦</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Listen"
        component={ListenStack}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>◎</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchStack}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>⊕</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Sacred"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>◆</Text>
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

  useEffect(() => {
    initOfflineDB();

    // Get existing session on startup
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // If no session, show auth screen after splash
      if (!session) setShowAuth(true);
      setAuthReady(true);
    });

    // Listen for sign-in / sign-out events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        // User signed out — show auth screen again
        setShowAuth(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSplashFinish = () => {
    setSplashDone(true);
  };

  const handleAuthSuccess = () => {
    setShowAuth(false);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle="light-content"
          backgroundColor={theme.colors.ink}
        />

        {/* 1. Splash screen — always shows first for 2.8 seconds */}
        {!splashDone && <SplashScreen onFinish={handleSplashFinish} />}

        {/* 2. Auth screen — shows after splash if user is not signed in */}
        {splashDone && authReady && showAuth && (
          <AuthScreen onSuccess={handleAuthSuccess} />
        )}

        {/* 3. Main app — shows after auth (or after skipping auth) */}
        {splashDone && authReady && !showAuth && (
          <NavigationContainer>
            <MainTabs />
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
