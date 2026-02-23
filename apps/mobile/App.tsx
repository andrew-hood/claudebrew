import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Animated } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useAppFonts } from './src/theme/fonts';
import { colors } from './src/theme/tokens';
import { useConnection } from './src/hooks/useConnection';
import { usePermissionNotifications } from './src/hooks/usePermissionNotifications';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { SessionListScreen } from './src/screens/SessionListScreen';
import { SessionDetailScreen } from './src/screens/SessionScreen';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type Screen = 'connect' | 'list' | 'detail';

function useScreenKey(connection: ReturnType<typeof useConnection>, selectedSessionId: string | null): Screen {
  if (connection.state !== 'connected') return 'connect';
  if (selectedSessionId) return 'detail';
  return 'list';
}

export default function App() {
  const fontsLoaded = useAppFonts();
  const connection = useConnection();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const screen = useScreenKey(connection, selectedSessionId);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevScreenRef = useRef<Screen>(screen);

  // Fade transition on screen change
  useEffect(() => {
    if (prevScreenRef.current !== screen) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      prevScreenRef.current = screen;
    }
  }, [screen, fadeAnim]);

  // Clear selection on disconnect
  useEffect(() => {
    if (connection.state !== 'connected') {
      setSelectedSessionId(null);
    }
  }, [connection.state]);

  // Request OS notification permission once
  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  // Fire haptics + background OS notifications on permission requests
  usePermissionNotifications(connection.sessions);

  // Notification tap → navigate to relevant session
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { sessionId?: string };
      if (data?.sessionId) setSelectedSessionId(data.sessionId);
    });
    return () => sub.remove();
  }, []);

  // Auto-navigate: if on list and exactly one session has a pending permission, open it
  useEffect(() => {
    if (selectedSessionId !== null) return;
    const withPending = connection.sessions.filter((s) => s.pendingPermission !== null);
    if (withPending.length === 1) {
      setSelectedSessionId(withPending[0].sessionId);
    }
  }, [connection.sessions, selectedSessionId]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const selectedSession = selectedSessionId
    ? connection.sessions.find((s) => s.sessionId === selectedSessionId) ?? null
    : null;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <Animated.View style={[styles.screenWrapper, { opacity: fadeAnim }]}>
          {connection.state === 'connected' ? (
            selectedSession ? (
              <SessionDetailScreen
                session={selectedSession}
                onPermissionResponse={connection.sendPermissionResponse}
                onBack={() => setSelectedSessionId(null)}
              />
            ) : (
              <SessionListScreen
                sessions={connection.sessions}
                onSelectSession={setSelectedSessionId}
                onDisconnect={connection.disconnect}
                onPermissionResponse={connection.sendPermissionResponse}
              />
            )
          ) : (
            <ConnectScreen
              connecting={connection.state === 'connecting'}
              onConnect={connection.connectTo}
              initialIp={connection.ip}
            />
          )}
        </Animated.View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brewDark,
  },
  screenWrapper: {
    flex: 1,
  },
});
