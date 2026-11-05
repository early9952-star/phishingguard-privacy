// 사용법: node render.mjs viral [fps] [--stills 0,1.2,3]
import { chromium } from 'playwright';
import { spawn } from 'child_process';
const name = process.argv[2], fps = +(process.argv[3] || 30);
const stillsArg = process.argv.indexOf('--stills');
const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-device-scale-factor=1'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`file://${process.cwd()}/${name}.html`);
await page.evaluate(() => window.prepare());
const dur = await page.evaluate(() => window.DURATION);
const canvas = page.locator('#c');
if (stillsArg > 0) {
  for (const s of process.argv[stillsArg + 1].split(',').map(Number)) {
    await page.evaluate(t => window.renderFrame(t), s);
    await canvas.screenshot({ path: `still_${name}_${s}.jpg`, type: 'jpeg', quality: 85 });
  }
  console.log('stills done', errs);
  await browser.close();
  process.exit(0);
}
const frames = Math.round(dur * fps);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${name}_video.mp4`], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await page.evaluate(t => window.renderFrame(t), f / fps);
  const buf = await canvas.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 60 === 0) console.log(`${name} ${f}/${frames} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
console.log('done', name, errs.slice(0, 5));
await browser.close();
