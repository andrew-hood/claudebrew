import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AccessibilityInfo,
} from "react-native";
import { colors, spacing, radii, typography } from "../theme/tokens";
import {
  PermissionRequestMessage,
  SessionState,
  isAskUserQuestion,
  isExitPlanMode,
} from "../types/protocol";
import { QuestionPrompt } from "../components/QuestionPrompt";
import { PlanPrompt } from "../components/PlanPrompt";

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

const SHEET_HEIGHT = 280;

export function SessionDetailScreen({
  session,
  onPermissionResponse,
  onBack,
}: SessionDetailScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const permSlideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const permOpacityAnim = useRef(new Animated.Value(0)).current;
  const dimAnim = useRef(new Animated.Value(0)).current;
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

  // Sheet slide-in/out when permission arrives or clears
  useEffect(() => {
    const currentId = session.pendingPermission?.toolUseId ?? null;
    if (currentId && currentId !== prevPermissionRef.current) {
      if (reduceMotion) {
        permSlideAnim.setValue(0);
        permOpacityAnim.setValue(1);
        dimAnim.setValue(0.3);
      } else {
        permSlideAnim.setValue(SHEET_HEIGHT);
        permOpacityAnim.setValue(0);
        dimAnim.setValue(0);
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
          Animated.timing(dimAnim, {
            toValue: 0.3,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else if (!currentId) {
      permSlideAnim.setValue(SHEET_HEIGHT);
      permOpacityAnim.setValue(0);
      dimAnim.setValue(0);
    }
    prevPermissionRef.current = currentId;
  }, [session.pendingPermission, permSlideAnim, permOpacityAnim, dimAnim, reduceMotion]);

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

  const statusColor =
    session.status === "waiting"
      ? colors.waiting
      : session.status === "working"
        ? colors.working
        : colors.connected;

  const statusLabel =
    session.status === "waiting"
      ? "Waiting"
      : session.status === "working"
        ? "Working"
        : session.status === "done"
          ? "Done"
          : "Connected";

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

      {/* Full-screen terminal */}
      <ScrollView
        ref={scrollRef}
        style={styles.terminal}
        contentContainerStyle={styles.terminalContent}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: false })
        }
        accessibilityElementsHidden
      >
        {session.outputLines.map((line, i) => {
          const showDivider =
            isToolHeader(line) &&
            i > 0 &&
            !isToolHeader(session.outputLines[i - 1]);
          return (
            <View key={i}>
              {showDivider && <View style={styles.terminalDivider} />}
              <Text
                style={[
                  styles.terminalLine,
                  { color: getTerminalLineColor(line) },
                  isToolHeader(line) && styles.terminalToolHeader,
                ]}
              >
                {line}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Dim overlay */}
      <Animated.View
        style={[styles.dimOverlay, { opacity: dimAnim }]}
        pointerEvents="none"
      />

      {/* Permission sheet */}
      {session.pendingPermission && (
        <Animated.View
          style={[
            styles.sheet,
            reduceMotion
              ? undefined
              : {
                  transform: [{ translateY: permSlideAnim }],
                  opacity: permOpacityAnim,
                },
          ]}
        >
          {isExitPlanMode(session.pendingPermission) ? (
            <PlanPrompt
              msg={session.pendingPermission}
              onResponse={(decision, reason) =>
                onPermissionResponse(
                  session.pendingPermission!.sessionId,
                  session.pendingPermission!.toolUseId,
                  decision,
                  reason,
                )
              }
            />
          ) : isAskUserQuestion(session.pendingPermission) ? (
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
      )}
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
      accessibilityRole="alert"
      accessibilityLabel={`Permission request: Claude wants to use ${msg.tool}${inputPreview ? `. Input: ${inputPreview}` : ""}`}
    >
      <Text style={styles.permissionLabel}>PERMISSION REQUEST</Text>
      <Text style={styles.permissionTool}>{msg.tool}</Text>
      {inputPreview ? (
        <Text style={styles.permissionInput} numberOfLines={4}>
          {inputPreview}
        </Text>
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
  terminal: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  terminalContent: { gap: 2, paddingBottom: spacing.md },
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
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.brewRich,
    borderTopWidth: 1,
    borderTopColor: colors.claudeAmber + "66",
    borderStyle: "dashed",
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  permissionLabel: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.waiting,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  permissionTool: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 24,
    color: colors.cremaLight,
    marginBottom: spacing.xs,
  },
  permissionInput: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.terminalMuted,
    lineHeight: 17,
    marginBottom: spacing.xs,
  },
  permissionButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  permBtn: {
    flex: 1,
    paddingVertical: spacing.md,
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
    fontSize: 16,
    color: colors.offline,
  },
  allowBtn: { backgroundColor: colors.claudeAmber },
  allowText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 16,
    color: colors.brewDark,
  },
});
