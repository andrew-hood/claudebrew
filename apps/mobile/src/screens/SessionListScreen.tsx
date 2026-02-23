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
import { SessionState, isAskUserQuestion, isExitPlanMode } from "../types/protocol";

const SWIPE_THRESHOLD = 80;

interface Props {
  sessions: SessionState[];
  onSelectSession: (sessionId: string) => void;
  onDisconnect: () => void;
  onPermissionResponse: (
    sessionId: string,
    toolUseId: string,
    decision: "allow" | "deny",
    reason?: string,
  ) => void;
}

export function SessionListScreen({
  sessions,
  onSelectSession,
  onDisconnect,
  onPermissionResponse,
}: Props) {
  const pendingSessions = sessions.filter((s) => s.pendingPermission);
  const otherSessions = sessions.filter((s) => !s.pendingPermission);

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
          {pendingSessions.map((session) => (
            <ActionCard
              key={session.sessionId}
              session={session}
              onPress={() => onSelectSession(session.sessionId)}
              onPermissionResponse={onPermissionResponse}
            />
          ))}
          {otherSessions.length > 0 && (
            <View style={styles.compactSection}>
              {pendingSessions.length > 0 && (
                <Text style={styles.sectionLabel}>Active Sessions</Text>
              )}
              {otherSessions.map((session) => (
                <CompactRow
                  key={session.sessionId}
                  session={session}
                  onPress={() => onSelectSession(session.sessionId)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ActionCard({
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
    reason?: string,
  ) => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const hasTriggeredHaptic = useRef(false);
  const perm = session.pendingPermission!;
  const isQuestion = isAskUserQuestion(perm);
  const isPlan = isExitPlanMode(perm);
  const needsDetailScreen = isQuestion || isPlan;

  const inputPreview = isPlan
    ? (perm.planContent?.slice(0, 120) ?? null)
    : isQuestion
      ? (((perm.toolInput as any)?.questions as any[])
          ?.map((q: any) => q.question)
          .join("; ")
          .slice(0, 120) ?? null)
      : perm.toolInput
        ? Object.entries(perm.toolInput)
            .map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`)
            .join("\n")
        : null;

  const respond = useCallback(
    (decision: "allow" | "deny") => {
      onPermissionResponse(session.sessionId, perm.toolUseId, decision);
    },
    [session.sessionId, perm.toolUseId, onPermissionResponse],
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        !needsDetailScreen &&
        Math.abs(gs.dx) > 10 &&
        Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: () => {
        hasTriggeredHaptic.current = false;
      },
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx);
        if (!hasTriggeredHaptic.current && Math.abs(gs.dx) >= SWIPE_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          hasTriggeredHaptic.current = true;
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: 400,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            respond("allow");
            translateX.setValue(0);
          });
        } else if (gs.dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: -400,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            respond("deny");
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

  const allowOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const denyOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isPlan
          ? `Plan review for ${session.label}. Tap to review.`
          : isQuestion
            ? `Question from ${session.label}. Tap to answer.`
            : `Permission request: ${session.label} wants to use ${perm.tool}. Swipe right to allow, left to deny.`
      }
    >
      <View style={aStyles.swipeContainer}>
        {!needsDetailScreen && (
          <>
            <Animated.View
              style={[aStyles.revealAllow, { opacity: allowOpacity }]}
              accessibilityElementsHidden
            >
              <Text style={aStyles.revealText}>✓ Allow</Text>
            </Animated.View>
            <Animated.View
              style={[aStyles.revealDeny, { opacity: denyOpacity }]}
              accessibilityElementsHidden
            >
              <Text style={aStyles.revealText}>✗ Deny</Text>
            </Animated.View>
          </>
        )}
        <Animated.View
          style={[aStyles.card, !needsDetailScreen && { transform: [{ translateX }] }]}
          {...(!needsDetailScreen ? panResponder.panHandlers : {})}
        >
          <View style={aStyles.topRow}>
            <Text style={aStyles.requestLabel}>
              {isPlan ? "PLAN REVIEW" : isQuestion ? "QUESTION" : "PERMISSION REQUEST"}
            </Text>
            <Text style={aStyles.sessionMeta}>{session.label}</Text>
          </View>
          <Text style={aStyles.toolName}>
            {isPlan ? "Review plan" : isQuestion ? "Claude has a question" : perm.tool}
          </Text>
          {inputPreview && (
            <View style={aStyles.inputBlock}>
              <Text style={aStyles.inputText} numberOfLines={3}>
                {inputPreview}
              </Text>
            </View>
          )}
          {session.cwd && (
            <Text style={aStyles.cwd} numberOfLines={1}>
              📁 {session.cwd}
            </Text>
          )}
          {needsDetailScreen ? (
            <Text style={aStyles.swipeHint}>
              {isPlan ? "tap to review" : "tap to answer"}
            </Text>
          ) : (
            <View style={aStyles.buttons}>
              <TouchableOpacity
                style={[aStyles.btn, aStyles.denyBtn]}
                onPress={() => respond("deny")}
                accessibilityRole="button"
                accessibilityLabel={`Deny ${perm.tool}`}
              >
                <Text style={aStyles.denyText}>Deny</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[aStyles.btn, aStyles.allowBtn]}
                onPress={() => respond("allow")}
                accessibilityRole="button"
                accessibilityLabel={`Allow ${perm.tool}`}
              >
                <Text style={aStyles.allowText}>Allow</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const aStyles = StyleSheet.create({
  swipeContainer: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.xl,
    marginBottom: spacing.sm,
  },
  revealAllow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.connected + "28",
    borderRadius: radii.xl,
    justifyContent: "center",
    paddingLeft: spacing.lg,
  },
  revealDeny: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.offline + "28",
    borderRadius: radii.xl,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: spacing.lg,
  },
  revealText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 14,
    color: colors.cremaLight,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.brewMedium,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.waiting,
    shadowColor: colors.claudeAmber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  requestLabel: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 10,
    color: colors.waiting,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sessionMeta: {
    fontFamily: typography.dmSans.regular,
    fontSize: 12,
    color: colors.cremaDark,
  },
  toolName: {
    fontFamily: typography.fraunces.bold,
    fontSize: 24,
    color: colors.cremaLight,
    lineHeight: 30,
  },
  inputBlock: {
    backgroundColor: colors.brewDark,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brewSurface,
  },
  inputText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.terminalMuted,
    lineHeight: 17,
  },
  cwd: {
    fontFamily: typography.dmSans.light,
    fontSize: 11,
    color: colors.brewMuted,
  },
  buttons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
    alignItems: "center",
  },
  denyBtn: {
    backgroundColor: colors.brewDark,
    borderWidth: 1,
    borderColor: colors.offline,
  },
  denyText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 14,
    color: colors.offline,
  },
  allowBtn: { backgroundColor: colors.claudeAmber },
  allowText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 14,
    color: colors.brewDark,
  },
  swipeHint: {
    fontFamily: typography.dmSans.light,
    fontSize: 13,
    color: colors.claudeAmber,
    textAlign: "center",
    paddingVertical: spacing.xs,
  },
});

function CompactRow({
  session,
  onPress,
}: {
  session: SessionState;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const statusGlyph =
    session.status === "working" ? "◉" : session.status === "done" ? "✓" : "○";
  const statusColor =
    session.status === "working"
      ? colors.working
      : session.status === "done"
        ? colors.connected
        : colors.brewMuted;
  const statusLabel =
    session.status === "working"
      ? "Working"
      : session.status === "done"
        ? "Done"
        : "Idle";

  const lastLine = session.outputLines.at(-1) ?? "";

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(scaleAnim, {
          toValue: 0.98,
          useNativeDriver: true,
          speed: 50,
          bounciness: 4,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 50,
          bounciness: 4,
        }).start()
      }
      accessibilityRole="button"
      accessibilityLabel={`${session.label}, ${statusLabel}`}
      accessibilityHint="Opens session details"
    >
      <Animated.View
        style={[rStyles.row, { transform: [{ scale: scaleAnim }] }]}
      >
        <Text style={[rStyles.glyph, { color: statusColor }]}>
          {statusGlyph}
        </Text>
        <View style={rStyles.body}>
          <View style={rStyles.titleRow}>
            <Text style={rStyles.label} numberOfLines={1}>
              {session.label}
            </Text>
            <View
              style={[rStyles.pill, { backgroundColor: statusColor + "1F" }]}
            >
              <Text style={[rStyles.pillText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>
          {lastLine ? (
            <Text style={rStyles.lastLine} numberOfLines={1}>
              {lastLine}
            </Text>
          ) : null}
        </View>
        <Text style={rStyles.chevron} accessibilityElementsHidden>
          ›
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const rStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brewSurface + "80",
  },
  glyph: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 14,
    width: 16,
    textAlign: "center",
  },
  body: { flex: 1, gap: 2 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 15,
    color: colors.cremaLight,
    flex: 1,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  pillText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  lastLine: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.terminalMuted,
    lineHeight: 16,
  },
  chevron: {
    fontFamily: typography.dmSans.light,
    fontSize: 22,
    color: colors.brewMuted,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
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
  compactSection: {
    gap: 0,
  },
  sectionLabel: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 10,
    color: colors.brewMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
