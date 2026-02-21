import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { PermissionRequestMessage } from '../types/protocol';

interface SessionScreenProps {
  status: 'working' | 'waiting' | 'done' | null;
  pendingPermission: PermissionRequestMessage | null;
  outputLines: string[];
  onPermissionResponse: (sessionId: string, toolUseId: string, decision: 'allow' | 'deny') => void;
  onDisconnect: () => void;
}

export function SessionScreen({
  status,
  pendingPermission,
  outputLines,
  onPermissionResponse,
  onDisconnect,
}: SessionScreenProps) {
  const statusColor =
    status === 'waiting'
      ? colors.waiting
      : status === 'working'
        ? colors.working
        : status === 'done'
          ? colors.connected
          : colors.connected;

  const statusLabel =
    status === 'waiting'
      ? 'Waiting'
      : status === 'working'
        ? 'Working'
        : status === 'done'
          ? 'Done'
          : 'Connected';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>ClaudeBrew</Text>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '1F' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Terminal output */}
      <ScrollView style={styles.terminal} contentContainerStyle={styles.terminalContent}>
        {outputLines.slice(-10).map((line, i) => (
          <Text key={i} style={styles.terminalLine} numberOfLines={1}>
            {line}
          </Text>
        ))}
      </ScrollView>

      {/* Main content */}
      <View style={styles.content}>
        {pendingPermission ? (
          <PermissionPrompt
            msg={pendingPermission}
            onAllow={() =>
              onPermissionResponse(pendingPermission.sessionId, pendingPermission.toolUseId, 'allow')
            }
            onDeny={() =>
              onPermissionResponse(pendingPermission.sessionId, pendingPermission.toolUseId, 'deny')
            }
          />
        ) : (
          <View style={styles.idle}>
            <Text style={styles.idleIcon}>☕</Text>
            <Text style={styles.idleText}>Claude is working...{'\n'}enjoy your coffee</Text>
          </View>
        )}
      </View>

      {/* Disconnect */}
      <TouchableOpacity style={styles.disconnect} onPress={onDisconnect}>
        <Text style={styles.disconnectText}>Disconnect</Text>
      </TouchableOpacity>
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
      <Text style={styles.permissionLabel}>⚠️ Permission Request</Text>
      <Text style={styles.permissionTool}>{msg.tool}</Text>
      {inputPreview ? (
        <Text style={styles.permissionInput}>{inputPreview}</Text>
      ) : null}
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0) + spacing.sm,
    paddingBottom: spacing.sm,
  },
  logo: {
    fontFamily: typography.fraunces.bold,
    fontSize: 20,
    color: colors.cremaLight,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
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
  },
  terminalContent: {
    gap: 2,
  },
  terminalLine: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 12,
    color: colors.terminalMuted,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  idle: {
    alignItems: 'center',
    gap: spacing.md,
  },
  idleIcon: {
    fontSize: 48,
  },
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
    letterSpacing: 1,
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
  allowBtn: {
    backgroundColor: colors.claudeAmber,
  },
  allowText: {
    fontFamily: typography.jetbrainsMono.medium,
    fontSize: 14,
    color: colors.brewDark,
  },
});
