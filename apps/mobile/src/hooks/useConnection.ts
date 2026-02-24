import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWebSocket } from './useWebSocket';

const DEFAULT_PORT = 3033;
const STORAGE_IP_KEY = 'claudebrew_last_ip';
const STORAGE_PIN_KEY = 'claudebrew_last_pin';
const AUTO_CONNECT_TIMEOUT_MS = 8000;
const MANUAL_CONNECT_TIMEOUT_MS = 15000;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export function useConnection() {
  const [ip, setIp] = useState('');
  const [pin, setPin] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAutoConnectRef = useRef(false);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = connecting ? `ws://${ip}:${DEFAULT_PORT}` : null;
  const ws = useWebSocket(url, pin);

  const state: ConnectionState = ws.connected
    ? 'connected'
    : connecting
      ? 'connecting'
      : 'disconnected';

  const clearTimer = useCallback(() => {
    if (connectTimerRef.current) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
  }, []);

  const failConnection = useCallback((message: string) => {
    clearTimer();
    isAutoConnectRef.current = false;
    setConnecting(false);
    setError(message);
  }, [clearTimer]);

  // Auto-connect on mount from saved credentials
  useEffect(() => {
    (async () => {
      const [savedIp, savedPin] = await Promise.all([
        AsyncStorage.getItem(STORAGE_IP_KEY),
        AsyncStorage.getItem(STORAGE_PIN_KEY),
      ]);
      if (savedIp && savedPin) {
        isAutoConnectRef.current = true;
        setIp(savedIp);
        setPin(savedPin);
        setConnecting(true);
      }
    })();
  }, []);

  // Timeout for both auto-connect and manual connect
  useEffect(() => {
    if (!connecting) return;

    const timeout = isAutoConnectRef.current
      ? AUTO_CONNECT_TIMEOUT_MS
      : MANUAL_CONNECT_TIMEOUT_MS;

    const message = isAutoConnectRef.current
      ? '' // silent fail for auto-connect
      : `Could not connect to ${ip}:${DEFAULT_PORT}`;

    connectTimerRef.current = setTimeout(() => {
      if (isAutoConnectRef.current) {
        // Auto-connect: silently fall back to connect screen
        isAutoConnectRef.current = false;
        setConnecting(false);
      } else {
        failConnection(message);
      }
    }, timeout);

    return clearTimer;
  }, [connecting, ip, clearTimer, failConnection]);

  // Clear timer + error on successful pair, persist credentials
  useEffect(() => {
    if (!ws.connected) return;
    clearTimer();
    isAutoConnectRef.current = false;
    setError(null);
    AsyncStorage.setItem(STORAGE_IP_KEY, ip);
    AsyncStorage.setItem(STORAGE_PIN_KEY, pin);
  }, [ws.connected, clearTimer, ip, pin]);

  // Watch for WS close with rejection code (wrong PIN)
  useEffect(() => {
    if (!ws.lastCloseCode || !connecting) return;
    if (ws.lastCloseCode === 4001) {
      failConnection('Connection rejected — wrong PIN');
    }
  }, [ws.lastCloseCode, connecting, failConnection]);

  const connectTo = useCallback(
    (targetIp: string, targetPin: string) => {
      clearTimer();
      isAutoConnectRef.current = false;
      setError(null);
      setIp(targetIp);
      setPin(targetPin);
      setConnecting(true);
    },
    [clearTimer],
  );

  const disconnectFrom = useCallback(() => {
    clearTimer();
    isAutoConnectRef.current = false;
    setConnecting(false);
    setError(null);
    ws.disconnect();
  }, [ws, clearTimer]);

  return {
    state,
    ip,
    pin,
    error,
    connectTo,
    disconnect: disconnectFrom,
    sessions: ws.sessions,
    sendPermissionResponse: ws.sendPermissionResponse,
    debugLog: ws.debugLog,
  };
}
