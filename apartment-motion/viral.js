// 바이럴형 15초: 첫 1초 후킹 → 한강뷰 공개 → 비트에 맞춘 혜택 4개 → 불 켜지는 순간 → 로고 + 댓글 유도 → 처음으로 이어지는 루프
window.DURATION = 15;
const TEXTS = ["POV", "창문을 열었더니", "한강이", "거실로 들어왔다", "47F", "스카이 라운지", "92%", "세대 한강 조망", "3분", "초등학교까지 걸어서", "25m", "단지 안 실내수영장",
  "불이 켜지는 순간", "여기가", "집이 된다", "AURELLE", "오렐 리버테라스", "댓글에 '오렐' 남기면", "분양 정보 보내드려요", "집", "학교", "THE RIVER TERRACE"];
window.prepare = () => preloadFonts(TEXTS);

const NIGHT = PAL.night, DUSK = PAL.dusk;
const FIREWORKS = [
  { x: 300, y: 520, t0: 1.9, c: "255,205,120", seed: 4 },
  { x: 820, y: 430, t0: 2.5, c: "255,120,170", seed: 8 },
  { x: 560, y: 360, t0: 3.1, c: "140,200,255", seed: 12 },
];

window.renderFrame = (t) => {
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.filter = "none";
  octx.globalAlpha = 1;

  if (t < 1.5) sceneHook(t);
  else if (t < 4.0) sceneReveal(t);
  else if (t < 8.0) sceneFeatures(t);
  else if (t < 11.5) sceneLights(t);
  else sceneLogo(t);

  vignette(0.5);
  grain(t, 0.06);
};

// ---------- 1. 후킹: 거실 창문, 커튼이 열린다 ----------
function sceneHook(t) {
  drawCity({ t, pal: NIGHT, cam: { x: 540, y: 1000, z: 1.15 + t * 0.05 }, lit: 1, cars: 1, crown: 1, moon: { x: 850, y: 300 } });
  const open = E.inOutCubic(seg(t, 0.35, 1.3));
  const push = 1 + E.inExpo(seg(t, 1.05, 1.5)) * 2.6;
  drawInterior(open, push);
  const outP = seg(t, 1.15, 1.4);
  scrim(0.6);
  kinetic("POV", 540, 330, { t: t - 0.02, size: 84, weight: 900, mode: "pop", stagger: 0, dur: 0.25, out: outP, color: "#ffd166", spacing: 6 });
  kinetic("창문을 열었더니", 540, 450, { t: t - 0.18, size: 96, weight: 800, mode: "up", stagger: 0.035, dur: 0.25, out: outP });
}

function drawInterior(open, push) {
  const cx = 540, cy = 1040;
  const wx0 = cx + (150 - cx) * push, wx1 = cx + (930 - cx) * push;
  const wy0 = cy + (580 - cy) * push, wy1 = cy + (1500 - cy) * push;
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  // 벽 (창문 자리만 뚫림)
  octx.beginPath();
  octx.rect(0, 0, W, H);
  octx.rect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  const wg = octx.createLinearGradient(0, 0, 0, H);
  wg.addColorStop(0, "#0e1016"); wg.addColorStop(1, "#05060a");
  octx.fillStyle = wg;
  octx.fill("evenodd");
  // 창틀
  const fw = 14 * push;
  octx.strokeStyle = "#1c1f27"; octx.lineWidth = fw;
  octx.strokeRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  octx.lineWidth = fw * 0.6;
  octx.beginPath(); octx.moveTo((wx0 + wx1) / 2, wy0); octx.lineTo((wx0 + wx1) / 2, wy1); octx.stroke();
  // 커튼
  const half = (wx1 - wx0) / 2, cw = half * (1 - open) + 30 * push;
  for (const side of [0, 1]) {
    const x = side === 0 ? wx0 - 30 * push : wx1 - cw + 30 * push;
    const cg = octx.createLinearGradient(x, 0, x + cw, 0);
    const folds = 7;
    for (let i = 0; i <= folds; i++) cg.addColorStop(i / folds, i % 2 ? "#2a2420" : "#3b332c");
    octx.fillStyle = cg;
    octx.fillRect(x, wy0 - 40 * push, cw, wy1 - wy0 + 80 * push);
  }
  // 소파와 스탠드 실루엣 (거실 느낌)
  octx.fillStyle = "#07080c";
  roundRect(octx, cx + (60 - cx) * push, cy + (1560 - cy) * push, 960 * push, 600 * push, 60 * push);
  octx.fill();
  octx.fillRect(cx + (880 - cx) * push, cy + (1050 - cy) * push, 10 * push, 520 * push);
  const lg = octx.createRadialGradient(cx + (885 - cx) * push, cy + (1040 - cy) * push, 0, cx + (885 - cx) * push, cy + (1040 - cy) * push, 260 * push);
  lg.addColorStop(0, "rgba(255,190,120,0.35)"); lg.addColorStop(1, "rgba(255,190,120,0)");
  octx.fillStyle = lg; octx.fillRect(0, 0, W, H);
  octx.restore();
}

