import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAppFonts } from './src/theme/fonts';
import { colors } from './src/theme/tokens';
import { useConnection } from './src/hooks/useConnection';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { SessionListScreen } from './src/screens/SessionListScreen';
import { SessionDetailScreen } from './src/screens/SessionScreen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const fontsLoaded = useAppFonts();
  const connection = useConnection();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Clear selection on disconnect
  useEffect(() => {
    if (connection.state !== 'connected') {
      setSelectedSessionId(null);
    }
  }, [connection.state]);

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
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
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
          />
        )
      ) : (
        <ConnectScreen
          connecting={connection.state === 'connecting'}
          onConnect={connection.connectTo}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brewDark,
  },
});
