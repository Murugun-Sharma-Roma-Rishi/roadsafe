import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './screens/HomeScreen';
import MapScreen from './screens/MapScreen';
import ReportScreen from './screens/ReportScreen';
import DriverScreen from './screens/DriverScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
            else if (route.name === 'Map') iconName = focused ? 'map' : 'map-outline';
            else if (route.name === 'Report') iconName = focused ? 'warning' : 'warning-outline';
            else if (route.name === 'Driver') iconName = focused ? 'car' : 'car-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#E74C3C',
          tabBarInactiveTintColor: '#95a5a6',
          tabBarStyle: {
            backgroundColor: '#1a1a2e',
            borderTopColor: '#16213e',
            paddingBottom: 5,
            height: 60,
          },
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: '🛡️ RoadSafe MU' }}
        />
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{ title: '🗺️ Hazard Map' }}
        />
        <Tab.Screen
          name="Report"
          component={ReportScreen}
          options={{ title: '📢 Report' }}
        />
        <Tab.Screen
          name="Driver"
          component={DriverScreen}
          options={{ title: '🚗 Driver Score' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}