// ---------- 2. 공개: 한강 야경 + 불꽃 ----------
function sceneReveal(t) {
  const p = E.outCubic(seg(t, 1.5, 3.2));
  drawCity({ t, pal: NIGHT, cam: { x: 540, y: lerp(1050, 960, p), z: lerp(1.7, 1.0, p) }, lit: 1, cars: 1, crown: 1, moon: { x: 850, y: 300 }, fireworks: FIREWORKS });
  const outP = seg(t, 3.75, 3.95);
  scrim(seg(t, 1.6, 1.9) * (1 - outP));
  kinetic("한강이", 540, 360, { t: t - 1.62, size: 140, weight: 900, mode: "pop", stagger: 0.06, dur: 0.28, out: outP });
  // 노란 형광펜
  const w2 = textWidth("거실로 들어왔다", 112, 900);
  if (outP < 1) bar(540 - w2 / 2 - 16, 452, (w2 + 32) * (1 - outP), 64, seg(t, 2.0, 2.35), "rgba(255,209,102,0.92)");
  kinetic("거실로 들어왔다", 540, 500, { t: t - 1.9, size: 112, weight: 900, mode: "up", stagger: 0.03, dur: 0.25, out: outP, color: "#fff", stroke: { w: 10, c: "rgba(0,0,0,0.35)" } });
  flash(1 - seg(t, 1.5, 1.68));
  whip(E.inExpo(seg(t, 3.82, 4.0)) * 3, 1);
}

// ---------- 3. 혜택 4개 (한 비트에 하나) ----------
function sceneFeatures(t) {
  const i = Math.min(3, Math.floor(t - 4.0)), lt = t - 4.0 - i;
  const cams = [
    { x: 575, y: 360, z: 2.4 + lt * 0.25 },
    { x: 540, y: 1150, z: 1.35 + lt * 0.12 },
    { x: 540, y: 900, z: 1.15 + lt * 0.08 },
    { x: 570, y: 1260, z: 2.1 + lt * 0.2 },
  ];
  drawCity({ t, pal: NIGHT, cam: cams[i], lit: 1, cars: 1, crown: i === 0 ? 1.3 : 1, moon: { x: 850, y: 300 } });
  if (i === 2) blurFrame(18);

  const inP = E.outBack(seg(lt, 0.02, 0.3));
  const outP = seg(lt, 0.86, 0.98);
  const y0 = 1180;
  if (i === 0) featureCard("스카이 라운지", "47F", lt, inP, outP, y0);
  if (i === 1) featureCard("세대 한강 조망", Math.round(92 * E.outCubic(seg(lt, 0.08, 0.55))) + "%", lt, inP, outP, y0);
  if (i === 2) mapCard(lt, inP, outP);
  if (i === 3) poolCard(lt, inP, outP, y0);

  // 진행 점 (4개 중 몇 번째)
  for (let k = 0; k < 4; k++) {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.fillStyle = k === i ? "#ffd166" : "rgba(255,255,255,0.35)";
    roundRect(octx, 540 - 92 + k * 48, 250, k === i ? 64 : 28, 10, 5); octx.fill();
  }
  flash(0.55 * (1 - seg(lt, 0, 0.1)));
  whip(E.inExpo(seg(lt, 0.86, 1.0)) * 3, i % 2 ? -1 : 1);
}

