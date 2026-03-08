# 음성 타이핑 앱 - 구현 플랜

## 전체 구조

```
┌─────────────────────┐         WiFi (WebSocket)        ┌──────────────────┐
│   스마트폰 앱        │ ◄──────────────────────────────► │   PC 프로그램     │
│   (Android WebView)  │                                  │   (.exe)         │
│                      │         WiFi (WebSocket)        ┌──────────────────┐
│   - 음성 인식        │ ◄──────────────────────────────► │   PC 2           │
│   - PC 목록 관리      │                                  │   (.exe)         │
│   - 쿠팡 광고        │                                  └──────────────────┘
│   - QR스캔으로 연결   │
└─────────────────────┘
```

## 사용 흐름

### 최초 설치
1. 사용자가 **PC에 .exe 실행** → 서버 시작 + QR코드 표시
2. 스마트폰 앱에서 **"PC 추가"** → QR코드 스캔 → 연결 완료
3. (또는) 스마트폰 앱에서 **수동 입력** → IP:포트 직접 입력

### 일상 사용
1. PC에서 .exe 실행 (시스템 트레이에 상주)
2. 스마트폰 앱 열기 → PC 목록에서 선택 → 말하면 타이핑

### 앱에서 PC에 설치사이트 열기
- **이미 연결된 PC**: 앱에서 `{action: "open_url", url: "다운로드링크"}` 전송 → PC가 브라우저로 열기
- **새 PC**: 앱에서 "PC에 설치하기" 버튼 → 다운로드 링크를 카카오톡/문자로 공유

---

## 구현 단계

### Phase 1: PC 프로그램 강화 (server.py)
> 우선순위: ★★★ | 예상 작업: 지금 바로

1. **QR코드 표시** - 서버 시작 시 터미널에 QR코드 출력 (qrcode 라이브러리)
   - QR 내용: `{"ip": "192.168.x.x", "ws_port": 8766, "http_port": 8765, "name": "내 PC"}`

2. **open_url 액션 추가** - 앱에서 "설치사이트 열어줘" 명령 수신
   ```python
   elif action == "open_url":
       url = data.get("url", "")
       if url.startswith("http"):
           webbrowser.open(url)
   ```

3. **PC 이름 설정** - 여러 PC 구분용
   ```python
   elif action == "get_info":
       await websocket.send(json.dumps({
           "action": "info",
           "name": pc_name,
           "ip": local_ip
       }))
   ```

4. **시스템 트레이** - pystray로 최소화 실행 (백그라운드)
   - 트레이 아이콘 + 우클릭 메뉴 (종료, IP 확인)

### Phase 2: voice.html → 멀티PC 앱 UI
> 우선순위: ★★★ | 예상 작업: 지금 바로

1. **PC 관리 화면 추가**
   - PC 목록 (localStorage 저장)
   - "PC 추가" 버튼 → QR스캔 또는 수동 IP 입력
   - 각 PC별 연결 상태 표시 (초록/빨간 점)
   - 활성 PC 선택 (탭해서 전환)

2. **QR 스캐너** (html5-qrcode 라이브러리)
   - PC의 QR코드를 스캔 → 자동으로 PC 목록에 추가

3. **"PC에 설치하기" 버튼**
   - 연결된 PC 있음 → `open_url` 액션 전송
   - 연결된 PC 없음 → 공유 링크 (카카오톡/문자) 표시

4. **쿠팡 파트너스 광고 영역**
   - 하단 배너 (60px)
   - 어르신 타겟 상품 (돋보기, 건강식품, 안마기 등)
   - Coupang Partners 어필리에이트 링크

5. **UI 개선 (어르신 친화)**
   - 글씨 더 크게 (기본 22px+)
   - 버튼 더 크게 (최소 56px 높이)
   - 색상 대비 강화
   - 최소한의 화면 전환 (가능하면 1 화면)

### Phase 3: .exe 패키징
> 우선순위: ★★☆ | Phase 1 완료 후

1. **PyInstaller 설정**
   - `server.spec` 파일 생성
   - 아이콘 포함
   - 단일 exe로 빌드 (`--onefile`)

2. **GUI 창** (tkinter 최소)
   - QR코드 이미지 표시 (터미널 대신 GUI 창)
   - "연결됨/대기 중" 상태 표시
   - 시스템 트레이로 최소화

### Phase 4: Android 앱 (별도 프로젝트)
> 우선순위: ★☆☆ | 나중에

1. **Android WebView 래퍼**
   - voice.html을 assets에 포함
   - QR 스캐너 네이티브 연동
   - 쿠팡 파트너스 SDK 연동
   - Play Store 출시

---

## 파일 구조 (목표)

```
bluetooth-keyboard-app/
├── server.py           # PC 서버 (WebSocket + HTTP + 시스템트레이)
├── voice.html          # 앱 UI (멀티PC + 광고 + QR)
├── requirements.txt    # Python 의존성
├── server.spec         # PyInstaller 빌드 설정
├── icon.ico            # 앱/exe 아이콘
└── README.md           # 사용법
```

## 수익 모델

| 구분 | 방식 | 예상 |
|------|------|------|
| 쿠팡 파트너스 | 앱 내 배너 광고 (어르신 상품) | 클릭당 수익 |
| 무료 | 모든 기능 무료 | 사용자 확보 우선 |

---

## 지금 바로 할 일 (이번 세션)

1. ✅ server.py: QR코드 표시 + open_url 액션 + PC 정보 응답
2. ✅ voice.html: 멀티PC 관리 UI + QR스캐너 + 쿠팡 광고 영역 + 어르신 UI
3. ✅ requirements.txt 업데이트
4. ✅ 테스트 가능한 상태로 완성
