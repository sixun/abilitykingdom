"""대원 동작 세트(대기·달리기·3타 공격·버프·스킬·피격) → 한 장짜리 아틀라스(webp) + 프레임 표(json).

원본: 단색(초록/파랑) 배경 위 캐릭터 영상(동작마다 한 개, 같은 첫 장면에서 시작). tools/motion/<kind>/*.mp4
설정: tools/motion/sets.json — 동작마다 영상 이름과 쓸 프레임 구간(24fps 기준 번호), 타격 프레임(imp).
  "idle": {"src": "idle.mp4", "loop": [30, 110, 14, 30]}  → 30~110 사이에서 처음과 끝이 가장 닮은 14~30프레임 구간을 찾아 고리로
  "atk1": {"src": "combo.mp4", "f": [8, 30], "n": 9, "imp": 15}  → 8~30에서 9장, 원본 15번째 프레임이 타격 순간
처리:
  - 색 차이 키잉 + 배경색 번짐 제거(despill)
  - 대기 첫 장면의 몸 높이를 TARGET_H로 맞추고, 발 위치를 모든 프레임의 기준점으로 쓴다(카메라 고정 영상)
  - 프레임마다 투명한 테두리를 잘라 내고 줄 단위로 빽빽하게 채운다(아틀라스 폭 2048)
사용: python3 tools/build_motion_sets.py [kind ...]"""
import json, subprocess, sys, os, glob
import numpy as np
from PIL import Image

ROOT = 'tools/motion'
OUT = 'public/ref/battle'
DATA = 'src/game/data/motion-sets.json'
TARGET_H = 230  # 아틀라스 안 몸 높이(px)
ATLAS_W = 2048
CACHE = '/tmp/claude-0/mframes'


def frames(path):
    d = f'{CACHE}/{path.replace("/", "_")}'
    if not os.path.isdir(d) or not glob.glob(f'{d}/*.png'):
        os.makedirs(d, exist_ok=True)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', path, '-vf', 'fps=24', f'{d}/%04d.png'], check=True)
    return sorted(glob.glob(f'{d}/*.png'))


def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)


def key(fr, ch, bg, lo=28, span=110):
    i = 1 if ch == 'g' else 2
    o = [c for c in range(3) if c != i]
    diff = fr[..., i] - np.maximum(fr[..., o[0]], fr[..., o[1]])
    a = 1 - np.clip((diff - lo) / span, 0, 1)
    A = np.maximum(a, 0.05)[..., None]
    out = (fr - (1 - A) * bg) / A
    out[..., i] = np.minimum(out[..., i], np.maximum(out[..., o[0]], out[..., o[1]]) + 8)  # 남은 배경색 번짐
    a = np.where(a < 0.06, 0, a)
    return np.dstack([np.clip(out, 0, 255), a * 255])


def bg_of(fr):
    return np.median(np.concatenate([fr[:12, :12].reshape(-1, 3), fr[:12, -12:].reshape(-1, 3), fr[-12:, :12].reshape(-1, 3), fr[-12:, -12:].reshape(-1, 3)]), 0)


def body(alpha):
    ys, xs = np.nonzero(alpha > 128)
    h = ys.max() - ys.min()
    low = alpha[int(ys.max() - h * 0.12):ys.max() + 1] > 128
    fx = np.nonzero(low.any(0))[0]
    return h, (fx.min() + fx.max()) / 2, ys.max()


def best_loop(files, ch, a, b, mn, mx):
    """a~b 안에서 길이 mn~mx, 첫 프레임과 (끝+1) 프레임이 가장 닮은 구간"""
    small = []
    for f in files[a:b + 1]:
        im = Image.open(f).convert('RGB').resize((160, 160))
        small.append(np.asarray(im).astype(np.float32))
    best = (1e18, a, a + mn)
    for i in range(0, len(small)):
        for L in range(mn, mx + 1):
            j = i + L
            if j >= len(small): break
            d = np.abs(small[i] - small[j]).mean()
            if d < best[0]: best = (d, a + i, a + j)
    return best[1], best[2]  # [i, j) 구간


