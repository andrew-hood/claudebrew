import { useReducer, useCallback, useRef, useEffect } from 'react';
import { PermissionRequestMessage, ServerMessage } from '../types/protocol';

const MAX_OUTPUT_LINES = 50;
const RECONNECT_DELAY = 2000;

interface State {
  outputLines: string[];
  pendingPermission: PermissionRequestMessage | null;
  status: 'working' | 'waiting' | 'done' | null;
  connected: boolean;
}

type Action =
  | { type: 'output'; text: string }
  | { type: 'permission'; msg: PermissionRequestMessage }
  | { type: 'status'; state: 'working' | 'waiting' | 'done' }
  | { type: 'pair_ok' }
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'clear_permission' }
  | { type: 'hook_activity'; sessionId: string; event: string };

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
      return null; // handled via status
    default:
      return null;
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'output': {
      const lines = [...state.outputLines, action.text];
      if (lines.length > MAX_OUTPUT_LINES) lines.shift();
      return { ...state, outputLines: lines };
    }
    case 'permission':
      return { ...state, pendingPermission: action.msg, status: 'waiting' };
    case 'status':
      return {
        ...state,
        status: action.state,
        pendingPermission: action.state === 'working' ? null : state.pendingPermission,
      };
    case 'pair_ok':
      return { ...state, connected: true };
    case 'connected':
      return state;
    case 'disconnected':
      return { ...state, connected: false, status: null };
    case 'clear_permission':
      return { ...state, pendingPermission: null };
    case 'hook_activity':
      // PreToolUse only fires after a permission is granted, so if we see it
      // for the same session as our pending permission, it was resolved externally
      if (
        state.pendingPermission?.sessionId === action.sessionId &&
        (action.event === 'PreToolUse' || action.event === 'PostToolUse')
      ) {
        return { ...state, pendingPermission: null };
      }
      return state;
    default:
      return state;
  }
}

const initialState: State = {
  outputLines: [],
  pendingPermission: null,
  status: null,
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
      dispatch({ type: 'connected' });
      ws.send(JSON.stringify({ type: 'pair', pin }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data as string);
        switch (msg.type) {
          case 'output':
            dispatch({ type: 'output', text: msg.text });
            break;
          case 'hook_event': {
            const line = formatHookLine(msg);
            if (line) dispatch({ type: 'output', text: line });
            if (msg.event === 'Stop') dispatch({ type: 'status', state: 'done' });
            dispatch({ type: 'hook_activity', sessionId: msg.sessionId, event: msg.event });
            break;
          }
          case 'permission_request':
            dispatch({ type: 'permission', msg });
            break;
          case 'permission_dismissed':
            dispatch({ type: 'clear_permission' });
            break;
          case 'status':
            dispatch({ type: 'status', state: msg.state });
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
    (sessionId: string, toolUseId: string, decision: 'allow' | 'deny') => {
      send({ type: 'permission_response', sessionId, toolUseId, decision });
      dispatch({ type: 'clear_permission' });
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

  return { ...state, connect, disconnect, sendPermissionResponse };
}
