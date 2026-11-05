// 프리미엄형 20초: 금색 선 하나 → 설계 도면이 그려지며 타워가 올라감 → 실제 풍경으로 변신(골든아워)
// → 해가 지고 창마다 불이 켜짐 → 세리프 로고
window.DURATION = 20;
const TEXTS = ["빛이 머무는 자리", "한강의 시간이", "당신의 창이 되는 곳", "AURELLE", "오렐 리버테라스", "THE RIVER TERRACE · SEOUL", "47F", "H 196m", "AURELLE TOWER", "RIVER LEVEL"];
window.prepare = () => preloadFonts(TEXTS);

const GOLD = "230,194,122";
const BP_CAM0 = { x: 575, y: 1150, z: 1.6 };

function camAt(t) {
  if (t < 9.5) {
    const p = E.inOutSine(seg(t, 4.0, 9.5));
    return { x: lerp(575, 575, p), y: lerp(1150, 470, p), z: lerp(1.6, 1.3, p) };
  }
  if (t < 14.5) {
    const p = E.inOutSine(seg(t, 9.5, 14.5));
    return { x: lerp(575, 560, p), y: lerp(470, 990, p), z: lerp(1.3, 1.0, p) };
  }
  const p = E.inOutSine(seg(t, 14.5, 20));
  return { x: 560, y: 990, z: lerp(1.0, 1.06, p) };
}

function palAt(t) {
  if (t < 11) return PAL.golden;
  if (t < 13) return mixPal(PAL.golden, PAL.dusk, E.inOutSine(seg(t, 11, 13)));
  if (t < 15) return mixPal(PAL.dusk, PAL.blue, E.inOutSine(seg(t, 13, 15)));
  return mixPal(PAL.blue, PAL.night, E.inOutSine(seg(t, 15, 18)));
}

window.renderFrame = (t) => {
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.filter = "none";
  octx.globalAlpha = 1;
  octx.globalCompositeOperation = "source-over";

  if (t < 4.0) opening(t);
  else {
    const cam = camAt(t);
    const real = E.inOutSine(seg(t, 7.4, 9.6));
    if (real > 0) world(t, cam);
    if (real < 1) {
      // 도면 화면을 위에 덮고, 점점 투명하게
      octx.save();
      octx.globalAlpha = 1 - real;
      blueprintBg();
      octx.restore();
    }
    blueprint(t, cam, 1 - seg(t, 8.6, 10.2));
    if (t >= 9.5) story(t);
    if (t >= 14.5) logo(t);
  }

  vignette(0.6);
  grain(t, 0.045);
  fade(1 - seg(t, 0, 0.5));
  fade(seg(t, 19.2, 20));
};

// ---------- 1. 오프닝: 금색 선 + 첫 문장 ----------
function opening(t) {
  octx.fillStyle = "#05070c"; octx.fillRect(0, 0, W, H);
  const ly = waterScreenY(BP_CAM0);
  const p = E.inOutCubic(seg(t, 0.4, 2.0));
  const half = 540 * p;
  octx.save();
  octx.globalCompositeOperation = "lighter";
  const g = octx.createLinearGradient(540 - half, 0, 540 + half, 0);
  g.addColorStop(0, `rgba(${GOLD},0)`); g.addColorStop(0.5, `rgba(${GOLD},1)`); g.addColorStop(1, `rgba(${GOLD},0)`);
  octx.fillStyle = g; octx.fillRect(540 - half, ly - 1.5, half * 2, 3);
  // 선에서 피어오르는 빛
  const bloom = seg(t, 1.2, 4.0);
  const rg = octx.createRadialGradient(540, ly, 0, 540, ly, 900);
  rg.addColorStop(0, `rgba(255,214,150,${0.35 * bloom})`); rg.addColorStop(1, "rgba(255,214,150,0)");
  octx.fillStyle = rg; octx.fillRect(0, 0, W, H);
  octx.restore();
  // 도면 배경으로 넘어가기
  octx.save();
  octx.globalAlpha = seg(t, 3.2, 4.0);
  blueprintBg();
  octx.restore();
  if (t > 3.2) blueprint(4.0 + (t - 4.0) * 0.001, BP_CAM0, seg(t, 3.2, 4.0));
  kinetic("빛이 머무는 자리", 540, 760, { t: t - 1.5, size: 78, weight: 600, family: SERIF, mode: "blur", stagger: 0.09, dur: 0.6, spacing: 8, color: "#f6ead2", out: seg(t, 3.3, 3.9) });
}

