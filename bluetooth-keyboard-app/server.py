"""
스마트폰 음성 → PC 타이핑 서버

스마트폰 마이크로 말하면 PC에서 현재 커서 위치에 바로 입력됩니다.
메모장, 워드, 브라우저 등 어떤 프로그램에서든 동작합니다.

사용법:
    pip install -r requirements.txt
    python server.py
"""

import asyncio
import json
import socket
import http.server
import threading
import webbrowser
import platform
import sys
import os
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

try:
    import qrcode
except ImportError:
    qrcode = None

keyboard = Controller()

# PC 이름 (여러 PC 구분용)
PC_NAME = platform.node() or "내 PC"

# 연결된 클라이언트 추적
connected_clients = set()


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def print_qr_terminal(data_str):
    """터미널에 QR코드 출력 (qrcode 라이브러리 없어도 URL은 표시)"""
    if qrcode is None:
        print(f"  (QR코드 표시하려면: pip install qrcode)")
        return

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=1,
        border=1,
    )
    qr.add_data(data_str)
    qr.make(fit=True)

    # 터미널에 QR 출력 (유니코드 블록 문자 사용)
    matrix = qr.get_matrix()
    for r in range(0, len(matrix) - 1, 2):
        line = "  "
        for c in range(len(matrix[r])):
            top = matrix[r][c]
            bottom = matrix[r + 1][c] if r + 1 < len(matrix) else False
            if top and bottom:
                line += "█"
            elif top:
                line += "▀"
            elif bottom:
                line += "▄"
            else:
                line += " "
        print(line)


def show_qr_gui(local_ip, http_port, ws_port):
    """tkinter GUI로 QR코드 창 표시 (백그라운드 스레드)"""
    if qrcode is None:
        return

    try:
        import tkinter as tk
        from io import BytesIO
    except ImportError:
        return

    try:
        from PIL import Image, ImageTk
    except ImportError:
        # PIL 없으면 GUI QR 스킵
        return

    def run_gui():
        root = tk.Tk()
        root.title("음성 타이핑 서버")
        root.configure(bg="#1a1a2e")
        root.resizable(False, False)

        # QR 데이터
        qr_data = json.dumps({
            "ip": local_ip,
            "ws": ws_port,
            "http": http_port,
            "name": PC_NAME
        })

        # QR 이미지 생성
        qr = qrcode.QRCode(version=1, box_size=8, border=2)
        qr.add_data(qr_data)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")

        # tkinter에 표시
        buf = BytesIO()
        qr_img.save(buf, format="PNG")
        buf.seek(0)
        pil_img = Image.open(buf)
        tk_img = ImageTk.PhotoImage(pil_img)

        # 레이아웃
        tk.Label(
            root, text="📱 스마트폰 앱에서 이 QR코드를 스캔하세요",
            font=("맑은 고딕", 14, "bold"), fg="white", bg="#1a1a2e",
            pady=10
        ).pack()

        img_label = tk.Label(root, image=tk_img, bg="#1a1a2e")
        img_label.image = tk_img
        img_label.pack(padx=20)

        tk.Label(
            root, text=f"PC 이름: {PC_NAME}",
            font=("맑은 고딕", 11), fg="#aaa", bg="#1a1a2e", pady=5
        ).pack()

        tk.Label(
            root, text=f"IP: {local_ip}:{ws_port}",
            font=("맑은 고딕", 10), fg="#666", bg="#1a1a2e"
        ).pack()

        # 연결 상태
        status_label = tk.Label(
            root, text="대기 중...",
            font=("맑은 고딕", 11), fg="#f59e0b", bg="#1a1a2e", pady=10
        )
        status_label.pack()

        def update_status():
            count = len(connected_clients)
            if count > 0:
                status_label.config(text=f"✅ {count}개 기기 연결됨", fg="#4ade80")
            else:
                status_label.config(text="대기 중...", fg="#f59e0b")
            root.after(2000, update_status)

        update_status()
        root.mainloop()

    gui_thread = threading.Thread(target=run_gui, daemon=True)
    gui_thread.start()


async def handle_voice(websocket):
    client_ip = websocket.remote_address[0]
    connected_clients.add(websocket)
    print(f"[연결] {client_ip} (총 {len(connected_clients)}개)")

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

                elif action == "get_info":
                    # 앱에서 PC 정보 요청
                    await websocket.send(json.dumps({
                        "action": "info",
                        "name": PC_NAME,
                        "ip": get_local_ip(),
                        "os": platform.system(),
                        "hostname": platform.node()
                    }))

                elif action == "open_url":
                    # 앱에서 PC 브라우저로 URL 열기 요청
                    url = data.get("url", "")
                    if url.startswith("http://") or url.startswith("https://"):
                        webbrowser.open(url)
                        print(f"  URL 열기: {url}")
                        await websocket.send(json.dumps({
                            "action": "url_opened",
                            "url": url
                        }))
                    else:
                        await websocket.send(json.dumps({
                            "action": "error",
                            "message": "잘못된 URL"
                        }))

            except json.JSONDecodeError:
                pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        print(f"[연결 해제] {client_ip} (총 {len(connected_clients)}개)")


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

    # HTTP 서버 (voice.html 서빙)
    http_thread = threading.Thread(
        target=start_http_server, args=(host, http_port), daemon=True
    )
    http_thread.start()

    # QR코드 데이터
    qr_data = json.dumps({
        "ip": local_ip,
        "ws": ws_port,
        "http": http_port,
        "name": PC_NAME
    })

    async with websockets.serve(handle_voice, host, ws_port):
        print()
        print("=" * 50)
        print("  음성 타이핑 서버 ON")
        print("=" * 50)
        print()
        print(f"  PC 이름: {PC_NAME}")
        print(f"  IP: {local_ip}")
        print()
        print(f"  스마트폰에서 접속:")
        print(f"  http://{local_ip}:{http_port}")
        print()
        print("  📱 앱에서 아래 QR코드를 스캔하세요:")
        print()
        print_qr_terminal(qr_data)
        print()
        print(f"  (같은 WiFi 필요)")
        print(f"  종료: Ctrl+C")
        print("=" * 50)
        print()

        # GUI QR 창 (tkinter + PIL 있으면)
        show_qr_gui(local_ip, http_port, ws_port)

        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n서버 종료.")
