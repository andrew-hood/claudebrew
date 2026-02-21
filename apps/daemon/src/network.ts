import os from 'os';
import qrcode from 'qrcode-terminal';

export function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function displayConnectionInfo(ip: string, port: number, pin: string): void {
  const url = `ws://${ip}:${port}`;

  console.log('\n┌──────────────────────────────┐');
  console.log('│  ClaudeBrew Remote listening  │');
  console.log(`│  ${url.padEnd(28)}│`);
  console.log('│                              │');

  qrcode.generate(`${url}?pin=${pin}`, { small: true }, (code: string) => {
    for (const line of code.split('\n')) {
      console.log(`│  ${line.padEnd(28)}│`);
    }
    console.log('│                              │');
    console.log(`│  PIN: ${pin}                    │`);
    console.log('└──────────────────────────────┘\n');
  });
}
