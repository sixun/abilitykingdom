"""전투 테스트 스프라이트: 크로마키 영상(초록 배경 적 대기 / 파란 배경 리온 공격, 640×640·24fps·4초) → 12fps 프레임 시트(webp).
색 차이 키잉: 배경색 성분이 나머지보다 큰 만큼 투명. 배경색 번짐 제거(despill).
사용: python3 tools/build_battle_sprites.py <폴더(v1.mp4=적, v2.mp4=리온)>"""
import json, subprocess, sys, os, glob
import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT = 'public/ref/battle'
meta = {}


def frames(video, fps=12):
    d = f'/tmp/claude-0/bframes/{os.path.basename(video)}'
    os.makedirs(d, exist_ok=True)
    for f in glob.glob(f'{d}/*.png'): os.remove(f)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', video, '-vf', f'fps={fps}', f'{d}/%03d.png'], check=True)
    return [np.asarray(Image.open(f).convert('RGB')).astype(np.float32) for f in sorted(glob.glob(f'{d}/*.png'))]


def key(fr, ch, bg, k=2.4, lo=18):
    r, g, b = fr[..., 0], fr[..., 1], fr[..., 2]
    if ch == 'g': diff = g - np.maximum(r, b)
    else: diff = b - np.maximum(r, g)
    a = 1 - np.clip((diff - lo) / (255 / k), 0, 1)
    # 배경색 섞임 풀기: C = a·F + (1-a)·BG  →  F = (C - (1-a)·BG) / a  (빛 번짐이 회색 안개로 남지 않게)
    A = np.maximum(a, 0.04)[..., None]
    out = (fr - (1 - A) * bg) / A
    i = 1 if ch == 'g' else 2
    o = [c for c in range(3) if c != i]
    out[..., i] = np.minimum(out[..., i], np.maximum(out[..., o[0]], out[..., o[1]]) + 10)  # 남은 배경색 번짐
    return np.dstack([np.clip(out, 0, 255), a * 255]).astype(np.uint8)


def sheet(name, fs, ch, scale, cols=8):
    bg = np.median(np.concatenate([fs[0][:8, :8].reshape(-1, 3), fs[0][:8, -8:].reshape(-1, 3)]), 0)
    fs = fs[:48]
    ks = [key(f, ch, bg) for f in fs]
    A = np.max([k[..., 3] for k in ks], axis=0)
    ys, xs = np.nonzero(A > 20)
    x0, y0, x1, y1 = max(0, xs.min() - 4), max(0, ys.min() - 4), min(640, xs.max() + 5), min(640, ys.max() + 5)
    w, h = round((x1 - x0) * scale), round((y1 - y0) * scale)
    rows = (len(ks) + cols - 1) // cols
    sh = Image.new('RGBA', (w * cols, h * rows), (0, 0, 0, 0))
    # 프레임 가장자리에서 잘린 빛 번짐이 네모로 보이지 않게: 테두리 쪽으로 투명해지는 경사 + 아주 옅은 안개는 지움
    H0, W0 = y1 - y0, x1 - x0
    ry = np.clip(np.minimum(np.arange(H0), H0 - 1 - np.arange(H0)) / 40, 0, 1)
    rx = np.clip(np.minimum(np.arange(W0), W0 - 1 - np.arange(W0)) / 40, 0, 1)
    ramp = np.minimum(ry[:, None], rx[None, :])
    for k in ks:
        al = k[y0:y1, x0:x1, 3].astype(np.float32) / 255
        al = np.clip((al - 0.1) / 0.9, 0, 1) * ramp
        k[y0:y1, x0:x1, 3] = (al * 255).astype(np.uint8)
    for i, k in enumerate(ks):
        sh.paste(Image.fromarray(k[y0:y1, x0:x1], 'RGBA').resize((w, h), Image.LANCZOS), ((i % cols) * w, (i // cols) * h))
    sh.save(f'{OUT}/{name}.webp', quality=86)
    meta[name] = {'file': f'ref/battle/{name}.webp', 'w': w, 'h': h, 'cols': cols, 'n': len(ks), 'fps': 12,
                  'crop': [int(x0), int(y0), int(x1), int(y1)], 'scale': scale}
    print(name, w, h, len(ks), os.path.getsize(f'{OUT}/{name}.webp'))


sheet('hound', frames(f'{SRC}/v1.mp4'), 'g', 0.42)
sheet('rion', frames(f'{SRC}/v2.mp4'), 'b', 0.48)
json.dump(meta, open('src/game/data/battle-sprites.json', 'w'), indent=1)

# ── 배경판·캐릭터·적 그림(이미지 모델로 만든 것) · 카드 얼굴/스킬 아이콘(시안에서) ──
import cv2
pl = Image.open(f'{SRC}/plate.jpg').convert('RGB').resize((1920, 1080), Image.LANCZOS)
pl.save(f'{OUT}/plate.webp', quality=86)
meta['plate'] = 'ref/battle/plate.webp'
for n, hgt in (('ian', 380), ('seren', 330), ('kanna', 330), ('golem', 420), ('orb', 220)):
    im = Image.open(f'{SRC}/{n}.png').convert('RGBA'); im = im.crop(im.getbbox())
    im = im.resize((round(im.width * hgt / im.height), hgt), Image.LANCZOS)
    im.save(f'{OUT}/{n}.webp', quality=90)
    meta[n] = {'file': f'ref/battle/{n}.webp', 'w': im.width, 'h': im.height}
mock = cv2.imread(f'{SRC}/mock.png')
CARD = {'rion': 40, 'seren': 355, 'ian': 650, 'kanna': 955}
ICO = {'rion': 0, 'seren': 3, 'ian': 3, 'kanna': 3}
for k, x in CARD.items():
    p = mock[600:680, x + 9:x + 107]
    Image.fromarray(cv2.cvtColor(p, cv2.COLOR_BGR2RGB)).resize((196, 160), Image.LANCZOS).save(f'{OUT}/face-{k}.webp', quality=90)
    ix = x + 213 + ICO[k]
    ic = mock[601:662, ix:ix + 59].copy()
    hole = np.zeros(ic.shape[:2], np.uint8); hole[36:, 34:] = 255  # 숫자 칸(화면에서 실제 값으로)
    ic = cv2.inpaint(ic, hole, 6, cv2.INPAINT_TELEA)
    Image.fromarray(cv2.cvtColor(ic, cv2.COLOR_BGR2RGB)).resize((118, 122), Image.LANCZOS).save(f'{OUT}/skill-{k}.webp', quality=90)
json.dump(meta, open('src/game/data/battle-sprites.json', 'w'), indent=1)
print('ok')