function featureCard(label, big, lt, inP, outP, y0) {
  const a = clamp(inP) * (1 - outP);
  if (a <= 0) return;
  glassCard(110, y0, 860, 340, a, 48);
  kinetic(label, 540, y0 + 100, { t: lt - 0.06, size: 52, weight: 600, mode: "up", stagger: 0.02, dur: 0.2, out: outP, color: "rgba(255,255,255,0.9)", shadow: false });
  const sc = lerp(1.4, 1, E.outExpo(seg(lt, 0.04, 0.3)));
  octx.save();
  octx.setTransform(sc, 0, 0, sc, 540 * (1 - sc), (y0 + 270) * (1 - sc));
  octx.globalAlpha = a;
  octx.font = font(900, 190, SANS);
  octx.textAlign = "center";
  octx.fillStyle = "#ffd166";
  octx.shadowColor = "rgba(255,190,80,0.6)"; octx.shadowBlur = 40;
  octx.fillText(big, 540, y0 + 285);
  octx.restore();
}

function mapCard(lt, inP, outP) {
  const a = clamp(inP) * (1 - outP);
  if (a <= 0) return;
  const x = 110, y = 520, w = 860, h = 900;
  glassCard(x, y, w, h, a, 48);
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = a;
  roundRect(octx, x + 30, y + 30, w - 60, 560, 30); octx.clip();
  octx.fillStyle = "#151c2e"; octx.fillRect(x, y, w, h);
  // 강
  octx.fillStyle = "#1d3b6a";
  octx.beginPath(); octx.moveTo(x, y + 470); octx.bezierCurveTo(x + 300, y + 420, x + 560, y + 560, x + w, y + 500); octx.lineTo(x + w, y + 620); octx.lineTo(x, y + 620); octx.fill();
  // 길
  octx.strokeStyle = "rgba(255,255,255,0.14)"; octx.lineWidth = 14;
  for (let k = 0; k < 5; k++) { octx.beginPath(); octx.moveTo(x, y + 90 + k * 85); octx.lineTo(x + w, y + 60 + k * 85); octx.stroke(); }
  for (let k = 0; k < 5; k++) { octx.beginPath(); octx.moveTo(x + 120 + k * 160, y); octx.lineTo(x + 100 + k * 160, y + 600); octx.stroke(); }
  // 경로
  const pts = [[x + 220, y + 390], [x + 220, y + 260], [x + 440, y + 245], [x + 600, y + 230], [x + 610, y + 150]];
  const p = E.inOutCubic(seg(lt, 0.15, 0.7));
  octx.strokeStyle = "#ffd166"; octx.lineWidth = 12; octx.lineCap = "round"; octx.setLineDash([2, 22]);
  octx.beginPath(); octx.moveTo(...pts[0]);
  let total = 0; const lens = [];
  for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); lens.push(d); total += d; }
  let remain = total * p, cur = pts[0];
  for (let k = 1; k < pts.length && remain > 0; k++) {
    const d = lens[k - 1], u = Math.min(1, remain / d);
    cur = [lerp(pts[k - 1][0], pts[k][0], u), lerp(pts[k - 1][1], pts[k][1], u)];
    octx.lineTo(...cur); remain -= d;
  }
  octx.stroke(); octx.setLineDash([]);
  pin(pts[0][0], pts[0][1], "#ffd166", "집");
  pin(pts[4][0], pts[4][1], "#7dd3fc", "학교", seg(lt, 0.6, 0.75));
  // 걷는 점
  octx.fillStyle = "#fff"; octx.beginPath(); octx.arc(cur[0], cur[1], 13, 0, Math.PI * 2); octx.fill();
  octx.restore();
  kinetic("초등학교까지 걸어서", 540, y + 680, { t: lt - 0.1, size: 52, weight: 600, mode: "up", stagger: 0.02, dur: 0.2, out: outP, shadow: false });
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = a;
  octx.font = font(900, 170, SANS); octx.textAlign = "center"; octx.fillStyle = "#ffd166";
  octx.shadowColor = "rgba(255,190,80,0.6)"; octx.shadowBlur = 40;
  octx.fillText("3분", 540, y + 860);
  octx.restore();
}

function pin(x, y, color, label, a = 1) {
  if (a <= 0) return;
  octx.save();
  octx.globalAlpha *= a;
  octx.fillStyle = color;
  octx.beginPath(); octx.arc(x, y - 44, 30, Math.PI, 0); octx.lineTo(x, y); octx.closePath(); octx.fill();
  octx.fillStyle = "#151c2e"; octx.beginPath(); octx.arc(x, y - 44, 12, 0, Math.PI * 2); octx.fill();
  octx.font = font(800, 34, SANS); octx.textAlign = "center"; octx.fillStyle = "#fff";
  octx.fillText(label, x, y - 90);
  octx.restore();
}

