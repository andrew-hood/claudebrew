import { ExpoConfig, ConfigContext } from "expo/config";

const IS_DEV = process.env.APP_VARIANT === "development";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? "ClaudeBrew (Dev)" : "ClaudeBrew",
  slug: "claudebrew",
  owner: "aphlabs-organization",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    backgroundColor: "#1C1410",
  },
  plugins: [
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission:
          "ClaudeBrew needs camera access to scan QR codes from your terminal.",
      },
    ],
    [
      "expo-notifications",
      {
        sounds: [],
      },
    ],
  ],
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_DEV ? "com.claudebrew.app.dev" : "com.claudebrew.app",
    infoPlist: {
      NSCameraUsageDescription:
        "ClaudeBrew needs camera access to scan QR codes from your terminal.",
      NSUserNotificationAlertUsageDescription:
        "ClaudeBrew notifies you when Claude Code needs permission to use a tool.",
      NSLocalNetworkUsageDescription:
        "ClaudeBrew connects to the daemon running on your Mac over your local WiFi network.",
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1C1410",
    },
    package: IS_DEV ? "com.claudebrew.app.dev" : "com.claudebrew.app",
  },
  extra: {
    eas: {
      projectId: "5d9aeab6-6333-4c4b-8808-a0a377910f1e",
    },
  },
});
