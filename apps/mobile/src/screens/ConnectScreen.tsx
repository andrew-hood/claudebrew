import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { QRScanner } from '../components/QRScanner';
import { colors, spacing, radii, typography } from '../theme/tokens';

interface ConnectScreenProps {
  connecting: boolean;
  onConnect: (ip: string, pin: string) => void;
}

export function ConnectScreen({ connecting, onConnect }: ConnectScreenProps) {
  const [ip, setIp] = useState('');
  const [pin, setPin] = useState('');
  const [scanning, setScanning] = useState(false);

  const canConnect = ip.trim().length > 0 && pin.trim().length === 4;

  if (scanning) {
    return (
      <QRScanner
        onScanned={(scannedIp, scannedPin) => {
          setScanning(false);
          onConnect(scannedIp, scannedPin);
        }}
        onClose={() => setScanning(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>ClaudeBrew</Text>
        <Text style={styles.tagline}>Brewing answers while you brew coffee</Text>
      </View>

      <View style={styles.form}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setScanning(true)}
          disabled={connecting}
        >
          <Text style={styles.scanButtonText}>Scan QR Code</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or enter manually</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.label}>MAC IP ADDRESS</Text>
        <TextInput
          style={styles.input}
          value={ip}
          onChangeText={setIp}
          placeholder="192.168.1.42"
          placeholderTextColor={colors.brewMuted}
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>PIN</Text>
        <TextInput
          style={styles.input}
          value={pin}
          onChangeText={setPin}
          placeholder="0000"
          placeholderTextColor={colors.brewMuted}
          keyboardType="number-pad"
          maxLength={4}
        />

        <TouchableOpacity
          style={[styles.button, !canConnect && styles.buttonDisabled]}
          onPress={() => onConnect(ip.trim(), pin.trim())}
          disabled={!canConnect || connecting}
        >
          <Text style={styles.buttonText}>{connecting ? 'Connecting...' : 'Connect'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logo: {
    fontFamily: typography.fraunces.bold,
    fontSize: 28,
    color: colors.cremaLight,
  },
  tagline: {
    fontFamily: typography.fraunces.italic,
    fontSize: 16,
    color: colors.cremaDark,
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 10,
    color: colors.cremaDark,
    letterSpacing: 1.5,
    marginTop: spacing.md,
  },
  input: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 16,
    color: colors.cremaLight,
    backgroundColor: colors.brewMedium,
    borderWidth: 1,
    borderColor: colors.brewSurface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  scanButton: {
    borderWidth: 1,
    borderColor: colors.claudeAmber,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  scanButtonText: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 16,
    color: colors.claudeAmber,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.brewSurface,
  },
  dividerText: {
    fontFamily: typography.dmSans.regular,
    fontSize: 12,
    color: colors.brewMuted,
    marginHorizontal: spacing.md,
  },
  button: {
    backgroundColor: colors.claudeAmber,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 16,
    color: colors.brewDark,
  },
});
