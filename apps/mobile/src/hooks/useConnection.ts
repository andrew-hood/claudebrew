import { useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

const DEFAULT_PORT = 3033;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export function useConnection() {
  const [ip, setIp] = useState('');
  const [pin, setPin] = useState('');
  const [connecting, setConnecting] = useState(false);

  const url = connecting ? `ws://${ip}:${DEFAULT_PORT}` : null;
  const ws = useWebSocket(url, pin);

  const state: ConnectionState = ws.connected
    ? 'connected'
    : connecting
      ? 'connecting'
      : 'disconnected';

  const connectTo = useCallback(
    (targetIp: string, targetPin: string) => {
      setIp(targetIp);
      setPin(targetPin);
      setConnecting(true);
    },
    [],
  );

  const disconnectFrom = useCallback(() => {
    setConnecting(false);
    ws.disconnect();
  }, [ws]);

  return {
    state,
    ip,
    pin,
    connectTo,
    disconnect: disconnectFrom,
    sessions: ws.sessions,
    sendPermissionResponse: ws.sendPermissionResponse,
  };
}
