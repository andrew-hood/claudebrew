export interface OutputMessage {
  type: 'output';
  text: string;
}

export interface StatusMessage {
  type: 'status';
  state: 'working' | 'waiting' | 'done';
}

export interface PairMessage {
  type: 'pair';
  pin: string;
}

export interface PairOkMessage {
  type: 'pair_ok';
}

export interface HookEventMessage {
  type: 'hook_event';
  event: string;
  sessionId: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  toolUseId?: string;
  cwd?: string;
  notificationType?: string;
  status?: string;
}

export interface PermissionRequestMessage {
  type: 'permission_request';
  sessionId: string;
  toolUseId: string;
  tool: string;
  toolInput: Record<string, unknown>;
  planContent?: string;
}

export interface PermissionResponseMessage {
  type: 'permission_response';
  sessionId: string;
  toolUseId: string;
  decision: 'allow' | 'deny';
  reason?: string;
}

export interface HookEvent {
  event: string;
  sessionId: string;
  pid: number;
  tty?: string;
  cwd: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  toolUseId?: string;
  expectsResponse?: boolean;
  notificationType?: string;
  status?: string;
}

export interface PermissionDismissedMessage {
  type: 'permission_dismissed';
  sessionId: string;
  toolUseId: string;
}

export type ServerMessage = OutputMessage | StatusMessage | PairOkMessage | HookEventMessage | PermissionRequestMessage | PermissionDismissedMessage;
export type ClientMessage = PairMessage | PermissionResponseMessage;
