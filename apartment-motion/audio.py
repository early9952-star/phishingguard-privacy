# 영상 타이밍에 맞춘 음악·효과음 합성 (저작권 걱정 없는 직접 만든 소리)
import sys, wave
import numpy as np

SR = 44100
rs = np.random.default_rng(1)


def buf(dur):
    return np.zeros((int(dur * SR), 2))


def add(mix, sig, t, gain=1.0, pan=0.0):
    if sig.ndim == 1:
        l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
        sig = np.stack([sig * l, sig * r], 1) * np.sqrt(2)
    i = int(t * SR)
    if i >= len(mix):
        return
    n = min(len(sig), len(mix) - i)
    mix[i:i + n] += sig[:n] * gain


def env(n, a, d, sustain=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
    return e


def note(name):
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    pitch, octv = name[:-1], int(name[-1])
    return 440 * 2 ** ((names[pitch] + (octv - 4) * 12) / 12)


def band_noise(dur, lo, hi, seed=0):
    n = int(dur * SR)
    x = np.random.default_rng(seed).standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, n) / (np.sqrt((hi - lo) / (SR / 2)) + 1e-9) * 0.3


def sweep_noise(dur, f0, f1, seed=0, q=0.6):
    # 주파수가 움직이는 바람 소리 (휙)
    n = int(dur * SR)
    out = np.zeros(n + 4096)
    hop, win = 1024, np.hanning(2048)
    rng = np.random.default_rng(seed)
    for s in range(0, n, hop):
        p = s / max(1, n)
        fc = f0 * (f1 / f0) ** p
        chunk = rng.standard_normal(2048)
        X = np.fft.rfft(chunk)
        f = np.fft.rfftfreq(2048, 1 / SR)
        X *= np.exp(-((np.log(f + 1) - np.log(fc)) ** 2) / (2 * q * q))
        out[s:s + 2048] += np.fft.irfft(X, 2048) * win
    return out[:n] / (np.abs(out).max() + 1e-9)


def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) + band_noise(0.45, 2000, 8000, 3) * np.exp(-t * 120) * 0.6


def clap():
    n = int(0.3 * SR); t = np.arange(n) / SR
    e = np.exp(-t * 18) + 0.6 * np.exp(-np.maximum(0, t - 0.012) * 30) * (t > 0.012)
    return band_noise(0.3, 900, 6000, 5) * e * 1.4


def hat(seed):
    n = int(0.06 * SR); t = np.arange(n) / SR
    return band_noise(0.06, 7000, 16000, seed) * np.exp(-t * 70)


def saw(freq, dur, harm=12, detune=0.0):
    t = np.arange(int(dur * SR)) / SR
    s = np.zeros_like(t)
    for k in range(1, harm + 1):
        s += np.sin(2 * np.pi * freq * (1 + detune) * k * t) / k
    return s * 0.5


def pad(freqs, dur, attack=0.8, release=1.0, bright=6):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for d in (-0.004, 0, 0.005):
            s += saw(f, dur, bright, d)
    e = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / release)
    return s * np.clip(e, 0, 1) / (len(freqs) * 3)


def pluck(freq, dur=1.6, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.45 * bright * np.sin(4 * np.pi * freq * t) * np.exp(-t * 3) + 0.2 * bright * np.sin(6 * np.pi * freq * t) * np.exp(-t * 6)
    return s * np.minimum(1, t / 0.004) * np.exp(-t * 2.6)


def bell(freq, dur=3.0):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * dcy) for r, a, dcy in [(1, 1, 1.2), (2.76, 0.5, 2.0), (5.4, 0.25, 3.5), (8.9, 0.12, 5)])
    return s * np.minimum(1, t / 0.002)


def impact(dur=2.2):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 38 + 50 * np.exp(-t * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    return boom + band_noise(dur, 80, 3000, 9) * np.exp(-t * 9) * 0.7


def riser(dur, f0=200, f1=2400):
    n = int(dur * SR); t = np.arange(n) / SR
    e = (t / dur) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (t / dur)) / SR) * 0.25
    return (sweep_noise(dur, 300, 7000, 4) * 0.8 + tone) * e


def whoosh(dur=0.35, seed=1):
    n = int(dur * SR); t = np.arange(n) / SR
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return sweep_noise(dur, 400, 6000, seed) * e


