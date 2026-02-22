import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWebSocket } from './useWebSocket';

const DEFAULT_PORT = 3033;
const STORAGE_IP_KEY = 'claudebrew_last_ip';
const STORAGE_PIN_KEY = 'claudebrew_last_pin';
const AUTO_CONNECT_TIMEOUT_MS = 8000;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export function useConnection() {
  const [ip, setIp] = useState('');
  const [pin, setPin] = useState('');
  const [connecting, setConnecting] = useState(false);
  const isAutoConnectRef = useRef(false);
  const autoConnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = connecting ? `ws://${ip}:${DEFAULT_PORT}` : null;
  const ws = useWebSocket(url, pin);

  const state: ConnectionState = ws.connected
    ? 'connected'
    : connecting
      ? 'connecting'
      : 'disconnected';

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

  // Set a timeout to fall back when auto-connecting
  useEffect(() => {
    if (!connecting || !isAutoConnectRef.current) return;

    autoConnectTimerRef.current = setTimeout(() => {
      isAutoConnectRef.current = false;
      setConnecting(false);
    }, AUTO_CONNECT_TIMEOUT_MS);

    return () => {
      if (autoConnectTimerRef.current) {
        clearTimeout(autoConnectTimerRef.current);
        autoConnectTimerRef.current = null;
      }
    };
  }, [connecting]);

  // Clear the timer on successful pair
  useEffect(() => {
    if (!ws.connected) return;
    isAutoConnectRef.current = false;
    if (autoConnectTimerRef.current) {
      clearTimeout(autoConnectTimerRef.current);
      autoConnectTimerRef.current = null;
    }
  }, [ws.connected]);

  const connectTo = useCallback(
    (targetIp: string, targetPin: string) => {
      if (autoConnectTimerRef.current) {
        clearTimeout(autoConnectTimerRef.current);
        autoConnectTimerRef.current = null;
      }
      isAutoConnectRef.current = false;
      AsyncStorage.setItem(STORAGE_IP_KEY, targetIp);
      AsyncStorage.setItem(STORAGE_PIN_KEY, targetPin);
      setIp(targetIp);
      setPin(targetPin);
      setConnecting(true);
    },
    [],
  );

  const disconnectFrom = useCallback(() => {
    if (autoConnectTimerRef.current) {
      clearTimeout(autoConnectTimerRef.current);
      autoConnectTimerRef.current = null;
    }
    isAutoConnectRef.current = false;
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
