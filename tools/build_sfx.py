"""효과음 만들기: tools/sfx/sfx.json 매핑대로 원본 wav(사용자 제공 DeokDi_SFX_PROJECT.zip을 푼 폴더)에서
구간을 잘라 음량을 맞추고 public/sfx/<키>[_n].mp3 로 저장, src/app/sfx-manifest.json 을 쓴다.
사용: python3 tools/build_sfx.py <원본 폴더> [키 ...]"""
import json, subprocess, sys, os, glob
import numpy as np

SR = 44100
OUT = 'public/sfx'
MAN = 'src/app/sfx-manifest.json'


def find(root, sub):
    m = sorted(f for f in glob.glob(root + '/**/*.wav', recursive=True) if os.path.basename(f).startswith(sub) or sub in os.path.basename(f))
    if not m: raise SystemExit(f'원본 없음: {sub}')
    return m[0]


def load(f):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(r, np.float32).copy()


def shape(x, loop):
    if loop:
        F = int(SR * 1.2)  # 끝을 처음과 겹쳐 이음매 없이 돈다
        y = x[F:].copy(); t = np.linspace(0, np.pi / 2, F)
        y[-F:] = y[-F:] * np.cos(t) + x[:F] * np.sin(t)
        return y
    fi = int(SR * 0.003); fo = max(int(SR * 0.03), int(len(x) * 0.25))
    x[:fi] *= np.linspace(0, 1, fi)
    x[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    return x


def level(x, loop):
    a = np.abs(x); n = 1024; m = len(x) // n
    rms = np.sqrt((x[:m * n].reshape(m, n) ** 2).mean(1)) if m else np.array([np.sqrt((x ** 2).mean())])
    act = np.sort(rms)[-max(1, len(rms) // 3):].mean()  # 큰 부분 기준
    tgt = 10 ** ((-24 if loop else -16) / 20)
    g = tgt / max(act, 1e-6)
    g = min(g, 10 ** (-1 / 20) / max(a.max(), 1e-6))  # 최대치 -1dB
    return x * g


def enc(x, path, loop):
    raw = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '80k' if loop else '96k', path], input=raw, check=True)


if __name__ == '__main__':
    root = sys.argv[1]
    conf = json.load(open('tools/sfx/sfx.json'))
    man = json.load(open(MAN)) if os.path.exists(MAN) else {}
    keys = sys.argv[2:] or [k for k in conf if not k.startswith('_')]
    os.makedirs(OUT, exist_ok=True)
    cache = {}
    for k in keys:
        c = conf[k]; loop = bool(c.get('loop'))
        for old in glob.glob(f'{OUT}/{k}.mp3') + glob.glob(f'{OUT}/{k}_[0-9]*.mp3'): os.remove(old)
        for i, s in enumerate(c['src']):
            f = find(root, s['f'])
            if f not in cache: cache[f] = load(f)
            x = cache[f][int(s['a'] * SR):int((s['a'] + s['d']) * SR)].copy()
            x = level(shape(x, loop), loop)
            enc(x, f'{OUT}/{k}{"_" + str(i) if len(c["src"]) > 1 else ""}.mp3', loop)
        man[k] = {'n': len(c['src']), 'v': c['v'], **({'loop': True} if loop else {})}
        print(k, len(c['src']))
    json.dump(man, open(MAN, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('total', sum(os.path.getsize(f) for f in glob.glob(OUT + '/*.mp3')) // 1024, 'KB')
