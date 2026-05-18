import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, StatusBar } from "react-native";
import { initOfflineDB } from "./src/lib/offlineStorage";
import { theme } from "./src/theme";
import HomeScreen from "./src/screens/HomeScreen";
import ListenScreen from "./src/screens/ListenScreen";
import SearchScreen from "./src/screens/SearchScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import PrayerDetailScreen from "./src/screens/PrayerDetailScreen";
import CommunitySubmitScreen from "./src/screens/CommunitySubmitScreen";

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

export default function App() {
  useEffect(() => {
    initOfflineDB();
  }, []); // initialize SQLite on first launch
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle="light-content"
          backgroundColor={theme.colors.ink}
        />
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: theme.colors.surface,
                borderTopWidth: 1,
                borderTopColor: theme.colors.goldBorder,
                height: 60,
                paddingBottom: 8,
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
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
