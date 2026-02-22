import { WebSocketServer, WebSocket } from 'ws';
import { ServerMessage, ClientMessage, HookEvent, PermissionResponseMessage } from './types';
import { SocketServer } from './socket-server';

export class RemoteServer {
  private wss: WebSocketServer;
  private client: WebSocket | null = null;
  private pin: string;
  private paired = false;
  private messageQueue: ServerMessage[] = [];
  private socketServer?: SocketServer;

  constructor(port: number, pin: string) {
    this.pin = pin;
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      if (this.client && this.client.readyState === WebSocket.OPEN) {
        this.client.close(1000, 'replaced');
      }
      this.client = ws;
      this.paired = false;

      ws.on('message', (data) => {
        try {
          const msg: ClientMessage = JSON.parse(data.toString());
          this.handleMessage(ws, msg);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        if (this.client === ws) {
          this.client = null;
          this.paired = false;
        }
      });
    });
  }

  attachSocketServer(socketServer: SocketServer): void {
    this.socketServer = socketServer;

    socketServer.on('permissionDismissed', (sessionId: string, toolUseId: string) => {
      this.broadcast({ type: 'permission_dismissed', sessionId, toolUseId });
    });

    socketServer.on('hookEvent', (hookEvent: HookEvent) => {
      if (hookEvent.expectsResponse && hookEvent.tool) {
        this.broadcast({
          type: 'permission_request',
          sessionId: hookEvent.sessionId,
          toolUseId: hookEvent.toolUseId!,
          tool: hookEvent.tool,
          toolInput: hookEvent.toolInput ?? {},
        });
      } else {
        this.broadcast({
          type: 'hook_event',
          event: hookEvent.event,
          sessionId: hookEvent.sessionId,
          tool: hookEvent.tool,
          toolInput: hookEvent.toolInput,
          toolUseId: hookEvent.toolUseId,
          cwd: hookEvent.cwd,
          notificationType: hookEvent.notificationType,
          status: hookEvent.status,
        });
      }
    });
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage): void {
    if (msg.type === 'pair') {
      if (msg.pin === this.pin) {
        this.paired = true;
        this.send({ type: 'pair_ok' });
        for (const m of this.messageQueue) {
          this.send(m);
        }
        this.messageQueue = [];
      } else {
        ws.close(4001, 'invalid_pin');
      }
      return;
    }

    if (msg.type === 'permission_response') {
      const r = msg as PermissionResponseMessage;
      console.log(`[claudebrew] permission_response decision=${r.decision} sessionId=${r.sessionId.slice(0, 8)} toolUseId=${r.toolUseId}`);
      this.socketServer?.respondToPermission(r.sessionId, r.toolUseId, r.decision, r.reason);
    }
  }

  broadcast(msg: ServerMessage): void {
    if (!this.client || !this.paired) {
      this.messageQueue.push(msg);
      return;
    }
    this.send(msg);
  }

  private send(msg: ServerMessage): void {
    if (this.client && this.client.readyState === WebSocket.OPEN && this.paired) {
      this.client.send(JSON.stringify(msg));
    }
  }

  close(): void {
    this.wss.close();
  }
}
