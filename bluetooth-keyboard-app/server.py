"""
스마트폰 음성 → PC 타이핑 서버

스마트폰 마이크로 말하면 PC에서 현재 커서 위치에 바로 입력됩니다.
메모장, 워드, 브라우저 등 어떤 프로그램에서든 동작합니다.

사용법:
    pip install websockets pynput
    python server.py
"""

import asyncio
import json
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


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


async def handle_voice(websocket):
    client_ip = websocket.remote_address[0]
    print(f"[연결] {client_ip}")

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                action = data.get("action")

                if action == "type":
                    text = data.get("text", "")
                    if text:
                        keyboard.type(text)
                        print(f"  음성입력: {text}")

                elif action == "enter":
                    keyboard.press(Key.enter)
                    keyboard.release(Key.enter)
                    print("  Enter")

                elif action == "backspace":
                    # 글자 수만큼 지우기
                    count = data.get("count", 1)
                    for _ in range(count):
                        keyboard.press(Key.backspace)
                        keyboard.release(Key.backspace)
                    print(f"  Backspace x{count}")

                elif action == "space":
                    keyboard.press(Key.space)
                    keyboard.release(Key.space)

                elif action == "ping":
                    await websocket.send(json.dumps({"action": "pong"}))

            except json.JSONDecodeError:
                pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        print(f"[연결 해제] {client_ip}")


def start_http_server(host, port):
    directory = Path(__file__).parent

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def do_GET(self):
            if self.path in ("/", ""):
                self.path = "/voice.html"
            return super().do_GET()

        def log_message(self, format, *args):
            pass

    server = http.server.HTTPServer((host, port), Handler)
    server.serve_forever()


async def main():
    host = "0.0.0.0"
    http_port = 8765
    ws_port = 8766
    local_ip = get_local_ip()

    http_thread = threading.Thread(
        target=start_http_server, args=(host, http_port), daemon=True
    )
    http_thread.start()

    async with websockets.serve(handle_voice, host, ws_port):
        print()
        print("=" * 50)
        print("  음성 타이핑 서버 ON")
        print("=" * 50)
        print()
        print(f"  스마트폰에서 접속:")
        print(f"  http://{local_ip}:{http_port}")
        print()
        print(f"  (같은 WiFi 필요)")
        print(f"  종료: Ctrl+C")
        print("=" * 50)
        print()
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n서버 종료.")
