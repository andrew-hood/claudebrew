import React, { useEffect } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAppFonts } from './src/theme/fonts';
import { colors } from './src/theme/tokens';
import { useConnection } from './src/hooks/useConnection';
import { ConnectScreen } from './src/screens/ConnectScreen';
import { SessionScreen } from './src/screens/SessionScreen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const fontsLoaded = useAppFonts();
  const connection = useConnection();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {connection.state === 'connected' ? (
        <SessionScreen
          status={connection.status}
          pendingPermission={connection.pendingPermission}
          outputLines={connection.outputLines}
          onPermissionResponse={connection.sendPermissionResponse}
          onDisconnect={connection.disconnect}
        />
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
