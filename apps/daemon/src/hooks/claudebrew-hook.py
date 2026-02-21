#!/usr/bin/env python3
import sys, json, socket, os

SOCKET_PATH = "/tmp/claudebrew.sock"
TIMEOUT = 300  # 5 min for permission decisions

def main():
    data = json.loads(sys.stdin.read())
    event_type = os.environ.get("CLAUDEBREW_EVENT", "Unknown")

    payload = {
        "event": event_type,
        "sessionId": data.get("session_id") or os.environ.get("CLAUDE_SESSION_ID", ""),
        "pid": os.getppid(),
        "tty": os.environ.get("SSH_TTY") or (os.ttyname(0) if os.isatty(0) else None),
        "cwd": os.getcwd(),
        "tool": data.get("tool_name"),
        "toolInput": data.get("tool_input"),
        "toolUseId": data.get("tool_use_id"),
        "expectsResponse": event_type == "PermissionRequest",
        "notificationType": data.get("notification_type"),
        "status": data.get("status"),
    }

    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.connect(SOCKET_PATH)
        sock.sendall(json.dumps(payload).encode() + b"\n")

        if event_type == "PermissionRequest":
            sock.settimeout(TIMEOUT)
            response = b""
            while True:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                response += chunk
            result = json.loads(response.decode())
            decision = result.get("decision", "deny")
            if decision == "allow":
                hook_decision = {"behavior": "allow"}
            else:
                hook_decision = {"behavior": "deny", "message": result.get("reason", "Denied via ClaudeBrew")}
            output = json.dumps({
                "hookSpecificOutput": {
                    "hookEventName": "PermissionRequest",
                    "decision": hook_decision,
                }
            })
            print(output)
            sys.stdout.flush()

        sock.close()
    except Exception:
        pass  # Gracefully degrade if daemon not running

if __name__ == "__main__":
    main()