function poolCard(lt, inP, outP, y0) {
  const a = clamp(inP) * (1 - outP);
  if (a <= 0) return;
  featureCard("단지 안 실내수영장", "25m", lt, inP, outP, y0);
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = a * 0.9;
  octx.strokeStyle = "#7dd3fc"; octx.lineWidth = 8; octx.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    octx.beginPath();
    for (let xx = 0; xx <= 240; xx += 6) {
      const yy = y0 - 120 + k * 34 + Math.sin(xx * 0.05 + lt * 9 + k) * 10;
      xx ? octx.lineTo(420 + xx, yy) : octx.moveTo(420 + xx, yy);
    }
    octx.stroke();
  }
  octx.restore();
}

// ---------- 4. 불이 켜지는 순간 ----------
function sceneLights(t) {
  const k = seg(t, 8.0, 10.8);
  const pal = mixPal(DUSK, NIGHT, E.inOutSine(k));
  const lit = E.inOutSine(seg(t, 8.3, 10.9));
  drawCity({ t, pal, cam: { x: 560, y: 980, z: lerp(1.05, 1.28, E.inOutSine(seg(t, 8, 11.5))) }, lit, cars: lit, crown: seg(t, 10.2, 10.8), sun: { x: 180, y: 1300, r: 60, a: 0.5 * (1 - k) } });
  const outP = seg(t, 11.2, 11.45);
  scrim(seg(t, 8.2, 8.6) * (1 - outP), 0, 1000);
  kinetic("불이 켜지는 순간", 540, 360, { t: t - 8.35, size: 88, weight: 700, mode: "blur", stagger: 0.04, dur: 0.35, out: Math.max(outP, seg(t, 9.35, 9.6)) });
  kinetic("여기가", 540, 520, { t: t - 9.6, size: 120, weight: 900, mode: "up", stagger: 0.05, dur: 0.25, out: outP });
  kinetic("집이 된다", 540, 670, { t: t - 10.0, size: 150, weight: 900, mode: "pop", stagger: 0.07, dur: 0.3, out: outP, color: "#ffd166" });
  flash(0.6 * (1 - seg(t, 8.0, 8.12)));
}

// ---------- 5. 로고 + 댓글 유도 + 루프 ----------
function sceneLogo(t) {
  drawCity({ t, pal: NIGHT, cam: { x: 560, y: 960, z: lerp(1.28, 1.4, seg(t, 11.5, 15)) }, lit: 1, cars: 1, crown: 1, moon: { x: 850, y: 300 } });
  blurFrame(16 * E.outCubic(seg(t, 11.5, 12.1)));
  fade(0.45 * seg(t, 11.5, 12.1));
  const sp = lerp(70, 22, E.outExpo(seg(t, 11.6, 12.7)));
  goldText("AURELLE", 540, 820, { size: 150, weight: 700, spacing: sp, alpha: seg(t, 11.6, 12.0), shine: seg(t, 12.7, 13.5) });
  bar(540 - 120, 880, 240, 3, seg(t, 12.1, 12.6), "rgba(230,194,122,0.9)");
  kinetic("오렐 리버테라스", 540, 960, { t: t - 12.2, size: 54, weight: 500, mode: "fade", stagger: 0.03, dur: 0.3, spacing: 10, color: "#f3e6c8" });
  kinetic("THE RIVER TERRACE", 540, 1020, { t: t - 12.4, size: 28, weight: 500, mode: "fade", stagger: 0.015, dur: 0.3, spacing: 12, color: "rgba(243,230,200,0.7)", shadow: false });

  // 댓글 유도
  const ca = E.outBack(seg(t, 13.0, 13.35));
  if (ca > 0) {
    octx.save();
    octx.setTransform(ca, 0, 0, ca, 540 * (1 - ca), 1290 * (1 - ca));
    octx.fillStyle = "#ffd166";
    roundRect(octx, 130, 1190, 820, 200, 100); octx.fill();
    octx.font = font(800, 50, SANS); octx.textAlign = "center"; octx.fillStyle = "#1a1408";
    octx.fillText("댓글에 '오렐' 남기면", 540, 1275);
    octx.font = font(600, 44, SANS);
    octx.fillText("분양 정보 보내드려요", 540, 1345);
    octx.restore();
  }
  // 커튼이 닫히며 첫 장면으로 (루프)
  const close = E.inOutCubic(seg(t, 14.25, 15.0));
  if (close > 0) drawInterior(1 - close, 1 + (1 - close) * 1.2);
}
