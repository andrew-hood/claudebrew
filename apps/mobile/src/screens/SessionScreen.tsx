import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { PermissionRequestMessage, SessionState } from '../types/protocol';

interface SessionDetailScreenProps {
  session: SessionState;
  onPermissionResponse: (sessionId: string, toolUseId: string, decision: 'allow' | 'deny') => void;
  onBack: () => void;
}

function getTerminalLineColor(line: string): string {
  if (line.includes('✓') || line.startsWith('✔')) return colors.terminalSuccess;
  if (
    line.startsWith('🔧') ||
    line.startsWith('→') ||
    line.includes('[info]') ||
    line.startsWith('💬')
  )
    return colors.terminalInfo;
  if (line.startsWith('✗') || line.includes('[error]')) return colors.offline;
  return colors.terminalMuted;
}

export function SessionDetailScreen({ session, onPermissionResponse, onBack }: SessionDetailScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;

  const isActive = session.status === 'waiting' || session.status === 'working';

  useEffect(() => {
    if (!isActive) {
      pulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isActive, pulseAnim]);

  useEffect(() => {
    if (session.pendingPermission) {
      breathAnim.setValue(1);
      return;
    }
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.03, duration: 2000, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [session.pendingPermission, breathAnim]);

  const statusColor =
    session.status === 'waiting'
      ? colors.waiting
      : session.status === 'working'
        ? colors.working
        : session.status === 'done'
          ? colors.connected
          : colors.connected;

  const statusLabel =
    session.status === 'waiting'
      ? 'Waiting'
      : session.status === 'working'
        ? 'Working'
        : session.status === 'done'
          ? 'Done'
          : 'Connected';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Sessions</Text>
        </TouchableOpacity>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '1F' }]}>
          <Animated.View
            style={[styles.statusDot, { backgroundColor: statusColor, opacity: pulseAnim }]}
          />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Session label */}
      <Text style={styles.sessionLabel} numberOfLines={1}>
        {session.label}
      </Text>

      {/* Terminal output */}
      {session.outputLines.length > 0 && (
        <ScrollView style={styles.terminal} contentContainerStyle={styles.terminalContent}>
          {session.outputLines.slice(-10).map((line, i) => (
            <Text
              key={i}
              style={[styles.terminalLine, { color: getTerminalLineColor(line) }]}
              numberOfLines={1}
            >
              {line}
            </Text>
          ))}
        </ScrollView>
      )}

      {/* Main content */}
      <View style={styles.content}>
        {session.pendingPermission ? (
          <PermissionPrompt
            msg={session.pendingPermission}
            onAllow={() =>
              onPermissionResponse(
                session.pendingPermission!.sessionId,
                session.pendingPermission!.toolUseId,
                'allow',
              )
            }
            onDeny={() =>
              onPermissionResponse(
                session.pendingPermission!.sessionId,
                session.pendingPermission!.toolUseId,
                'deny',
              )
            }
          />
        ) : (
          <View style={styles.idle}>
            <Animated.Text style={[styles.idleIcon, { transform: [{ scale: breathAnim }] }]}>
              ☕
            </Animated.Text>
            <Text style={styles.idleText}>Claude is working...{'\n'}enjoy your coffee</Text>
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
        .join('\n')
    : '';

  return (
    <View style={styles.permissionCard}>
      <Text style={styles.permissionLabel}>PERMISSION REQUEST</Text>
      <Text style={styles.permissionTool}>{msg.tool}</Text>
      {inputPreview ? <Text style={styles.permissionInput}>{inputPreview}</Text> : null}
      <View style={styles.permissionButtons}>
        <TouchableOpacity style={[styles.permBtn, styles.denyBtn]} onPress={onDeny}>
          <Text style={styles.denyText}>Deny</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.permBtn, styles.allowBtn]} onPress={onAllow}>
          <Text style={styles.allowText}>Allow</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0) + spacing.sm,
    paddingBottom: spacing.xs,
  },
  backBtn: { paddingVertical: spacing.xs },
  backText: {
    fontFamily: typography.dmSans.regular,
    fontSize: 14,
    color: colors.claudeAmber,
  },
  sessionLabel: {
    fontFamily: typography.fraunces.bold,
    fontSize: 18,
    color: colors.cremaLight,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    gap: spacing.xs,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  terminal: {
    maxHeight: 100,
    backgroundColor: colors.brewDark,
    marginHorizontal: spacing.md,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brewSurface,
  },
  terminalContent: { gap: 2 },
  terminalLine: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  idle: { alignItems: 'center', gap: spacing.md },
  idleIcon: { fontSize: 48 },
  idleText: {
    fontFamily: typography.fraunces.italic,
    fontSize: 16,
    color: colors.cremaDark,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionCard: {
    backgroundColor: colors.brewMedium,
    borderWidth: 1,
    borderColor: colors.waiting,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  permissionLabel: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 10,
    color: colors.waiting,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  permissionTool: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 18,
    color: colors.cremaLight,
  },
  permissionInput: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.terminalMuted,
    lineHeight: 16,
  },
  permissionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  permBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    alignItems: 'center',
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