def build(kind, cfg):
    src = f'{ROOT}/{kind}'
    ch = cfg['ch']
    clips_cfg = cfg['clips']
    # 기준: 대기 영상 첫 장면
    idle_files = frames(f'{src}/{clips_cfg["idle"]["src"]}')
    f0 = load(idle_files[0]); bg = bg_of(f0)
    k0 = key(f0, ch, bg)
    bh, bx, by = body(k0[..., 3])
    sc = cfg.get('height', TARGET_H) / bh
    print(kind, 'body', bh, 'scale', round(sc, 3))
    picked = []  # (clip, [frames rgba scaled], imp_local)
    for name, c in clips_cfg.items():
        files = frames(f'{src}/{c["src"]}')
        bgc = bg_of(load(files[0]))
        if 'loop' in c:
            a, b, mn, mx = c['loop']
            i, j = best_loop(files, ch, a, min(b, len(files) - 1), mn, mx)
            n = c.get('n', j - i)
            idx = [round(i + (j - i) * q / n) for q in range(n)]
        elif 'idx' in c:
            idx = c['idx']
        else:
            a, b = c['f']; n = c.get('n', b - a + 1)
            idx = [round(a + (b - a) * q / max(1, n - 1)) for q in range(n)]
        idx = [min(len(files) - 1, max(0, x)) for x in idx]
        imp = None
        if 'imp' in c: imp = int(np.argmin([abs(x - c['imp']) for x in idx]))
        fs = []
        for x in idx:
            k = key(load(files[x]), ch, bgc)
            fs.append(k)
        picked.append((name, fs, imp, c.get('fps', 12), 'loop' in c))
        print(' ', name, 'frames', idx[0], '..', idx[-1], 'n', len(idx), 'imp', imp)
    # 잘라 내고 줄 단위로 채우기
    rects = []; tiles = []
    for name, fs, imp, fps, lp in picked:
        for k in fs:
            im = Image.fromarray(k.astype(np.uint8), 'RGBA')
            W0, H0 = im.size
            im = im.resize((round(W0 * sc), round(H0 * sc)), Image.LANCZOS)
            al = np.asarray(im)[..., 3]
            ys, xs = np.nonzero(al > 6)
            if len(xs) == 0: xs = np.array([0]); ys = np.array([0])
            x0, y0, x1, y1 = max(0, xs.min() - 2), max(0, ys.min() - 2), min(im.width, xs.max() + 3), min(im.height, ys.max() + 3)
            tiles.append(im.crop((x0, y0, x1, y1)))
            rects.append((bx * sc - x0, by * sc - y0))
    order = sorted(range(len(tiles)), key=lambda i: -tiles[i].height)
    pos = [None] * len(tiles); x = y = rowh = 0
    for i in order:
        t = tiles[i]
        if x + t.width > ATLAS_W: x = 0; y += rowh + 2; rowh = 0
        pos[i] = (x, y); x += t.width + 2; rowh = max(rowh, t.height)
    H = y + rowh
    atlas = Image.new('RGBA', (ATLAS_W, H), (0, 0, 0, 0))
    fr = []
    for i, t in enumerate(tiles):
        atlas.paste(t, pos[i])
        fr.append([pos[i][0], pos[i][1], t.width, t.height, round(rects[i][0], 1), round(rects[i][1], 1)])
    clips = {}; s = 0
    for name, fs, imp, fps, lp in picked:
        d = {'s': s, 'n': len(fs), 'fps': fps}
        if imp is not None: d['imp'] = imp
        if lp: d['loop'] = True
        clips[name] = d; s += len(fs)
    os.makedirs(OUT, exist_ok=True)
    out = f'{OUT}/m-{kind}.webp'
    atlas.save(out, quality=88, method=6)
    print(' atlas', ATLAS_W, H, len(fr), 'frames', os.path.getsize(out) // 1024, 'KB')
    disp = cfg.get('disp', 190)  # 화면에서 몸 높이(원근 1배 기준, px)
    return {'file': f'ref/battle/m-{kind}.webp', 'W': ATLAS_W, 'H': H, 's': round(disp / cfg.get('height', TARGET_H), 4), 'fr': fr, 'clips': clips}


if __name__ == '__main__':
    conf = json.load(open(f'{ROOT}/sets.json'))
    data = json.load(open(DATA)) if os.path.exists(DATA) else {}
    kinds = sys.argv[1:] or list(conf.keys())
    for k in kinds: data[k] = build(k, conf[k])
    json.dump(data, open(DATA, 'w'), ensure_ascii=False, separators=(',', ':'))
