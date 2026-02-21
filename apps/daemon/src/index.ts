import { getLocalIp, generatePin, displayConnectionInfo } from './network';
import { RemoteServer } from './server';
import { SocketServer } from './socket-server';
import { install } from './hook-installer';

const PORT = 3033;

const ip = getLocalIp();
const pin = generatePin();

// Install Claude Code hooks (idempotent)
install();

// Start WebSocket server for mobile
const server = new RemoteServer(PORT, pin);

// Start Unix domain socket server for hooks
const socketServer = new SocketServer();
server.attachSocketServer(socketServer);

displayConnectionInfo(ip, PORT, pin);

const shutdown = () => {
  socketServer.close();
  server.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