// ---------- 2. 설계 도면 ----------
function blueprintBg() {
  octx.setTransform(1, 0, 0, 1, 0, 0);
  const g = octx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0a1326"); g.addColorStop(1, "#060b17");
  octx.fillStyle = g; octx.fillRect(0, 0, W, H);
}

function strokeProgress(ctx, pts, p) {
  // 여러 점을 잇는 선을 p(0~1)만큼만 그려요
  let total = 0; const lens = [];
  for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); lens.push(d); total += d; }
  let remain = total * p;
  ctx.beginPath(); ctx.moveTo(...pts[0]);
  for (let k = 1; k < pts.length && remain > 0; k++) {
    const d = lens[k - 1], u = Math.min(1, remain / d);
    ctx.lineTo(lerp(pts[k - 1][0], pts[k][0], u), lerp(pts[k - 1][1], pts[k][1], u));
    remain -= d;
  }
  ctx.stroke();
}

function blueprint(t, cam, alpha) {
  if (alpha <= 0) return;
  octx.save();
  camXf(octx, cam);
  octx.globalAlpha = alpha;
  // 모눈
  octx.strokeStyle = "rgba(120,160,230,0.07)"; octx.lineWidth = 1 / cam.z;
  for (let x = -200; x < 1300; x += 40) { octx.beginPath(); octx.moveTo(x, -400); octx.lineTo(x, WATER + 400); octx.stroke(); }
  for (let y = -400; y < WATER + 400; y += 40) { octx.beginPath(); octx.moveTo(-200, y); octx.lineTo(1300, y); octx.stroke(); }

  octx.globalCompositeOperation = "lighter";
  octx.lineCap = "round"; octx.lineJoin = "round";
  octx.shadowColor = `rgba(${GOLD},0.9)`; octx.shadowBlur = 12;
  // 지면 선
  octx.strokeStyle = `rgba(${GOLD},0.9)`; octx.lineWidth = 3 / cam.z;
  octx.beginPath(); octx.moveTo(-400, WATER); octx.lineTo(1500, WATER); octx.stroke();

  TOWERS.forEach((tw, ti) => {
    const x = tw.x, w = tw.w, top = tw.top, bot = WATER - 40, s = tw.side;
    const main = tw.hero ? 1 : 0.45;
    const p = E.inOutCubic(seg(t, 4.0 + ti * 0.25, 6.2 + ti * 0.25));
    octx.strokeStyle = `rgba(${GOLD},${main})`; octx.lineWidth = (tw.hero ? 3 : 2) / cam.z;
    const outline = [[x, WATER], [x, top], [x + w, top], [x + w, WATER]];
    if (tw.hero) outline.splice(2, 0, [x + 20, top], [x + 20, top - 60], [x + 55, top - 60], [x + 55, top - 110], [x + w - 55, top - 110], [x + w - 55, top - 60], [x + w - 20, top - 60], [x + w - 20, top]);
    strokeProgress(octx, outline, p);
    // 옆면
    strokeProgress(octx, [[x + w, top + 8], [x + w + s, top - 10], [x + w + s, WATER]], seg(t, 5.0 + ti * 0.2, 6.6 + ti * 0.2));
    // 층 선 (아래부터)
    const fh = (bot - top - 20) / tw.floors;
    const fp = seg(t, 5.0 + ti * 0.2, 7.6);
    octx.lineWidth = 1 / cam.z;
    octx.strokeStyle = `rgba(${GOLD},${0.45 * main})`;
    const shown = Math.floor(tw.floors * fp);
    for (let f = 1; f <= shown; f++) {
      const y = bot - f * fh;
      const lp = clamp(tw.floors * fp - f + 1);
      octx.beginPath(); octx.moveTo(x, y); octx.lineTo(x + w * lp, y); octx.stroke();
    }
    // 세로 멀리언
    const cols = Math.round(w / 23), cw = w / cols, mp = seg(t, 6.0 + ti * 0.2, 7.8);
    for (let c = 1; c < cols; c++) { octx.beginPath(); octx.moveTo(x + c * cw, bot); octx.lineTo(x + c * cw, lerp(bot, top, mp)); octx.stroke(); }
  });

  // 치수 표기
  const T = TOWERS[1];
  const ap = seg(t, 6.4, 7.2);
  if (ap > 0) {
    octx.shadowBlur = 0;
    octx.globalAlpha = alpha * ap;
    octx.strokeStyle = `rgba(${GOLD},0.8)`; octx.lineWidth = 1.5 / cam.z;
    const dx = T.x - 46;
    octx.beginPath(); octx.moveTo(dx, WATER); octx.lineTo(dx, T.top - 110); octx.stroke();
    for (const y of [WATER, T.top - 110]) { octx.beginPath(); octx.moveTo(dx - 10, y); octx.lineTo(dx + 10, y); octx.stroke(); }
    octx.fillStyle = `rgba(${GOLD},0.95)`;
    octx.font = font(500, 18, SERIF);
    octx.save(); octx.translate(dx - 14, (WATER + T.top) / 2); octx.rotate(-Math.PI / 2); octx.textAlign = "center"; octx.fillText("H 196m", 0, 0); octx.restore();
    octx.font = font(600, 22, SERIF);
    octx.fillText("47F", T.x + T.w + T.side + 14, T.top + 10);
    octx.font = font(500, 16, SERIF);
    octx.fillText("AURELLE TOWER", T.x + T.w + T.side + 14, T.top + 36);
    octx.fillText("RIVER LEVEL", T.x + T.w + T.side + 14, WATER - 10);
  }
  octx.restore();
}

