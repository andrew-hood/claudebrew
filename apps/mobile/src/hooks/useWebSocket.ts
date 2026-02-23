import { useReducer, useCallback, useRef, useEffect } from 'react';
import { PermissionRequestMessage, ServerMessage, SessionState } from '../types/protocol';

const MAX_OUTPUT_LINES = 50;
const RECONNECT_DELAY = 2000;

interface State {
  sessions: Map<string, SessionState>;
  connected: boolean;
}

type Action =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'pair_ok' }
  | {
      type: 'hook_activity';
      sessionId: string;
      cwd?: string;
      event: string;
      line: string | null;
      statusChange: 'working' | 'waiting' | 'done' | null;
    }
  | { type: 'permission'; msg: PermissionRequestMessage }
  | { type: 'clear_permission'; sessionId: string; toolUseId: string };

function getOrCreate(sessions: Map<string, SessionState>, sessionId: string, cwd?: string): SessionState {
  const existing = sessions.get(sessionId);
  if (existing) return existing;
  const label = cwd
    ? cwd.split('/').filter(Boolean).at(-1) ?? sessionId.slice(0, 8)
    : sessionId.slice(0, 8);
  return {
    sessionId,
    cwd: cwd ?? '',
    label,
    status: null,
    outputLines: [],
    pendingPermission: null,
    lastActivity: Date.now(),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'connected':
      return state;
    case 'disconnected':
      return { sessions: new Map(), connected: false };
    case 'pair_ok':
      return { ...state, connected: true };

    case 'hook_activity': {
      const sessions = new Map(state.sessions);
      const session = { ...getOrCreate(sessions, action.sessionId, action.cwd) };
      session.lastActivity = Date.now();

      if (action.cwd && !session.cwd) {
        session.cwd = action.cwd;
        session.label = action.cwd.split('/').filter(Boolean).at(-1) ?? session.sessionId.slice(0, 8);
      }

      if (action.line) {
        const lines = [...session.outputLines, action.line];
        if (lines.length > MAX_OUTPUT_LINES) lines.shift();
        session.outputLines = lines;
      }

      if (action.statusChange) {
        session.status = action.statusChange;
        if (action.statusChange === 'working') session.pendingPermission = null;
      }

      if (
        session.pendingPermission &&
        (action.event === 'PostToolUse' || action.event === 'PreToolUse')
      ) {
        session.pendingPermission = null;
      }

      sessions.set(action.sessionId, session);
      return { ...state, sessions };
    }

    case 'permission': {
      const sessions = new Map(state.sessions);
      const session = { ...getOrCreate(sessions, action.msg.sessionId) };
      session.pendingPermission = action.msg;
      session.status = 'waiting';
      session.lastActivity = Date.now();
      sessions.set(action.msg.sessionId, session);
      return { ...state, sessions };
    }

    case 'clear_permission': {
      const sessions = new Map(state.sessions);
      const session = sessions.get(action.sessionId);
      if (!session) return state;
      if (session.pendingPermission?.toolUseId !== action.toolUseId) return state;
      sessions.set(action.sessionId, { ...session, pendingPermission: null });
      return { ...state, sessions };
    }

    default:
      return state;
  }
}

function sortedSessions(map: Map<string, SessionState>): SessionState[] {
  return [...map.values()].sort((a, b) => {
    const aPending = a.pendingPermission ? 1 : 0;
    const bPending = b.pendingPermission ? 1 : 0;
    if (aPending !== bPending) return bPending - aPending;
    return b.lastActivity - a.lastActivity;
  });
}

function formatHookLine(msg: Extract<ServerMessage, { type: 'hook_event' }>): string | null {
  switch (msg.event) {
    case 'PreToolUse': {
      const input = msg.toolInput;
      let detail = '';
      if (input) {
        if (typeof input.command === 'string') detail = ': ' + input.command.slice(0, 60);
        else if (typeof input.file_path === 'string') detail = ': ' + input.file_path;
        else if (typeof input.pattern === 'string') detail = ': ' + input.pattern;
        else if (typeof input.query === 'string') detail = ': ' + String(input.query).slice(0, 60);
      }
      return `🔧 ${msg.tool ?? 'Tool'}${detail}`;
    }
    case 'Notification':
      return msg.notificationType ? `💬 ${msg.notificationType}` : null;
    case 'Stop':
      return null;
    default:
      return null;
  }
}

const initialState: State = {
  sessions: new Map(),
  connected: false,
};

export function useWebSocket(url: string | null, pin: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!url) return;
    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      dispatch({ type: 'connected' });
      ws.send(JSON.stringify({ type: 'pair', pin }));
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      try {
        const msg: ServerMessage = JSON.parse(event.data as string);
        switch (msg.type) {
          case 'output':
            // Currently unused by daemon — ignore
            break;
          case 'hook_event': {
            const line = formatHookLine(msg);
            const statusChange = msg.event === 'Stop' ? 'done' : null;
            dispatch({
              type: 'hook_activity',
              sessionId: msg.sessionId,
              cwd: msg.cwd,
              event: msg.event,
              line,
              statusChange,
            });
            break;
          }
          case 'permission_request':
            dispatch({ type: 'permission', msg });
            break;
          case 'permission_dismissed':
            dispatch({ type: 'clear_permission', sessionId: msg.sessionId, toolUseId: msg.toolUseId });
            break;
          case 'status':
            // Currently unused by daemon — ignore
            break;
          case 'pair_ok':
            dispatch({ type: 'pair_ok' });
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      dispatch({ type: 'disconnected' });
      wsRef.current = null;
      reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url, pin]);

  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    dispatch({ type: 'disconnected' });
  }, []);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendPermissionResponse = useCallback(
    (sessionId: string, toolUseId: string, decision: 'allow' | 'deny', reason?: string) => {
      send({ type: 'permission_response', sessionId, toolUseId, decision, ...(reason && { reason }) });
      dispatch({ type: 'clear_permission', sessionId, toolUseId });
    },
    [send],
  );

  useEffect(() => {
    if (url) {
      connect();
    } else {
      disconnect();
    }
    return () => {
      disconnect();
    };
  }, [url, connect, disconnect]);

  return {
    sessions: sortedSessions(state.sessions),
    connected: state.connected,
    connect,
    disconnect,
    sendPermissionResponse,
  };
}
