import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AccessibilityInfo,
} from "react-native";
import { QRScanner } from "../components/QRScanner";
import { colors, spacing, radii, typography } from "../theme/tokens";

interface ConnectScreenProps {
  connecting: boolean;
  onConnect: (ip: string, pin: string) => void;
  initialIp?: string;
  error?: string | null;
}

export function ConnectScreen({ connecting, onConnect, initialIp, error }: ConnectScreenProps) {
  const [ip, setIp] = useState(initialIp ?? "");
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [scanning, setScanning] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pinRefs = useRef<(TextInput | null)[]>([null, null, null, null]);

  const steamAnim = useRef(new Animated.Value(0)).current;
  const steamOpacity = useRef(new Animated.Value(0.7)).current;

  // Sync initialIp when it arrives (e.g. after auto-connect fallback)
  useEffect(() => {
    if (initialIp && !ip) setIp(initialIp);
  }, [initialIp]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const steam = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(steamAnim, {
            toValue: -6,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(steamAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(steamOpacity, {
            toValue: 0.3,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(steamOpacity, {
            toValue: 0.7,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    steam.start();
    return () => steam.stop();
  }, [steamAnim, steamOpacity, reduceMotion]);

  const pin = pinDigits.join("");
  const canConnect = ip.trim().length > 0 && pin.length === 4;

  const handlePinChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);

    if (digit && index < 3) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !pinDigits[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
      const next = [...pinDigits];
      next[index - 1] = "";
      setPinDigits(next);
    }
  };

  const handleConnect = () => {
    onConnect(ip.trim(), pin);
  };

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
      <View style={styles.hero} accessibilityRole="header">
        <View style={styles.logoMark}>
          <Text style={styles.logoIcon} accessibilityElementsHidden>
            ☕
          </Text>
          {!reduceMotion && (
            <Animated.Text
              style={[
                styles.steam,
                { transform: [{ translateY: steamAnim }], opacity: steamOpacity },
              ]}
              accessibilityElementsHidden
            >
              ✦
            </Animated.Text>
          )}
        </View>
        <Text style={styles.logo} accessibilityRole="header">
          Claude<Text style={styles.logoHighlight}>Brew</Text>
        </Text>
        <Text style={styles.tagline}>
          Brewing answers while you brew coffee
        </Text>
      </View>

      <View style={styles.form}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setScanning(true)}
          disabled={connecting}
          accessibilityRole="button"
          accessibilityLabel="Scan QR code to connect"
          accessibilityHint="Opens camera to scan QR code from terminal"
        >
          <Text style={styles.scanButtonText}>Scan QR Code</Text>
        </TouchableOpacity>

        <View style={styles.divider} accessibilityElementsHidden>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or enter manually</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.label} accessibilityElementsHidden>
          IP ADDRESS
        </Text>
        <TextInput
          style={styles.input}
          value={ip}
          onChangeText={setIp}
          placeholder="192.168.1.42"
          placeholderTextColor={colors.brewMuted}
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="IP address"
          accessibilityHint="Enter the IP address shown in your terminal"
        />

        <Text style={styles.label} accessibilityElementsHidden>
          PIN
        </Text>
        <View
          style={styles.pinRow}
          accessibilityLabel={`PIN code, ${pin.length} of 4 digits entered`}
          accessibilityRole="text"
        >
          {pinDigits.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => {
                pinRefs.current[i] = ref;
              }}
              style={[styles.pinBox, digit ? styles.pinBoxFilled : null]}
              value={digit}
              onChangeText={(text) => handlePinChange(text, i)}
              onKeyPress={({ nativeEvent }) =>
                handlePinKeyPress(nativeEvent.key, i)
              }
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
              accessibilityLabel={`PIN digit ${i + 1}`}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, !canConnect && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={!canConnect || connecting}
          accessibilityRole="button"
          accessibilityLabel={connecting ? "Connecting" : "Connect to daemon"}
          accessibilityState={{ disabled: !canConnect || connecting, busy: connecting }}
        >
          <Text style={styles.buttonText}>
            {connecting ? "Connecting..." : "Connect"}
          </Text>
        </TouchableOpacity>

        {error && !connecting && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              Check that the daemon is running and both devices are on the same WiFi network.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  hero: {
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
  logoMark: {
    position: "relative",
    alignItems: "center",
    marginBottom: spacing.md,
    height: 64,
    justifyContent: "flex-end",
  },
  logoIcon: {
    fontSize: 40,
  },
  steam: {
    position: "absolute",
    top: 0,
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 14,
    color: colors.claudeAmber,
  },
  logo: {
    fontFamily: typography.fraunces.bold,
    fontSize: 28,
    color: colors.cremaLight,
  },
  logoHighlight: {
    color: colors.claudeGold,
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
    fontSize: 11,
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
  pinRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  pinBox: {
    flex: 1,
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 24,
    color: colors.cremaLight,
    backgroundColor: colors.brewMedium,
    borderWidth: 1,
    borderColor: colors.brewSurface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    height: 56,
  },
  pinBoxFilled: {
    borderColor: colors.claudeAmber,
  },
  scanButton: {
    borderWidth: 1,
    borderColor: colors.claudeAmber,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  scanButtonText: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 16,
    color: colors.claudeAmber,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
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
  errorBox: {
    marginTop: spacing.md,
    backgroundColor: colors.brewMedium,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#6B3A3A',
    padding: spacing.md,
  },
  errorText: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 14,
    color: '#E8A0A0',
  },
  errorHint: {
    fontFamily: typography.dmSans.regular,
    fontSize: 12,
    color: colors.cremaDark,
    marginTop: spacing.xs,
  },
});