def firework(seed):
    launch_d = 0.45
    n = int(launch_d * SR); t = np.arange(n) / SR
    whistle = np.sin(2 * np.pi * np.cumsum(900 + 1800 * t / launch_d) / SR) * 0.12 * (t / launch_d)
    n2 = int(1.8 * SR); t2 = np.arange(n2) / SR
    bang = band_noise(1.8, 60, 5000, seed) * np.exp(-t2 * 9) * 1.2 + np.sin(2 * np.pi * 55 * t2) * np.exp(-t2 * 6) * 0.8
    crackle = np.zeros(n2)
    rng = np.random.default_rng(seed + 50)
    for _ in range(70):
        i = int(rng.uniform(0.25, 1.6) * SR)
        crackle[i:i + 300] += rng.standard_normal(300) * np.exp(-np.arange(300) / 40) * 0.35
    return np.concatenate([whistle, bang + crackle])


def reverb(x, seconds=2.2, mix=0.3):
    n = int(seconds * SR)
    out = np.zeros_like(x)
    for ch in range(2):
        ir = np.random.default_rng(10 + ch).standard_normal(n) * np.exp(-np.arange(n) / SR * (6.9 / seconds))
        ir[:int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
        ir /= np.sqrt((ir ** 2).sum())
        L = len(x[:, ch]) + n
        nfft = 1 << (L - 1).bit_length()
        y = np.fft.irfft(np.fft.rfft(x[:, ch], nfft) * np.fft.rfft(ir, nfft), nfft)[:len(x)]
        out[:, ch] = y
    return x * (1 - mix) + out * mix * 1.6


def master(mix, fade_in=0.0, fade_out=0.0):
    n = len(mix)
    if fade_in:
        k = int(fade_in * SR); mix[:k] *= np.linspace(0, 1, k)[:, None]
    if fade_out:
        k = int(fade_out * SR); mix[-k:] *= np.linspace(1, 0, k)[:, None]
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    return mix / (np.abs(mix).max() + 1e-9) * 0.89


def write(path, mix):
    data = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(data.tobytes())


# ---------------- 바이럴형 (120 BPM) ----------------
def viral():
    D = 15.0
    mix, music = buf(D), buf(D)
    chords = [["A3", "C4", "E4"], ["F3", "A3", "C4"], ["C4", "E4", "G4"], ["G3", "B3", "D4"]]
    roots = ["A1", "F1", "C2", "G1"]
    # 패드: 처음부터 끝까지 (2초마다 코드)
    for bar in range(8):
        t0 = bar * 2.0
        if t0 >= D: break
        add(music, pad([note(n) for n in chords[bar % 4]], 2.3, 0.3, 0.5, 5), t0, 0.5)
    # 비트: 드롭(1.5) ~ 8.0, 그리고 로고 부분 반박자
    for k in range(int(D / 0.25)):
        t = k * 0.25
        drop = 1.5 <= t < 8.0
        outro = 11.5 <= t < 14.25
        if drop or outro:
            if (drop and k % 2 == 0) or (outro and k % 4 == 0):
                add(mix, kick(), t, 0.95)
            if drop and k % 4 == 2:
                add(mix, clap(), t, 0.5)
            if drop:
                add(mix, hat(k), t, 0.16 if k % 2 else 0.24, pan=0.3)
            if k % 2 == 0:
                bar = int(t // 2) % 4
                add(music, saw(note(roots[bar]), 0.24, 8) * env(int(0.24 * SR), 0.005, 0.12), t, 0.55)
    # 쉬는 구간 (8.0~11.5): 반짝이는 아르페지오
    arp = ["A4", "C5", "E5", "A5", "E5", "C5"]
    for k in range(14):
        t = 8.0 + k * 0.25
        add(music, pluck(note(arp[k % len(arp)]) * (1 if k < 8 else 1.122), 0.9), t, 0.22, pan=-0.3 + 0.1 * (k % 6))
    music = reverb(music, 1.6, 0.25)
    mix += music

    # 효과음
    add(mix, pluck(note("E5"), 0.6), 0.03, 0.25)                       # POV
    add(mix, whoosh(1.0, 2) * 0.6, 0.35, 0.5, pan=-0.4)                 # 커튼
    add(mix, riser(1.1), 0.4, 0.45)
    add(mix, impact(), 1.5, 0.9)                                         # 드롭
    for t0, s in [(1.9, 4), (2.5, 8), (3.1, 12)]:
        add(mix, firework(s), t0, 0.45, pan=(s - 8) / 10)
    add(mix, whoosh(0.3, 3), 3.78, 0.6)
    for i in range(4):                                                   # 혜택 카드
        b = 4.0 + i
        add(mix, impact(0.8) * 0.6, b, 0.55)
        add(mix, pluck(note(["A5", "C6", "E6", "G5"][i]), 0.5), b + 0.03, 0.2)
        if i < 3: add(mix, whoosh(0.22, 5 + i), b + 0.82, 0.55, pan=0.5 if i % 2 else -0.5)
    for k in range(10):                                                  # 92% 숫자 올라가는 소리
        add(mix, pluck(1800 + k * 60, 0.05), 5.08 + k * 0.047, 0.12)
    add(mix, whoosh(0.3, 9), 7.8, 0.5)
    add(mix, riser(1.0, 300, 3000), 10.5, 0.5)                          # 로고 전 상승
    add(mix, impact(2.5), 11.5, 1.0)
    add(mix, bell(note("E6"), 2.5), 12.7, 0.25)                          # 로고 반짝
    add(mix, pluck(note("A5"), 0.4), 13.0, 0.25)                         # 댓글 버튼
    add(mix, whoosh(0.8, 11) * 0.6, 14.25, 0.5, pan=0.4)                 # 커튼 닫힘
    return master(mix, 0.02, 0.4)


# ---------------- 프리미엄형 (느린 피아노 + 현악 패드) ----------------
def premium():
    D = 20.0
    mix, music = buf(D), buf(D)
    prog = [(0.0, ["D3", "F#3", "A3", "C#4"]), (4.0, ["B2", "D3", "F#3", "A3"]), (8.0, ["G2", "B2", "D3", "F#3"]),
            (11.0, ["E3", "G3", "B3", "D4"]), (13.0, ["A2", "D3", "E3", "A3"]), (14.5, ["D3", "F#3", "A3", "E4"])]
    for i, (t0, ch) in enumerate(prog):
        t1 = prog[i + 1][0] if i + 1 < len(prog) else D
        add(music, pad([note(n) for n in ch], t1 - t0 + 1.2, 1.5, 1.5, 4), t0, 0.55)
        add(music, np.sin(2 * np.pi * note(ch[0]) / 2 * np.arange(int((t1 - t0 + 1) * SR)) / SR) * env(int((t1 - t0 + 1) * SR), 1.0, 3.0) * 0.5, t0, 0.35)
    # 피아노 아르페지오 (오프닝 뒤부터)
    mel = [(2.0, "A4"), (2.9, "F#4"), (3.8, "D5"), (4.7, "C#5"), (5.6, "B4"), (6.5, "F#4"), (7.4, "D5"),
           (8.3, "B4"), (9.2, "D5"), (10.1, "F#5"), (11.0, "E5"), (11.9, "B4"), (12.8, "G4"), (13.4, "A4"), (14.0, "C#5")]
    for t0, n in mel:
        add(music, pluck(note(n), 2.5, 0.6), t0, 0.3, pan=-0.2 if n < "C" else 0.2)
    # 로고: 화음 + 종소리
    for n in ["D4", "A4", "D5", "F#5"]:
        add(music, pluck(note(n), 4.0, 0.5), 14.8, 0.18)
    add(music, bell(note("A5"), 4.0), 14.85, 0.18)
    add(music, bell(note("D6"), 4.0), 16.6, 0.12)
    music = reverb(music, 3.2, 0.42)
    mix += music
    # 효과
    add(mix, sweep_noise(1.8, 2000, 9000, 7) * np.hanning(int(1.8 * SR)) * 0.25, 0.4, 0.5)   # 금색 선
    add(mix, riser(1.2, 200, 1200) * 0.6, 13.3, 0.4)
    add(mix, impact(3.0), 14.5, 0.75)
    add(mix, sweep_noise(1.2, 3000, 12000, 8) * np.hanning(int(1.2 * SR)) * 0.2, 16.6, 0.5)  # 로고 반짝
    return master(mix, 0.5, 1.2)


if __name__ == "__main__":
    which = sys.argv[1]
    write(f"{which}_audio.wav", viral() if which == "viral" else premium())
    print("ok", which)
