// 모션그래픽 공용 엔진: 매 프레임 renderFrame(t)를 부르면 그 시각의 화면을 그려요.
const W = 1080, H = 1920, WATER = 1380;

// ---------- 수학/이징 ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
};
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixHex(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(",")})`; }
function mixPal(p, q, t) { const o = {}; for (const k in p) o[k] = typeof p[k] === "number" ? lerp(p[k], q[k], t) : mixHex(p[k], q[k], t); return o; }
function toHexPal(p) { // rgb()를 다시 섞을 수 있게 hex로
  const o = {};
  for (const k in p) {
    if (typeof p[k] === "string" && p[k].startsWith("rgb")) {
      const m = p[k].match(/\d+/g).map(Number);
      o[k] = "#" + m.map((v) => v.toString(16).padStart(2, "0")).join("");
    } else o[k] = p[k];
  }
  return o;
}

// ---------- 하늘 팔레트 ----------
const PAL = {
  night:  { top: "#03060f", mid: "#0a1430", hor: "#1d2b57", glow: "#3a4f8f", face: "#0b1426", side: "#070d1a", sky1: "#0b1a3a", water: "#040a18", haze: "#1b2a50", stars: 1, sun: 0 },
  dusk:   { top: "#141a40", mid: "#4a3576", hor: "#e07a5f", glow: "#f2a65a", face: "#1d1f3d", side: "#120f26", sky1: "#5b4a8a", water: "#120f2a", haze: "#6a4a7a", stars: 0.3, sun: 0.4 },
  golden: { top: "#3d5a8f", mid: "#e9a86f", hor: "#ffd89a", glow: "#fff1c9", face: "#3a4560", side: "#262c40", sky1: "#f4c58f", water: "#2a3550", haze: "#e8b88a", stars: 0, sun: 1 },
  blue:   { top: "#0a1b3d", mid: "#1f3f78", hor: "#5e7fbf", glow: "#8fb0e8", face: "#14223f", side: "#0c162b", sky1: "#2c4c8a", water: "#081530", haze: "#2a4478", stars: 0.5, sun: 0 },
};

// ---------- 캔버스 ----------
function makeCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
const out = document.getElementById("c");
out.width = W; out.height = H;
const octx = out.getContext("2d");
const baseC = makeCanvas(W, H), bctx = baseC.getContext("2d");
const lightC = makeCanvas(W, H), lctx = lightC.getContext("2d");
const bloomC = makeCanvas(W / 4, H / 4), blctx = bloomC.getContext("2d");
const tmpC = makeCanvas(W, H), tctx = tmpC.getContext("2d");
const tmp2C = makeCanvas(W, H), t2ctx = tmp2C.getContext("2d");

// 필름 그레인 (미리 만들어 두고 위치만 바꿔요)
const grainC = makeCanvas(512, 512);
{
  const g = grainC.getContext("2d"), img = g.createImageData(512, 512), r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
}

// ---------- 도시 데이터 ----------
const TOWERS = [
  { x: 250, w: 165, top: 560, floors: 38, side: 46, seed: 11 },
  { x: 470, w: 205, top: 330, floors: 47, side: 58, seed: 22, hero: true },
  { x: 735, w: 160, top: 620, floors: 35, side: 44, seed: 33 },
];
const SKYLINE = (() => {
  const layers = [];
  [[0.45, 140, 360, 1], [0.7, 90, 240, 2]].forEach(([shade, minH, maxH, seed]) => {
    const r = rng(seed * 97), arr = [];
    for (let x = -700; x < 1800;) {
      const w = 40 + r() * 90, h = minH + r() * (maxH - minH);
      arr.push({ x, w, h, win: r(), seed: Math.floor(r() * 1e6) });
      x += w + r() * 18;
    }
    layers.push({ shade, arr });
  });
  return layers;
})();

function camXf(ctx, cam) {
  const z = cam.z || 1;
  ctx.setTransform(z, 0, 0, z, W / 2 - cam.x * z, H / 2 - cam.y * z);
}
function waterScreenY(cam) { return (WATER - cam.y) * (cam.z || 1) + H / 2; }

// 창문 하나의 켜짐 정도 (0~1). wave: 아래층부터 켜지는 진행도.
function windowLit(o, rr, floorFrac, tower) {
  if (o.lit === undefined) return 0;
  const p = o.lit;               // 전체 켜짐 비율 0~1
  if (rr > 0.6) return 0;        // 실제 아파트처럼 60% 정도만 켜져요
  const order = floorFrac * 0.65 + (rr / 0.6) * 0.35; // 아래층·무작위 순서
  if (order > p * 1.05) return 0;
  return clamp((p * 1.05 - order) * 12);
}

// ---------- 도시 그리기 ----------
function drawCity(o) {
  const cam = o.cam, z = cam.z || 1, pal = o.pal, t = o.t;
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, W, H);
  const wy = waterScreenY(cam);

  // 하늘
  const sg = bctx.createLinearGradient(0, wy - 1700 * z, 0, wy);
  sg.addColorStop(0, pal.top); sg.addColorStop(0.55, pal.mid); sg.addColorStop(0.88, pal.hor); sg.addColorStop(1, pal.glow);
  bctx.fillStyle = sg; bctx.fillRect(0, 0, W, H);

  // 별
  if (pal.stars > 0.01) {
    const r = rng(5);
    for (let i = 0; i < 160; i++) {
      const x = r() * W, y = r() * (wy - 500 * z), tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      bctx.fillStyle = `rgba(255,255,255,${pal.stars * (0.25 + 0.5 * r()) * tw})`;
      bctx.fillRect(x - cam.x * 0.02, y, 2, 2);
    }
  }

  camXf(bctx, cam); camXf(lctx, cam);

  // 해 / 달
  if (o.sun) {
    const s = o.sun, g = bctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
    g.addColorStop(0, `rgba(255,248,225,${s.a})`); g.addColorStop(0.15, `rgba(255,220,160,${s.a * 0.7})`); g.addColorStop(1, "rgba(255,200,140,0)");
    bctx.fillStyle = g; bctx.beginPath(); bctx.arc(s.x, s.y, s.r * 6, 0, Math.PI * 2); bctx.fill();
  }
  if (o.moon) {
    const m = o.moon;
    const g = bctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 160);
    g.addColorStop(0, "rgba(255,250,235,0.35)"); g.addColorStop(1, "rgba(255,250,235,0)");
    bctx.fillStyle = g; bctx.fillRect(m.x - 160, m.y - 160, 320, 320);
    bctx.fillStyle = "#fff8e8"; bctx.beginPath(); bctx.arc(m.x, m.y, 34, 0, Math.PI * 2); bctx.fill();
  }

  // 먼 스카이라인 (두 겹, 패럴랙스)
  SKYLINE.forEach((layer, li) => {
    const par = li === 0 ? 0.25 : 0.12;
    const col = mixHex(toHexPal({ c: pal.haze }).c, toHexPal({ c: pal.side }).c, layer.shade);
    bctx.fillStyle = col;
    for (const b of layer.arr) {
      const x = b.x + cam.x * par - 540 * par;
      bctx.fillRect(x, WATER - b.h, b.w, b.h);
      // 작은 창문 불빛
      if (o.lit !== undefined && o.lit > 0) {
        const r = rng(b.seed);
        for (let yy = WATER - b.h + 10; yy < WATER - 6; yy += 13) {
          for (let xx = x + 6; xx < x + b.w - 6; xx += 11) {
            const rr = r();
            if (rr < 0.38 * o.lit * (li ? 0.8 : 1)) {
              lctx.fillStyle = rr < 0.05 ? "rgba(180,210,255,0.8)" : `rgba(255,${190 + Math.floor(rr * 150)},130,${0.55 + rr})`;
              lctx.fillRect(xx, yy, 4, 5);
            }
          }
        }
      }
    }
  });

  // 다리 + 자동차 불빛
  bctx.fillStyle = mixHex(toHexPal({ c: pal.side }).c, "#000000", 0.3);
  bctx.fillRect(-800, WATER - 46, 2900, 14);
  for (let x = -800; x < 2100; x += 210) bctx.fillRect(x, WATER - 40, 12, 40);
  if (o.cars) {
    for (let i = 0; i < 26; i++) {
      const dir = i % 2 ? 1 : -1, sp = 260 + (i * 37) % 140;
      const x = (((i * 191 + dir * t * sp) % 2700) + 2700) % 2700 - 800;
      lctx.fillStyle = dir > 0 ? `rgba(255,70,60,${o.cars})` : `rgba(255,240,210,${o.cars})`;
      lctx.fillRect(x, WATER - 44 + (dir > 0 ? 2 : 6), 46, 3);
    }
    // 다리 가로등
    for (let x = -800; x < 2100; x += 70) { lctx.fillStyle = `rgba(255,214,150,${0.9 * o.cars})`; lctx.fillRect(x, WATER - 50, 4, 4); }
  }

  // 저층 테라스 (단지 앞)
  bctx.fillStyle = pal.side;
  bctx.fillRect(190, 1250, 760, WATER - 1250);
  for (let i = 0; i < 5; i++) {
    bctx.fillStyle = `rgba(255,255,255,${0.04 + i * 0.01})`;
    bctx.fillRect(190, 1262 + i * 24, 760, 2);
  }
  if (o.lit > 0) {
    for (let x = 205; x < 940; x += 26) { lctx.fillStyle = `rgba(255,205,140,${0.75 * o.lit})`; lctx.fillRect(x, 1292, 14, 9); lctx.fillRect(x, 1340, 14, 9); }
  }

  // 메인 타워
  TOWERS.forEach((tw, ti) => drawTower(tw, ti, o));

  // 불꽃
  (o.fireworks || []).forEach((f) => drawFirework(f, t));

  // ---- 합성: 기본 + 불빛 + 번짐(블룸) ----
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalCompositeOperation = "source-over";
  octx.globalAlpha = 1;
  octx.drawImage(baseC, 0, 0);
  octx.drawImage(lightC, 0, 0);
  blctx.setTransform(1, 0, 0, 1, 0, 0);
  blctx.clearRect(0, 0, W / 4, H / 4);
  blctx.filter = "blur(6px)";
  blctx.drawImage(lightC, 0, 0, W / 4, H / 4);
  blctx.filter = "none";
  octx.globalCompositeOperation = "lighter";
  octx.globalAlpha = o.bloom ?? 0.6;
  octx.drawImage(bloomC, 0, 0, W, H);
  octx.globalAlpha = 1;
  octx.globalCompositeOperation = "source-over";

  // ---- 물 + 반사 ----
  drawWater(o, wy);
}

function drawTower(tw, ti, o) {
  const pal = o.pal, t = o.t;
  const x = tw.x, w = tw.w, top = tw.top, bot = WATER - 40, s = tw.side;
  // 옆면 (깊이감)
  bctx.fillStyle = pal.side;
  bctx.beginPath();
  bctx.moveTo(x + w, top + 8); bctx.lineTo(x + w + s, top - 10); bctx.lineTo(x + w + s, bot); bctx.lineTo(x + w, bot); bctx.closePath(); bctx.fill();
  // 앞면 유리
  const g = bctx.createLinearGradient(x, top, x + w, bot);
  g.addColorStop(0, mixHex(toHexPal({ c: pal.face }).c, toHexPal({ c: pal.sky1 }).c, 0.45));
  g.addColorStop(0.5, pal.face);
  g.addColorStop(1, mixHex(toHexPal({ c: pal.face }).c, "#000000", 0.35));
  bctx.fillStyle = g; bctx.fillRect(x, top, w, bot - top);
  // 유리 반사 띠
  const sweep = ((o.cam.x - 540) * 0.6 + ti * 120) % 400;
  const rg = bctx.createLinearGradient(x + sweep - 160, top, x + sweep + 120, bot);
  rg.addColorStop(0, "rgba(255,255,255,0)"); rg.addColorStop(0.5, `rgba(255,255,255,${0.08 + 0.12 * (pal.sun || 0)})`); rg.addColorStop(1, "rgba(255,255,255,0)");
  bctx.fillStyle = rg; bctx.fillRect(x, top, w, bot - top);
  // 햇빛 (왼쪽에서 비추는 따뜻한 빛)
  if (pal.sun > 0.05) {
    const sg2 = bctx.createLinearGradient(x, 0, x + w, 0);
    sg2.addColorStop(0, `rgba(255,186,110,${0.38 * pal.sun})`); sg2.addColorStop(1, `rgba(255,186,110,${0.05 * pal.sun})`);
    bctx.fillStyle = sg2; bctx.fillRect(x, top, w, bot - top);
  }

  // 창문 격자
  const floors = tw.floors, fh = (bot - top - 20) / floors, cols = Math.round(w / 23), cw = w / cols;
  const r = rng(tw.seed);
  for (let f = 0; f < floors; f++) {
    const y = bot - (f + 1) * fh;
    bctx.fillStyle = "rgba(0,0,0,0.28)";
    bctx.fillRect(x, y + fh - 2, w, 2);
    for (let c = 0; c < cols; c++) {
      const rr = r(), rr2 = r();
      const lit = windowLit(o, rr, f / floors, ti);
      const wx = x + c * cw + 3, wwid = cw - 6, wyy = y + 3, wh = fh - 7;
      if (lit > 0) {
        const br = 0.45 + 0.55 * rr2;
        const warm = rr2 < 0.06 ? `rgba(150,190,255,${0.7 * lit})` : `rgba(255,${178 + Math.floor(rr2 * 50)},${96 + Math.floor(rr2 * 60)},${br * lit})`;
        lctx.fillStyle = warm; lctx.fillRect(wx, wyy, wwid, wh);
      } else if (pal.sun > 0.5 && rr2 < 0.35) {
        bctx.fillStyle = `rgba(255,230,190,${0.12 * pal.sun})`; bctx.fillRect(wx, wyy, wwid, wh);
      }
    }
  }
  // 세로 멀리언
  bctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let c = 1; c < cols; c++) bctx.fillRect(x + c * cw - 1, top, 2, bot - top);
  // 발코니 띠 (층마다 밝은 선, 세 층마다 두꺼운 띠)
  for (let f = 1; f < floors; f++) {
    const y = bot - f * fh;
    bctx.fillStyle = f % 3 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.11)";
    bctx.fillRect(x - 3, y - 1, w + 6, f % 3 ? 2 : 4);
  }
  // 모서리 금색 포인트 조명
  const ca2 = o.crown ?? 0;
  if (ca2 > 0) {
    lctx.fillStyle = `rgba(230,194,122,${0.55 * ca2})`;
    lctx.fillRect(x - 2, top, 3, bot - top);
    lctx.fillRect(x + w - 1, top, 3, bot - top);
  }

  // 크라운 (옥상 조명)
  if (tw.hero) {
    bctx.fillStyle = pal.side;
    bctx.fillRect(x + 20, top - 60, w - 40, 60);
    bctx.fillRect(x + 55, top - 110, w - 110, 50);
    bctx.fillRect(x + w / 2 - 3, top - 190, 6, 80);
    const ca = o.crown ?? 0;
    if (ca > 0) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 6);
      lctx.fillStyle = `rgba(255,214,140,${ca * pulse})`;
      lctx.fillRect(x + 20, top - 62, w - 40, 4);
      lctx.fillRect(x + 55, top - 112, w - 110, 4);
      lctx.fillRect(x - 2, top - 2, w + 4, 4);
      for (let i = 0; i < 6; i++) lctx.fillRect(x + 28 + i * ((w - 56) / 5) - 2, top - 58, 4, 54);
      lctx.fillStyle = `rgba(255,90,90,${ca})`;
      lctx.fillRect(x + w / 2 - 4, top - 196, 8, 8);
    }
  }
}

function drawFirework(f, t) {
  const dt = t - f.t0;
  if (dt < 0 || dt > 2.2) return;
  if (dt < 0.45) { // 올라가는 꼬리
    const p = dt / 0.45, y = lerp(WATER, f.y, E.outCubic(p));
    lctx.fillStyle = "rgba(255,230,190,0.9)"; lctx.fillRect(f.x - 2, y, 4, 26);
    return;
  }
  const d = dt - 0.45, r = rng(f.seed || 3), n = 90;
  const fade = clamp(1 - d / 1.75);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.05, sp = 230 + r() * 120;
    const k = 1 - Math.exp(-d * 2.6);
    const px = f.x + Math.cos(a) * sp * k, py = f.y + Math.sin(a) * sp * k + 60 * d * d;
    const px2 = f.x + Math.cos(a) * sp * k * 0.86, py2 = f.y + Math.sin(a) * sp * k * 0.86 + 60 * d * d;
    lctx.strokeStyle = i % 3 ? `rgba(${f.c},${fade})` : `rgba(255,255,240,${fade})`;
    lctx.lineWidth = 3; lctx.beginPath(); lctx.moveTo(px2, py2); lctx.lineTo(px, py); lctx.stroke();
  }
}

function drawWater(o, wy) {
  if (wy >= H) return;
  const pal = o.pal, t = o.t;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  // 위쪽 화면을 복사해서 뒤집어 그려요 (물결 흔들림)
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.clearRect(0, 0, W, H);
  tctx.drawImage(out, 0, 0);
  const g = octx.createLinearGradient(0, wy, 0, H);
  g.addColorStop(0, pal.water); g.addColorStop(1, mixHex(toHexPal({ c: pal.water }).c, "#000000", 0.5));
  octx.fillStyle = g; octx.fillRect(0, wy, W, H - wy);
  const sl = 4;
  for (let y = wy; y < H; y += sl) {
    const d = y - wy, src = wy - d * 0.92;
    if (src < 0) break;
    const off = Math.sin(y * 0.09 + t * 3.2) * (1.5 + d * 0.015) + Math.sin(y * 0.031 - t * 1.7) * 1.5;
    octx.globalAlpha = 0.62 * (1 - d / (H - wy + 200));
    octx.drawImage(tmpC, 0, src, W, sl, off, y, W, sl);
  }
  octx.globalAlpha = 1;
  // 반짝임
  const r = rng(91);
  octx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 140; i++) {
    const x = r() * W, y = wy + 10 + r() * (H - wy), a = Math.max(0, Math.sin(t * 4 + i * 1.7)) * (o.lit ?? 0.5) * 0.5;
    octx.fillStyle = `rgba(255,220,170,${a})`;
    octx.fillRect(x + Math.sin(t + i) * 10, y, 12 + r() * 20, 2);
  }
  octx.globalCompositeOperation = "source-over";
  // 수평선 경계 부드럽게
  const hg = octx.createLinearGradient(0, wy - 6, 0, wy + 14);
  hg.addColorStop(0, "rgba(0,0,0,0)"); hg.addColorStop(0.5, "rgba(0,0,0,0.35)"); hg.addColorStop(1, "rgba(0,0,0,0)");
  octx.fillStyle = hg; octx.fillRect(0, wy - 6, W, 20);
}

// ---------- 화면 효과 ----------
function vignette(a = 0.55) {
  octx.setTransform(1, 0, 0, 1, 0, 0);
  const g = octx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${a})`);
  octx.fillStyle = g; octx.fillRect(0, 0, W, H);
}
function grain(t, a = 0.05) {
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = a;
  octx.globalCompositeOperation = "overlay";
  const r = rng(Math.floor(t * 30) + 1), ox = -r() * 512, oy = -r() * 512;
  for (let x = ox; x < W; x += 512) for (let y = oy; y < H; y += 512) octx.drawImage(grainC, x, y);
  octx.globalAlpha = 1;
  octx.globalCompositeOperation = "source-over";
}
function flash(a, color = "255,255,255") {
  if (a <= 0) return;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.fillStyle = `rgba(${color},${a})`; octx.fillRect(0, 0, W, H);
}
function fade(a) { flash(a, "0,0,0"); }
function lightLeak(t, a, x = 900, y = 300, color = "255,170,90") {
  if (a <= 0) return;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalCompositeOperation = "lighter";
  const cx = x + Math.sin(t * 0.7) * 120, cy = y + Math.cos(t * 0.5) * 160;
  const g = octx.createRadialGradient(cx, cy, 0, cx, cy, 700);
  g.addColorStop(0, `rgba(${color},${0.55 * a})`); g.addColorStop(1, `rgba(${color},0)`);
  octx.fillStyle = g; octx.fillRect(0, 0, W, H);
  octx.globalCompositeOperation = "source-over";
}
function lensFlare(sx, sy, a) {
  if (a <= 0) return;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalCompositeOperation = "lighter";
  const g = octx.createRadialGradient(sx, sy, 0, sx, sy, 380);
  g.addColorStop(0, `rgba(255,245,220,${a})`); g.addColorStop(0.2, `rgba(255,200,140,${0.4 * a})`); g.addColorStop(1, "rgba(255,180,120,0)");
  octx.fillStyle = g; octx.fillRect(0, 0, W, H);
  const dx = W / 2 - sx, dy = H / 2 - sy;
  [[0.5, 40, "255,220,170", 0.18], [0.8, 80, "170,200,255", 0.12], [1.3, 30, "255,190,140", 0.2], [1.7, 120, "200,255,220", 0.06]].forEach(([k, r, c, al]) => {
    const px = sx + dx * k, py = sy + dy * k, gg = octx.createRadialGradient(px, py, 0, px, py, r);
    gg.addColorStop(0, `rgba(${c},${al * a})`); gg.addColorStop(1, `rgba(${c},0)`);
    octx.fillStyle = gg; octx.beginPath(); octx.arc(px, py, r, 0, Math.PI * 2); octx.fill();
  });
  // 가로 빛줄기
  const hg = octx.createLinearGradient(sx - 600, 0, sx + 600, 0);
  hg.addColorStop(0, "rgba(255,210,160,0)"); hg.addColorStop(0.5, `rgba(255,220,180,${0.35 * a})`); hg.addColorStop(1, "rgba(255,210,160,0)");
  octx.fillStyle = hg; octx.fillRect(sx - 600, sy - 2, 1200, 4);
  octx.globalCompositeOperation = "source-over";
}
// 화면을 흐리게 (뒤 배경 블러)
function blurFrame(px, alpha = 1) {
  if (px <= 0) return;
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.clearRect(0, 0, W, H);
  tctx.drawImage(out, 0, 0);
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = alpha;
  octx.filter = `blur(${px}px)`;
  octx.drawImage(tmpC, 0, 0);
  octx.filter = "none";
  octx.globalAlpha = 1;
}
// 빠른 가로 전환(휩 팬) 느낌의 모션 블러
function whip(amount, dir = 1) {
  if (amount <= 0) return;
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.clearRect(0, 0, W, H);
  tctx.drawImage(out, 0, 0);
  octx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 1; i <= 8; i++) {
    octx.globalAlpha = 0.18;
    octx.drawImage(tmpC, dir * amount * i * 18, 0);
  }
  octx.globalAlpha = 1;
}

