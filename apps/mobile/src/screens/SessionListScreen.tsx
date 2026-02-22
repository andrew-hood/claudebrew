import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';
import { SessionState } from '../types/protocol';

interface Props {
  sessions: SessionState[];
  onSelectSession: (sessionId: string) => void;
  onDisconnect: () => void;
}

export function SessionListScreen({ sessions, onSelectSession, onDisconnect }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>ClaudeBrew</Text>
        <TouchableOpacity onPress={onDisconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>☕</Text>
          <Text style={styles.emptyText}>No active sessions{'\n'}start claude to begin</Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {sessions.map((session) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              onPress={() => onSelectSession(session.sessionId)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SessionCard({ session, onPress }: { session: SessionState; onPress: () => void }) {
  const hasPending = !!session.pendingPermission;
  const statusColor = hasPending
    ? colors.waiting
    : session.status === 'working'
      ? colors.working
      : session.status === 'done'
        ? colors.connected
        : colors.brewMuted;

  const statusLabel = hasPending
    ? 'Waiting'
    : session.status === 'working'
      ? 'Working'
      : session.status === 'done'
        ? 'Done'
        : 'Idle';

  const lastLine = session.outputLines.at(-1) ?? '';

  return (
    <TouchableOpacity
      style={[styles.card, hasPending && styles.cardPending]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.cardLabel} numberOfLines={1}>
            {session.label}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '1F' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {hasPending ? (
        <View style={styles.permBadge}>
          <Text style={styles.permBadgeText}>
            PERMISSION REQUEST · {session.pendingPermission!.tool}
          </Text>
        </View>
      ) : lastLine ? (
        <Text style={styles.lastLine} numberOfLines={1}>
          {lastLine}
        </Text>
      ) : null}

      {session.cwd ? (
        <Text style={styles.cwd} numberOfLines={1}>
          {session.cwd}
        </Text>
      ) : null}
    </TouchableOpacity>
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
    paddingBottom: spacing.sm,
  },
  logo: {
    fontFamily: typography.fraunces.bold,
    fontSize: 20,
    color: colors.cremaLight,
  },
  disconnectText: {
    fontFamily: typography.dmSans.light,
    fontSize: 13,
    color: colors.brewMuted,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: {
    fontFamily: typography.fraunces.italic,
    fontSize: 16,
    color: colors.cremaDark,
    textAlign: 'center',
    lineHeight: 24,
  },
  list: { flex: 1 },
  listContent: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.brewMedium,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.brewSurface,
  },
  cardPending: {
    borderColor: colors.waiting,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardLabel: {
    fontFamily: typography.dmSans.semibold,
    fontSize: 16,
    color: colors.cremaLight,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  statusText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  permBadge: {
    backgroundColor: colors.waiting + '22',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  permBadgeText: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.waiting,
    letterSpacing: 0.5,
  },
  lastLine: {
    fontFamily: typography.jetbrainsMono.regular,
    fontSize: 11,
    color: colors.terminalMuted,
  },
  cwd: {
    fontFamily: typography.dmSans.light,
    fontSize: 11,
    color: colors.brewMuted,
  },
});