// ---------- 3. 실제 풍경 ----------
function world(t, cam) {
  const pal = palAt(t);
  const lit = E.inOutSine(seg(t, 11.2, 14.5)) * 0.95;
  const sunY = lerp(820, 1330, E.inOutSine(seg(t, 7, 14)));
  drawCity({ t, pal, cam, lit, cars: seg(t, 12, 14.5), crown: seg(t, 13.6, 14.8), sun: { x: 170, y: sunY, r: 70, a: 1 - seg(t, 11, 14) }, bloom: 0.5 });
  // 렌즈 플레어 (해 위치 기준)
  const sx = (170 - cam.x) * cam.z + W / 2, sy = (sunY - cam.y) * cam.z + H / 2;
  lensFlare(sx, sy, 0.55 * (1 - seg(t, 10.5, 13)) * seg(t, 7.6, 9.0));
  lightLeak(t, 0.35 * (1 - seg(t, 11, 13)), 950, 500);
}

function story(t) {
  const outP = seg(t, 13.5, 14.2);
  scrim(seg(t, 9.8, 10.4) * (1 - outP) * 0.7, 0, 900);
  kinetic("한강의 시간이", 540, 430, { t: t - 10.1, size: 62, weight: 600, family: SERIF, mode: "blur", stagger: 0.07, dur: 0.6, spacing: 6, color: "#fff4e0", out: outP });
  kinetic("당신의 창이 되는 곳", 540, 540, { t: t - 11.0, size: 74, weight: 700, family: SERIF, mode: "blur", stagger: 0.07, dur: 0.6, spacing: 6, color: "#fff4e0", out: outP });
}

// ---------- 4. 로고 ----------
function logo(t) {
  octx.setTransform(1, 0, 0, 1, 0, 0);
  const da = seg(t, 14.5, 15.6);
  blurFrame(10 * E.inOutSine(da));
  fade(0.25 * da);
  const g = octx.createLinearGradient(0, 0, 0, 1300);
  g.addColorStop(0, `rgba(3,5,12,${0.7 * da})`); g.addColorStop(1, "rgba(3,5,12,0)");
  octx.fillStyle = g; octx.fillRect(0, 0, W, 1300);
  const sp = lerp(64, 24, E.outQuint(seg(t, 14.8, 16.8)));
  goldText("AURELLE", 540, 700, { size: 140, weight: 700, spacing: sp, alpha: E.inOutSine(seg(t, 14.8, 15.8)), shine: seg(t, 16.6, 17.8) });
  bar(540 - 100, 750, 200, 2, seg(t, 15.8, 16.6), `rgba(${GOLD},0.9)`);
  kinetic("오렐 리버테라스", 540, 830, { t: t - 16.0, size: 48, weight: 600, family: SERIF, mode: "fade", stagger: 0.05, dur: 0.6, spacing: 14, color: "#f3e6c8" });
  kinetic("THE RIVER TERRACE · SEOUL", 540, 888, { t: t - 16.5, size: 24, weight: 500, mode: "fade", stagger: 0.012, dur: 0.5, spacing: 10, color: "rgba(243,230,200,0.7)", shadow: false });
}
