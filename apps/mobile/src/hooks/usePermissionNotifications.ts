import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { SessionState } from '../types/protocol';

export function usePermissionNotifications(sessions: SessionState[]) {
  const scheduledIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const activePendingIds = new Set<string>();

    for (const session of sessions) {
      const perm = session.pendingPermission;
      if (!perm) continue;
      activePendingIds.add(perm.toolUseId);

      if (scheduledIds.current.has(perm.toolUseId)) continue;
      scheduledIds.current.add(perm.toolUseId);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      if (AppState.currentState !== 'active') {
        Notifications.scheduleNotificationAsync({
          identifier: perm.toolUseId,
          content: {
            title: 'ClaudeBrew',
            body: `Claude wants to use ${perm.tool} — tap to respond`,
            data: { sessionId: session.sessionId, toolUseId: perm.toolUseId },
            sound: true,
          },
          trigger: null,
        });
      }
    }

    for (const id of scheduledIds.current) {
      if (!activePendingIds.has(id)) {
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        Notifications.dismissNotificationAsync(id).catch(() => {});
        scheduledIds.current.delete(id);
      }
    }
  }, [sessions]);
}
