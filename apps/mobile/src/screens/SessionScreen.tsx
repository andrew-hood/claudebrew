import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
  AccessibilityInfo,
} from "react-native";
import { colors, spacing, radii, typography } from "../theme/tokens";
import {
  PermissionRequestMessage,
  SessionState,
  isAskUserQuestion,
} from "../types/protocol";
import { QuestionPrompt } from "../components/QuestionPrompt";

interface SessionDetailScreenProps {
  session: SessionState;
  onPermissionResponse: (
    sessionId: string,
    toolUseId: string,
    decision: "allow" | "deny",
    reason?: string,
  ) => void;
  onBack: () => void;
}

function getTerminalLineColor(line: string): string {
  if (line.includes("✓") || line.startsWith("✔")) return colors.terminalSuccess;
  if (
    line.startsWith("🔧") ||
    line.startsWith("→") ||
    line.includes("[info]") ||
    line.startsWith("💬")
  )
    return colors.terminalInfo;
  if (line.startsWith("✗") || line.includes("[error]")) return colors.offline;
  return colors.terminalMuted;
}

function isToolHeader(line: string): boolean {
  return line.startsWith("🔧");
}

export function SessionDetailScreen({
  session,
  onPermissionResponse,
  onBack,
}: SessionDetailScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;
  const permSlideAnim = useRef(new Animated.Value(0)).current;
  const permOpacityAnim = useRef(new Animated.Value(0)).current;
  const [terminalExpanded, setTerminalExpanded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const prevPermissionRef = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const isActive = session.status === "waiting" || session.status === "working";

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  // Slide-up animation when permission arrives
  useEffect(() => {
    const currentId = session.pendingPermission?.toolUseId ?? null;
    if (currentId && currentId !== prevPermissionRef.current) {
      if (reduceMotion) {
        permSlideAnim.setValue(0);
        permOpacityAnim.setValue(1);
      } else {
        permSlideAnim.setValue(40);
        permOpacityAnim.setValue(0);
        Animated.parallel([
          Animated.spring(permSlideAnim, {
            toValue: 0,
            useNativeDriver: true,
            speed: 12,
            bounciness: 6,
          }),
          Animated.timing(permOpacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else if (!currentId) {
      permSlideAnim.setValue(40);
      permOpacityAnim.setValue(0);
    }
    prevPermissionRef.current = currentId;
  }, [session.pendingPermission, permSlideAnim, permOpacityAnim, reduceMotion]);

  useEffect(() => {
    if (!isActive || reduceMotion) {
      pulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isActive, pulseAnim, reduceMotion]);

  useEffect(() => {
    if (session.pendingPermission || reduceMotion) {
      breathAnim.setValue(1);
      return;
    }
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: 1.03,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [session.pendingPermission, breathAnim, reduceMotion]);

  const statusColor =
    session.status === "waiting"
      ? colors.waiting
      : session.status === "working"
        ? colors.working
        : session.status === "done"
          ? colors.connected
          : colors.connected;

  const statusLabel =
    session.status === "waiting"
      ? "Waiting"
      : session.status === "working"
        ? "Working"
        : session.status === "done"
          ? "Done"
          : "Connected";

  const terminalLines = terminalExpanded
    ? session.outputLines
    : session.outputLines.slice(-10);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to session list"
        >
          <Text style={styles.backText}>‹ Sessions</Text>
        </TouchableOpacity>
        <View
          style={[styles.statusPill, { backgroundColor: statusColor + "1F" }]}
          accessibilityLabel={`Status: ${statusLabel}`}
        >
          <Animated.View
            style={[
              styles.statusDot,
              {
                backgroundColor: statusColor,
                opacity: reduceMotion ? 1 : pulseAnim,
              },
            ]}
            accessibilityElementsHidden
          />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      {/* Session label */}
      <Text
        style={styles.sessionLabel}
        numberOfLines={2}
        accessibilityRole="header"
      >
        {session.label}
      </Text>

      {/* Terminal output */}
      {session.outputLines.length > 0 && (
        <View style={styles.terminalWrapper}>
          <ScrollView
            ref={scrollRef}
            style={[
              styles.terminal,
              terminalExpanded && styles.terminalExpanded,
            ]}
            contentContainerStyle={styles.terminalContent}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: false })
            }
            accessibilityElementsHidden
          >
            {terminalLines.map((line, i) => {
              const showDivider =
                isToolHeader(line) &&
                i > 0 &&
                !isToolHeader(terminalLines[i - 1]);
              return (
                <View key={i}>
                  {showDivider && <View style={styles.terminalDivider} />}
                  <Text
                    style={[
                      styles.terminalLine,
                      { color: getTerminalLineColor(line) },
                      isToolHeader(line) && styles.terminalToolHeader,
                    ]}
                    numberOfLines={terminalExpanded ? undefined : 1}
                  >
                    {line}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          {!terminalExpanded && session.outputLines.length > 10 && (
            <View style={styles.terminalFadeGradient} pointerEvents="none" />
          )}
          <TouchableOpacity
            onPress={() => setTerminalExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`Terminal output, ${session.outputLines.length} lines. ${terminalExpanded ? "Collapse" : "Expand"}`}
          >
            <Text style={styles.terminalToggle}>
              {terminalExpanded
                ? "▲ Collapse"
                : `▼ ${session.outputLines.length} lines`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main content */}
      <View style={styles.content}>
        {session.pendingPermission ? (
          <Animated.View
            style={
              reduceMotion
                ? undefined
                : {
                    transform: [{ translateY: permSlideAnim }],
                    opacity: permOpacityAnim,
                  }
            }
          >
            {isAskUserQuestion(session.pendingPermission) ? (
              <QuestionPrompt
                msg={session.pendingPermission}
                onSubmit={(reason) =>
                  onPermissionResponse(
                    session.pendingPermission!.sessionId,
                    session.pendingPermission!.toolUseId,
                    "deny",
                    reason,
                  )
                }
                onSkip={() =>
                  onPermissionResponse(
                    session.pendingPermission!.sessionId,
                    session.pendingPermission!.toolUseId,
                    "deny",
                  )
                }
              />
            ) : (
              <PermissionPrompt
                msg={session.pendingPermission}
                onAllow={() =>
                  onPermissionResponse(
                    session.pendingPermission!.sessionId,
                    session.pendingPermission!.toolUseId,
                    "allow",
                  )
                }
                onDeny={() =>
                  onPermissionResponse(
                    session.pendingPermission!.sessionId,
                    session.pendingPermission!.toolUseId,
                    "deny",
                  )
                }
              />
            )}
          </Animated.View>
        ) : (
          <View style={styles.idle}>
            <Animated.Text
              style={[
                styles.idleIcon,
                !reduceMotion && { transform: [{ scale: breathAnim }] },
              ]}
              accessibilityElementsHidden
            >
              ☕
            </Animated.Text>
            <Text style={styles.idleText}>
              Claude is working...{"\n"}enjoy your coffee
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function PermissionPrompt({
  msg,
  onAllow,
  onDeny,
}: {
  msg: PermissionRequestMessage;
  onAllow: () => void;
  onDeny: () => void;
}) {
  const inputPreview = msg.toolInput
    ? Object.entries(msg.toolInput)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
        .join("\n")
    : "";

  return (
    <View
      style={styles.permissionCard}
      accessibilityRole="alert"
      accessibilityLabel={`Permission request: Claude wants to use ${msg.tool}${inputPreview ? `. Input: ${inputPreview}` : ""}`}
    >
      <Text style={styles.permissionLabel}>PERMISSION REQUEST</Text>
      <Text style={styles.permissionTool}>{msg.tool}</Text>
      {inputPreview ? (
        <View style={styles.permissionInputBlock}>
          <Text style={styles.permissionInput} numberOfLines={6}>
            {inputPreview}
          </Text>
        </View>
      ) : null}
      <View style={styles.permissionButtons}>
        <TouchableOpacity
          style={[styles.permBtn, styles.denyBtn]}
          onPress={onDeny}
          accessibilityRole="button"
          accessibilityLabel={`Deny ${msg.tool}`}
          accessibilityHint="Prevents Claude from using this tool"
        >
          <Text style={styles.denyText}>Deny</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permBtn, styles.allowBtn]}
          onPress={onAllow}
          accessibilityRole="button"
          accessibilityLabel={`Allow ${msg.tool}`}
          accessibilityHint="Permits Claude to use this tool"
        >
          <Text style={styles.allowText}>Allow</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: spacing.xs,
  },
  backBtn: { paddingVertical: spacing.xs },
  backText: {
    fontFamily: typography.dmSans.regular,
    fontSize: 16,
    color: colors.claudeAmber,
  },
  sessionLabel: {
    fontFamily: typography.fraunces.bold,
    fontSize: 18,
    color: colors.cremaLight,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    lineHeight: 24,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    gap: spacing.xs,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  terminalWrapper: {
    marginHorizontal: spacing.md,
    position: "relative",
  },
  terminalFadeGradient: {
    position: "absolute",
    top: 1,
    left: 1,
    right: 1,
    height: 28,
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
    backgroundColor: colors.brewDark,
    opacity: 0.8,
  },
  terminal: {
    maxHeight: 200,
    backgroundColor: colors.brewDark,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brewSurface,
  },
  terminalExpanded: {
    maxHeight: 400,
  },
  terminalContent: { gap: 2 },
  terminalDivider: {
    height: 1,
    backgroundColor: colors.brewSurface,
    marginVertical: spacing.xs,
    opacity: 0.5,
  },
  terminalLine: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  terminalToolHeader: {
    color: colors.terminalInfo,
    marginTop: 1,
  },
  terminalToggle: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.brewMuted,
    textAlign: "center",
    paddingTop: spacing.xs,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  idle: { alignItems: "center", gap: spacing.md },
  idleIcon: { fontSize: 48 },
  idleText: {
    fontFamily: typography.fraunces.italic,
    fontSize: 16,
    color: colors.cremaDark,
    textAlign: "center",
    lineHeight: 24,
  },
  permissionCard: {
    backgroundColor: colors.brewMedium,
    borderWidth: 1,
    borderColor: colors.waiting,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: colors.claudeAmber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  permissionLabel: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.waiting,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  permissionTool: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 18,
    color: colors.cremaLight,
  },
  permissionInputBlock: {
    backgroundColor: colors.brewDark,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brewSurface,
  },
  permissionInput: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.terminalMuted,
    lineHeight: 17,
  },
  permissionButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  permBtn: {
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
});
