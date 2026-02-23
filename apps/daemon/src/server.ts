import { WebSocketServer, WebSocket } from 'ws';
import { homedir } from 'os';
import path from 'path';
import fs from 'fs';
import { ServerMessage, ClientMessage, HookEvent, PermissionRequestMessage, PermissionResponseMessage } from './types';
import { SocketServer } from './socket-server';
import { log } from './logger';

function readLatestPlan(): string | null {
  const plansDir = path.join(homedir(), '.claude', 'plans');
  try {
    const files = fs.readdirSync(plansDir)
      .filter(f => f.endsWith('.md'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(plansDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (!files.length) return null;
    return fs.readFileSync(path.join(plansDir, files[0].name), 'utf-8').slice(0, 50_000);
  } catch { return null; }
}

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
        const msg: PermissionRequestMessage = {
          type: 'permission_request',
          sessionId: hookEvent.sessionId,
          toolUseId: hookEvent.toolUseId!,
          tool: hookEvent.tool,
          toolInput: hookEvent.toolInput ?? {},
        };
        if (hookEvent.tool === 'ExitPlanMode') {
          const planContent = readLatestPlan();
          if (planContent) {
            msg.planContent = planContent;
            log(`[claudebrew] attached plan content (${planContent.length} chars)`);
          } else {
            log(`[claudebrew] no plan file found in ~/.claude/plans/`);
          }
        }
        this.broadcast(msg);
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
      log(`[claudebrew] permission_response decision=${r.decision} sessionId=${r.sessionId.slice(0, 8)} toolUseId=${r.toolUseId}`);
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