// ---------- 글자 ----------
function font(weight, size, family) { return `${weight} ${size}px ${family}`; }
const SANS = '"Pretendard"', SERIF = '"Noto Serif KR"';

// 글자 단위 등장. mode: up(아래서 올라옴) / pop(튀어나옴) / blur(흐림에서 선명) / fade
function kinetic(str, x, y, opt) {
  const { size = 96, weight = 800, family = SANS, color = "#fff", t = 1, stagger = 0.04, dur = 0.35, align = "center", spacing = 0, mode = "up", shadow = true, out: outP = 0, stroke } = opt;
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.font = font(weight, size, family);
  octx.textBaseline = "alphabetic";
  const chars = [...str];
  const widths = chars.map((c) => octx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  chars.forEach((ch, i) => {
    const p = clamp((t - i * stagger) / dur);
    const vis = p * (1 - outP);
    if (vis <= 0.001) { cx += widths[i]; return; }
    octx.save();
    let dy = 0, sc = 1, blur = 0, alpha = vis;
    if (mode === "up") dy = (1 - E.outCubic(p)) * size * 0.6;
    if (mode === "pop") sc = lerp(0.3, 1, E.outBack(p));
    if (mode === "blur") blur = (1 - E.outCubic(p)) * 18;
    if (outP > 0) dy -= outP * size * 0.4;
    octx.globalAlpha = clamp(alpha);
    const w = widths[i] - spacing;
    octx.translate(cx + w / 2, y + dy);
    octx.scale(sc, sc);
    if (blur > 0.2) octx.filter = `blur(${blur}px)`;
    if (shadow) { octx.shadowColor = "rgba(0,0,0,0.55)"; octx.shadowBlur = size * 0.25; octx.shadowOffsetY = size * 0.05; }
    if (stroke) { octx.lineWidth = stroke.w; octx.strokeStyle = stroke.c; octx.lineJoin = "round"; octx.strokeText(ch, -w / 2, 0); }
    octx.fillStyle = typeof color === "function" ? color(i) : color;
    octx.fillText(ch, -w / 2, 0);
    octx.restore();
    cx += widths[i];
  });
  octx.restore();
  return total;
}
function textWidth(str, size, weight, family = SANS, spacing = 0) {
  octx.font = font(weight, size, family);
  return [...str].reduce((a, c) => a + octx.measureText(c).width + spacing, 0) - spacing;
}
function bar(x, y, w, h, p, color) {
  if (p <= 0) return;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.fillStyle = color;
  octx.fillRect(x, y, w * E.outExpo(p), h);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// 유리 카드 (뒤를 흐리게 비춰요)
function glassCard(x, y, w, h, a = 1, r = 40) {
  if (a <= 0) return;
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.clearRect(0, 0, W, H);
  tctx.drawImage(out, 0, 0);
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = a;
  roundRect(octx, x, y, w, h, r);
  octx.clip();
  octx.filter = "blur(26px)";
  octx.drawImage(tmpC, 0, 0);
  octx.filter = "none";
  octx.fillStyle = "rgba(10,14,26,0.55)";
  octx.fillRect(x, y, w, h);
  octx.fillStyle = "rgba(255,255,255,0.06)";
  octx.fillRect(x, y, w, h);
  const g = octx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "rgba(255,255,255,0.18)"); g.addColorStop(1, "rgba(255,255,255,0)");
  octx.fillStyle = g; octx.fillRect(x, y, w, h);
  octx.restore();
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = a;
  roundRect(octx, x, y, w, h, r);
  octx.strokeStyle = "rgba(255,255,255,0.35)"; octx.lineWidth = 2; octx.stroke();
  octx.restore();
}
// 금색 그라데이션 + 반짝 지나가는 빛
function goldText(str, x, y, opt) {
  const { size = 120, weight = 700, family = SERIF, spacing = 0, alpha = 1, shine = -1 } = opt;
  t2ctx.setTransform(1, 0, 0, 1, 0, 0);
  t2ctx.clearRect(0, 0, W, H);
  t2ctx.font = font(weight, size, family);
  t2ctx.textBaseline = "alphabetic";
  const chars = [...str];
  const widths = chars.map((c) => t2ctx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  const g = t2ctx.createLinearGradient(0, y - size, 0, y + size * 0.2);
  g.addColorStop(0, "#fff3d0"); g.addColorStop(0.45, "#e6c27a"); g.addColorStop(0.7, "#b8873e"); g.addColorStop(1, "#f3d79a");
  t2ctx.fillStyle = g;
  let cx = x - total / 2;
  chars.forEach((c, i) => { t2ctx.fillText(c, cx, y); cx += widths[i]; });
  if (shine >= 0 && shine <= 1) {
    t2ctx.globalCompositeOperation = "source-atop";
    const sx = lerp(x - total / 2 - 300, x + total / 2 + 300, shine);
    const sg = t2ctx.createLinearGradient(sx - 120, 0, sx + 120, 0);
    sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,0.95)"); sg.addColorStop(1, "rgba(255,255,255,0)");
    t2ctx.fillStyle = sg; t2ctx.fillRect(0, y - size, W, size * 1.4);
    t2ctx.globalCompositeOperation = "source-over";
  }
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = alpha;
  octx.shadowColor = "rgba(0,0,0,0.5)"; octx.shadowBlur = 30;
  octx.drawImage(tmp2C, 0, 0);
  octx.restore();
  return total;
}

// 글꼴 미리 불러오기 (캔버스 글자가 대체 글꼴로 나오지 않게)
async function preloadFonts(texts) {
  const all = texts.join("") + "0123456789%";
  const jobs = [];
  for (const w of [400, 500, 600, 700, 800, 900]) jobs.push(document.fonts.load(font(w, 40, SANS), all));
  for (const w of [400, 600, 700, 900]) jobs.push(document.fonts.load(font(w, 40, SERIF), all));
  await Promise.all(jobs);
  await document.fonts.ready;
}

// 위쪽 글자가 잘 읽히도록 어둡게 깔아 주는 막
function scrim(a, y0 = 0, y1 = 900) {
  if (a <= 0) return;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  const g = octx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, `rgba(0,0,0,${0.6 * a})`); g.addColorStop(1, "rgba(0,0,0,0)");
  octx.fillStyle = g; octx.fillRect(0, y0, W, y1 - y0);
}
