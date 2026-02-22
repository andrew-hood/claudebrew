import React, { useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
  PanResponder,
  TouchableOpacity,
} from "react-native";
import * as Haptics from "expo-haptics";
import { colors, spacing, radii, typography } from "../theme/tokens";
import { SessionState } from "../types/protocol";

const SWIPE_THRESHOLD = 80;

interface Props {
  sessions: SessionState[];
  onSelectSession: (sessionId: string) => void;
  onDisconnect: () => void;
  onPermissionResponse: (
    sessionId: string,
    toolUseId: string,
    decision: "allow" | "deny",
  ) => void;
}

export function SessionListScreen({
  sessions,
  onSelectSession,
  onDisconnect,
  onPermissionResponse,
}: Props) {
  const pendingCount = sessions.filter((s) => s.pendingPermission).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo} accessibilityRole="header">
          Claude<Text style={styles.logoHighlight}>Brew</Text>
        </Text>
        <View style={styles.headerRight}>
          <View style={styles.connectedIndicator}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedLabel}>Connected</Text>
          </View>
          <TouchableOpacity
            onPress={onDisconnect}
            accessibilityRole="button"
            accessibilityLabel="Disconnect from daemon"
          >
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pending permissions banner */}
      {pendingCount > 0 && (
        <View
          style={styles.pendingBanner}
          accessibilityRole="alert"
          accessibilityLabel={`${pendingCount} permission ${pendingCount === 1 ? "request" : "requests"} waiting`}
        >
          <View style={styles.pendingBannerDot} />
          <Text style={styles.pendingBannerText}>
            {pendingCount} {pendingCount === 1 ? "permission request" : "permission requests"} waiting
          </Text>
        </View>
      )}

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon} accessibilityElementsHidden>
            ☕
          </Text>
          <Text style={styles.emptyText}>
            No active sessions{"\n"}start claude to begin
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          {sessions.map((session) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              onPress={() => onSelectSession(session.sessionId)}
              onPermissionResponse={onPermissionResponse}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SessionCard({
  session,
  onPress,
  onPermissionResponse,
}: {
  session: SessionState;
  onPress: () => void;
  onPermissionResponse: (
    sessionId: string,
    toolUseId: string,
    decision: "allow" | "deny",
  ) => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const hasTriggeredHaptic = useRef(false);

  const hasPending = !!session.pendingPermission;
  const statusColor = hasPending
    ? colors.waiting
    : session.status === "working"
      ? colors.working
      : session.status === "done"
        ? colors.connected
        : colors.brewMuted;

  const statusLabel = hasPending
    ? "Waiting"
    : session.status === "working"
      ? "Working"
      : session.status === "done"
        ? "Done"
        : "Idle";

  const lastLine = session.outputLines.at(-1) ?? "";

  const onPressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const onPressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!hasPending) return false;
        return (
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onPanResponderGrant: () => {
        hasTriggeredHaptic.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
        if (
          !hasTriggeredHaptic.current &&
          Math.abs(gestureState.dx) >= SWIPE_THRESHOLD
        ) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          hasTriggeredHaptic.current = true;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD && session.pendingPermission) {
          Animated.timing(translateX, {
            toValue: 300,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onPermissionResponse(
              session.sessionId,
              session.pendingPermission!.toolUseId,
              "allow",
            );
            translateX.setValue(0);
          });
        } else if (
          gestureState.dx < -SWIPE_THRESHOLD &&
          session.pendingPermission
        ) {
          Animated.timing(translateX, {
            toValue: -300,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onPermissionResponse(
              session.sessionId,
              session.pendingPermission!.toolUseId,
              "deny",
            );
            translateX.setValue(0);
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 30,
            bounciness: 8,
          }).start();
        }
        hasTriggeredHaptic.current = false;
      },
    }),
  ).current;

  const allowRevealOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const denyRevealOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const accessLabel = hasPending
    ? `${session.label}, ${statusLabel}, permission request for ${session.pendingPermission!.tool}. Swipe right to allow, left to deny`
    : `${session.label}, ${statusLabel}`;

  return (
    <View style={styles.swipeContainer}>
      {hasPending && (
        <>
          <Animated.View
            style={[
              styles.swipeReveal,
              styles.swipeRevealAllow,
              { opacity: allowRevealOpacity },
            ]}
            accessibilityElementsHidden
          >
            <Text style={styles.swipeRevealText}>✓ Allow</Text>
          </Animated.View>
          <Animated.View
            style={[
              styles.swipeReveal,
              styles.swipeRevealDeny,
              { opacity: denyRevealOpacity },
            ]}
            accessibilityElementsHidden
          >
            <Text style={styles.swipeRevealText}>✗ Deny</Text>
          </Animated.View>
        </>
      )}
      <Animated.View
        style={{ transform: [{ translateX: hasPending ? translateX : 0 }] }}
        {...(hasPending ? panResponder.panHandlers : {})}
      >
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={accessLabel}
          accessibilityHint="Opens session details"
        >
          <Animated.View
            style={[
              styles.card,
              hasPending && styles.cardPending,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <View
                  style={[styles.statusDot, { backgroundColor: statusColor }]}
                  accessibilityElementsHidden
                />
                <Text style={styles.cardLabel} numberOfLines={2}>
                  {session.label}
                </Text>
              </View>
              <View style={styles.cardHeaderRight}>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: statusColor + "1F" },
                  ]}
                >
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {statusLabel}
                  </Text>
                </View>
                <Text style={styles.chevron} accessibilityElementsHidden>
                  ›
                </Text>
              </View>
            </View>

            {hasPending ? (
              <View style={styles.permBadge}>
                <Text style={styles.permBadgeText}>
                  PERMISSION REQUEST · {session.pendingPermission!.tool}
                </Text>
                <Text style={styles.swipeHint}>
                  ← swipe to allow or deny →
                </Text>
              </View>
            ) : lastLine ? (
              <Text style={styles.lastLine} numberOfLines={1}>
                {lastLine}
              </Text>
            ) : null}

            {session.cwd ? (
              <View style={styles.cwdRow}>
                <Text style={styles.cwdIcon} accessibilityElementsHidden>
                  📁
                </Text>
                <Text style={styles.cwd} numberOfLines={1}>
                  {session.cwd}
                </Text>
              </View>
            ) : null}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop:
      (Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0) +
      spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  connectedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.connected,
  },
  connectedLabel: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 10,
    color: colors.connected,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  logo: {
    fontFamily: typography.fraunces.bold,
    fontSize: 20,
    color: colors.cremaLight,
  },
  logoHighlight: {
    color: colors.claudeGold,
  },
  disconnectText: {
    fontFamily: typography.dmSans.light,
    fontSize: 13,
    color: colors.brewMuted,
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.waiting + "1A",
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.waiting + "33",
  },
  pendingBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.waiting,
  },
  pendingBannerText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 12,
    color: colors.waiting,
    letterSpacing: 0.3,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: {
    fontFamily: typography.fraunces.italic,
    fontSize: 16,
    color: colors.cremaDark,
    textAlign: "center",
    lineHeight: 24,
  },
  list: { flex: 1 },
  listContent: { padding: spacing.md, gap: spacing.sm },
  swipeContainer: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.lg,
  },
  swipeReveal: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.lg,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  swipeRevealAllow: {
    backgroundColor: colors.connected + "30",
    alignItems: "flex-start",
  },
  swipeRevealDeny: {
    backgroundColor: colors.offline + "30",
    alignItems: "flex-end",
  },
  swipeRevealText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 14,
    color: colors.cremaLight,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.brewMedium,
    borderRadius: radii.lg,
    padding: spacing.md + 4,
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.brewSurface,
  },
  cardPending: {
    borderColor: colors.waiting,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardLabel: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 16,
    color: colors.cremaLight,
    flex: 1,
    lineHeight: 22,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  statusText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  chevron: {
    fontFamily: typography.dmSans.light,
    fontSize: 22,
    color: colors.brewMuted,
    marginLeft: -2,
  },
  permBadge: {
    backgroundColor: colors.waiting + "22",
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  permBadgeText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.waiting,
    letterSpacing: 0.5,
  },
  swipeHint: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 10,
    color: colors.brewMuted,
    letterSpacing: 0.5,
  },
  lastLine: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.terminalMuted,
    lineHeight: 17,
  },
  cwdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cwdIcon: {
    fontSize: 10,
  },
  cwd: {
    fontFamily: typography.dmSans.light,
    fontSize: 11,
    color: colors.brewMuted,
    flex: 1,
  },
});
