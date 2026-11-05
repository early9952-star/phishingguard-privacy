# 브랜드 아파트 모션그래픽 (가상 브랜드 "AURELLE 오렐 리버테라스")

브랜드 아파트 홍보용 세로 영상(9:16, 1080×1920)을 코드로 만드는 프로젝트예요.
실제 브랜드의 상표 문제를 피하려고 가상 브랜드로 만들었어요. 의뢰가 들어오면 이름, 색, 문구만 바꾸면 돼요.

| 영상 | 길이 | 목표 | 구성 |
| --- | --- | --- | --- |
| `오렐_바이럴_15초.mp4` | 15초 | 조회수·공유 | 첫 1초 "POV: 창문을 열었더니" 후킹 → 커튼이 열리며 한강 야경과 불꽃 → 비트마다 혜택 카드 4개(47F, 92%, 3분, 25m) → 불이 켜지는 순간 → 로고 + 댓글 유도 → 커튼이 닫히며 처음 장면으로 이어지는 루프 |
| `오렐_프리미엄_20초.mp4` | 20초 | 브랜드 고급감 | 금색 선 하나 → 설계 도면이 그려지며 타워가 올라감 → 골든아워 실제 풍경으로 변신 → 해가 지며 창마다 불이 켜짐 → 금색 세리프 로고 |

## 만드는 방법

필요한 것: Node.js, Python(numpy), ffmpeg

```bash
npm install
npx playwright install chromium
pip install numpy
npm run audio    # 음악·효과음 합성 (viral_audio.wav, premium_audio.wav)
npm run render   # 프레임을 한 장씩 그려 영상으로 (viral_video.mp4, premium_video.mp4)
npm run mux      # 영상 + 소리 합치기
```

미리보기 이미지만 뽑기: `node render.mjs viral 30 --stills 1,4.5,13`

## 파일

| 파일 | 하는 일 |
| --- | --- |
| `lib.js` | 공용 엔진: 하늘·도시·타워·창문 불빛·물 반사·불꽃·글자 애니메이션·유리 카드·금색 글자·렌즈 플레어 |
| `viral.js` | 바이럴형 장면 순서와 타이밍 |
| `premium.js` | 프리미엄형 장면 순서와 타이밍 |
| `audio.py` | 장면 타이밍에 맞춘 음악·효과음 합성 (직접 만든 소리라 저작권 걱정 없음) |
| `render.mjs` | 브라우저로 프레임을 그려 ffmpeg로 영상 만들기 |

## 다른 브랜드로 바꾸려면

- 브랜드 이름: `viral.js`, `premium.js`의 `"AURELLE"`, `"오렐 리버테라스"`
- 혜택 숫자·문구: `viral.js`의 `sceneFeatures`
- 시간대 색: `lib.js`의 `PAL`
- 타워 모양·층수: `lib.js`의 `TOWERS`
