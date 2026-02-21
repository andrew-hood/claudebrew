import fs from 'fs';
import path from 'path';
import os from 'os';

const HOOKS_DIR = path.join(os.homedir(), '.claude', 'hooks');
const HOOK_SCRIPT = path.join(HOOKS_DIR, 'claudebrew-hook.py');
const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json');
const HOOK_MARKER = 'claudebrew-hook.py';

// Events that filter by tool name need a matcher; session-level events don't
const TOOL_EVENTS = ['PreToolUse', 'PostToolUse', 'PermissionRequest'] as const;
const SESSION_EVENTS = ['Notification', 'Stop'] as const;
const HOOK_EVENTS = [...TOOL_EVENTS, ...SESSION_EVENTS] as const;

function hookEntry(event: string): Record<string, unknown> {
  const command = `CLAUDEBREW_EVENT=${event} python3 ${HOOK_SCRIPT}`;
  const hook = { type: 'command', command };
  // Tool events require a matcher to fire
  if ((TOOL_EVENTS as readonly string[]).includes(event)) {
    return { matcher: '*', hooks: [hook] };
  }
  return { hooks: [hook] };
}

function readSettings(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settings: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export function install(): void {
  // Write Python hook script
  fs.mkdirSync(HOOKS_DIR, { recursive: true });
  const scriptSrc = path.join(__dirname, 'hooks', 'claudebrew-hook.py');
  fs.copyFileSync(scriptSrc, HOOK_SCRIPT);
  fs.chmodSync(HOOK_SCRIPT, 0o755);

  // Merge hook entries into settings.json
  const settings = readSettings();
  const hooks = (settings.hooks as Record<string, unknown[]>) ?? {};

  for (const event of HOOK_EVENTS) {
    const existing = (hooks[event] as Array<Record<string, unknown>>) ?? [];
    const alreadyPresent = existing.some((entry) =>
      (entry.hooks as Array<{ command: string }> | undefined)?.some((h) => h.command?.includes(HOOK_MARKER))
    );
    if (!alreadyPresent) {
      existing.push(hookEntry(event));
    }
    hooks[event] = existing;
  }

  settings.hooks = hooks;
  writeSettings(settings);
  console.log('[claudebrew] Hooks installed');
}

export function uninstall(): void {
  try {
    fs.unlinkSync(HOOK_SCRIPT);
  } catch {
    // Already gone
  }

  const settings = readSettings();
  const hooks = (settings.hooks as Record<string, unknown[]>) ?? {};

  for (const event of HOOK_EVENTS) {
    const existing = (hooks[event] as Array<{ hooks: Array<{ command: string }> }>) ?? [];
    hooks[event] = existing.filter(
      (entry) => !entry.hooks?.some((h) => h.command?.includes(HOOK_MARKER))
    );
    if ((hooks[event] as unknown[]).length === 0) {
      delete hooks[event];
    }
  }

  if (Object.keys(hooks).length === 0) {
    delete settings.hooks;
  } else {
    settings.hooks = hooks;
  }

  writeSettings(settings);
  console.log('[claudebrew] Hooks uninstalled');
}

export function isInstalled(): boolean {
  try {
    const settings = readSettings();
    const hooks = (settings.hooks as Record<string, unknown[]>) ?? {};
    return Object.values(hooks).some((entries) =>
      (entries as Array<{ hooks: Array<{ command: string }> }>).some((entry) =>
        entry.hooks?.some((h) => h.command?.includes(HOOK_MARKER))
      )
    );
  } catch {
    return false;
  }
}
