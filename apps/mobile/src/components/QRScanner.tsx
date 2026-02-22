import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors, spacing, radii, typography } from "../theme/tokens";

interface QRScannerProps {
  onScanned: (ip: string, pin: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScanned, onClose }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Camera access is needed to scan QR codes
        </Text>
        <TouchableOpacity
          style={styles.grantButton}
          onPress={requestPermission}
          accessibilityRole="button"
          accessibilityLabel="Grant camera permission"
        >
          <Text style={styles.grantButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel and go back"
        >
          <Text style={styles.closeButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityLabel="QR code scanner active">
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={
          scanned
            ? undefined
            : ({ data }) => {
                try {
                  const url = new URL(data);
                  const host = url.hostname;
                  const pin = url.searchParams.get("pin");
                  if (host && pin) {
                    setScanned(true);
                    onScanned(host, pin);
                  }
                } catch {
                  // not a valid URL, ignore
                }
              }
        }
      />
      <View style={styles.overlay} accessibilityElementsHidden>
        <View style={styles.reticle} />
        <Text style={styles.hint}>
          Point at the QR code in your terminal
        </Text>
      </View>
      <TouchableOpacity
        style={styles.closeFab}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close scanner"
      >
        <Text style={styles.closeFabText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  reticle: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: colors.claudeAmber,
    borderRadius: radii.md,
  },
  hint: {
    fontFamily: typography.dmSans.regular,
    fontSize: 14,
    color: colors.cremaLight,
    marginTop: spacing.lg,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  closeFab: {
    position: "absolute",
    top: 60,
    right: spacing.xl,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brewDark,
    justifyContent: "center",
    alignItems: "center",
  },
  closeFabText: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 18,
    color: colors.cremaLight,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  permissionText: {
    fontFamily: typography.dmSans.regular,
    fontSize: 16,
    color: colors.cremaLight,
    textAlign: "center",
  },
  grantButton: {
    backgroundColor: colors.claudeAmber,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  grantButtonText: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 16,
    color: colors.brewDark,
  },
  closeButton: {
    paddingVertical: spacing.sm,
  },
  closeButtonText: {
    fontFamily: typography.dmSans.regular,
    fontSize: 14,
    color: colors.cremaDark,
  },
});
