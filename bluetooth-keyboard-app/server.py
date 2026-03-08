"""
스마트폰 → PC 무선 키보드 서버
같은 WiFi 네트워크에서 스마트폰 브라우저로 PC에 타자를 칠 수 있습니다.

사용법:
    pip install websockets pynput
    python server.py

그 다음 스마트폰 브라우저에서 http://<PC의 IP주소>:8765 접속
"""

import asyncio
import json
import os
import socket
import http.server
import threading
from pathlib import Path

try:
    import websockets
except ImportError:
    print("websockets 패키지가 필요합니다: pip install websockets")
    exit(1)

try:
    from pynput.keyboard import Controller, Key
except ImportError:
    print("pynput 패키지가 필요합니다: pip install pynput")
    exit(1)

keyboard = Controller()

# 특수 키 매핑
SPECIAL_KEYS = {
    "Enter": Key.enter,
    "Backspace": Key.backspace,
    "Tab": Key.tab,
    "Space": Key.space,
    "Escape": Key.esc,
    "ArrowUp": Key.up,
    "ArrowDown": Key.down,
    "ArrowLeft": Key.left,
    "ArrowRight": Key.right,
    "Shift": Key.shift,
    "Control": Key.ctrl,
    "Alt": Key.alt,
    "Delete": Key.delete,
    "Home": Key.home,
    "End": Key.end,
    "PageUp": Key.page_up,
    "PageDown": Key.page_down,
    "CapsLock": Key.caps_lock,
    "F1": Key.f1,
    "F2": Key.f2,
    "F3": Key.f3,
    "F4": Key.f4,
    "F5": Key.f5,
    "F6": Key.f6,
    "F7": Key.f7,
    "F8": Key.f8,
    "F9": Key.f9,
    "F10": Key.f10,
    "F11": Key.f11,
    "F12": Key.f12,
}


def get_local_ip():
    """로컬 IP 주소를 가져옵니다."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


async def handle_keypress(websocket):
    """WebSocket으로 받은 키 입력을 PC에서 실행합니다."""
    client_ip = websocket.remote_address[0]
    print(f"[연결] {client_ip} 에서 접속")

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                action = data.get("action")
                key_value = data.get("key", "")

                if action == "type":
                    # 일반 문자 입력
                    keyboard.type(key_value)
                    print(f"  입력: {repr(key_value)}")

                elif action == "press":
                    # 특수 키 입력
                    special = SPECIAL_KEYS.get(key_value)
                    if special:
                        keyboard.press(special)
                        keyboard.release(special)
                        print(f"  특수키: {key_value}")

                elif action == "combo":
                    # 조합 키 (Ctrl+C 등)
                    keys = data.get("keys", [])
                    mapped = []
                    for k in keys:
                        if k in SPECIAL_KEYS:
                            mapped.append(SPECIAL_KEYS[k])
                        elif len(k) == 1:
                            mapped.append(k)
                    if mapped:
                        for k in mapped[:-1]:
                            keyboard.press(k)
                        keyboard.press(mapped[-1])
                        keyboard.release(mapped[-1])
                        for k in reversed(mapped[:-1]):
                            keyboard.release(k)
                        print(f"  조합키: {'+'.join(keys)}")

                elif action == "ping":
                    await websocket.send(json.dumps({"action": "pong"}))

            except json.JSONDecodeError:
                pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        print(f"[연결 해제] {client_ip}")


def start_http_server(host, port):
    """keyboard.html을 서빙하는 HTTP 서버"""
    directory = Path(__file__).parent

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def do_GET(self):
            if self.path == "/" or self.path == "":
                self.path = "/keyboard.html"
            return super().do_GET()

        def log_message(self, format, *args):
            pass  # HTTP 로그 숨김

    server = http.server.HTTPServer((host, port), Handler)
    server.serve_forever()


async def main():
    host = "0.0.0.0"
    http_port = 8765
    ws_port = 8766
    local_ip = get_local_ip()

    # HTTP 서버 (백그라운드 스레드)
    http_thread = threading.Thread(
        target=start_http_server, args=(host, http_port), daemon=True
    )
    http_thread.start()

    # WebSocket 서버
    async with websockets.serve(handle_keypress, host, ws_port):
        print("=" * 50)
        print("  스마트폰 무선 키보드 서버")
        print("=" * 50)
        print()
        print(f"  스마트폰 브라우저에서 접속하세요:")
        print(f"  http://{local_ip}:{http_port}")
        print()
        print(f"  (PC와 스마트폰이 같은 WiFi에 연결되어 있어야 합니다)")
        print()
        print("  종료: Ctrl+C")
        print("=" * 50)
        await asyncio.Future()  # 영원히 실행


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
