import net from 'net';
import fs from 'fs';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { HookEvent } from './types';

const SOCKET_PATH = '/tmp/claudebrew.sock';

interface PendingPermission {
  resolve: (response: { decision: 'allow' | 'deny'; reason?: string }) => void;
  socket: net.Socket;
}

export interface SocketServer {
  on(event: 'hookEvent', listener: (hookEvent: HookEvent) => void): this;
}

export class SocketServer extends EventEmitter {
  private server: net.Server;
  private pending = new Map<string, PendingPermission>();

  constructor() {
    super();

    // Remove stale socket file
    try {
      fs.unlinkSync(SOCKET_PATH);
    } catch {
      // Doesn't exist, that's fine
    }

    this.server = net.createServer((socket) => this.handleConnection(socket));
    this.server.listen(SOCKET_PATH, () => {
      console.log(`[claudebrew] Socket server listening at ${SOCKET_PATH}`);
    });

    this.server.on('error', (err) => {
      console.error('[claudebrew] Socket server error:', err.message);
    });
  }

  private handleConnection(socket: net.Socket): void {
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const newline = buffer.indexOf('\n');
      if (newline === -1) return;

      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);

      let event: HookEvent;
      try {
        event = JSON.parse(line);
      } catch {
        socket.destroy();
        return;
      }

      console.log(`[claudebrew] hook: ${event.event} tool=${event.tool ?? '-'} session=${event.sessionId.slice(0, 8)}`);

      if (event.expectsResponse) {
        if (!event.toolUseId) {
          event.toolUseId = crypto.randomUUID();
        }
        const key = `${event.sessionId}:${event.toolUseId}`;
        this.pending.set(key, {
          resolve: (response) => {
            socket.write(JSON.stringify(response));
            socket.end();
          },
          socket,
        });

        // Clean up if mobile never responds (socket closes)
        socket.on('close', () => {
          this.pending.delete(key);
        });
      } else {
        socket.end();
      }

      this.emit('hookEvent', event);
    });

    socket.on('error', () => {
      // Ignore socket errors
    });
  }

  respondToPermission(
    sessionId: string,
    toolUseId: string,
    decision: 'allow' | 'deny',
    reason?: string
  ): void {
    const key = `${sessionId}:${toolUseId}`;
    const pending = this.pending.get(key);
    console.log(`[claudebrew] respondToPermission key=${key.slice(0, 30)} found=${!!pending} pendingKeys=[${[...this.pending.keys()].map(k => k.slice(0, 30)).join(', ')}]`);
    if (!pending) return;
    this.pending.delete(key);
    pending.resolve({ decision, reason });
  }

  close(): void {
    this.server.close();
    try {
      fs.unlinkSync(SOCKET_PATH);
    } catch {
      // Already gone
    }
  }
}
