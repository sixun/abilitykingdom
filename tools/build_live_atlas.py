"""로비 버튼 '장면 움직임'용 그림 묶음(아틀라스) 만들기.

원본 조각(1배, public/ref/station/matte)을 AI로 4배 키운 그림(tools/liveicons/<이름>_up.png, Creative Claw aura-sr)을
3배 크기로 맞춘 뒤, 한 파일에 위에서 아래로 쌓는다(게임 페이지 파일 수 제한 때문에 버튼당 1파일).
  0: base  — 원본 그대로(선명한 판)
  1: plate — 움직일 부위를 지우고 주변 배경으로 메운 판(부위가 움직여도 단색 네모가 비치지 않게)
  2..: 부위 — 원본에서 그 부위만 남긴 판(가장자리 부드럽게)
결과: public/ui/live/<키>.webp, src/game/data/live-atlas.json(프레임 순서·부위 상자·색).
화면 쪽: src/ui/live/LiveIcon.tsx + scenes.ts
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools/liveicons'
OUT_IMG = ROOT / 'public/ui/live'
OUT_META = ROOT / 'src/game/data/live-atlas.json'
S = 3  # 화면 1배 좌표 대비 그림 배율
ST = ROOT / 'public/ref/station/matte'

# 부위: rect(1배), crit, seed, holes, grow(1배 px), poly(1배 다각형으로 자름), minus(다른 부위 빼기)
SPECS = {
    'notice': dict(matte='notice-nobadge', up='notice', mirror_bell=True, extra_fill=[(40, 6, 24, 24)], parts={
        'bell': dict(rect=(18, 9, 40, 37), crit='bright', holes=True, grow=1.0),
        'clapper': dict(rect=(28, 45, 20, 10), crit='bright', holes=True, grow=1.0),
    }),
    'mail': dict(matte='mail', up='mail', parts={
        'env': dict(rect=(6, 13, 44, 38), crit='bright', holes=True, grow=1.3),
        # 뚜껑: 봉투 윗변과 V자 홈 사이 삼각형(홈 포함)
        'flap': dict(rect=(6, 13, 44, 38), crit='bright', holes=True, grow=1.3, poly=[(7, 16), (49, 16), (49, 21), (28.5, 39.5), (7, 21)]),
    }),
    'exploration': dict(matte='exploration-nobadge', up='exploration', parts={
        'pin': dict(rect=(44, 46, 52, 68), crit='dark', holes=True, grow=1.2, seed=(69, 60)),
        'c0': dict(rect=(16, 46, 16, 16), crit='dark', grow=0.8),
        'c1': dict(rect=(104, 46, 18, 16), crit='dark', grow=0.8),
        'c2': dict(rect=(16, 120, 16, 18), crit='dark', grow=0.8),
        'c3': dict(rect=(102, 122, 18, 18), crit='dark', grow=0.8),
    }),
    'wanted': dict(matte='wanted', up='wanted', parts={
        'scope': dict(rect=(10, 18, 58, 58), crit='blue', grow=1.2),
    }),
}


def hsv(rgb):
    h = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    return h[..., 0] * 2, h[..., 1] / 255, h[..., 2] / 255


def crit_mask(rgb, a, crit):
    h, s, v = hsv(rgb)
    lum = rgb.astype(np.float32) @ np.array([0.299, 0.587, 0.114])
    vis = a > 60
    return {
        'bright': vis & (lum > 140) & (s < 0.3),
        'dark': vis & (lum < 110),
        'blue': vis & (h > 185) & (h < 245) & (s > 0.35) & (v > 0.35),
    }[crit]


def part_mask(rgb, a, p):
    H, W = a.shape
    x, y, w, h = [int(round(q * S)) for q in p['rect']]
    m = crit_mask(rgb, a, p['crit'])
    box = np.zeros_like(m); box[y:y + h, x:x + w] = True
    m &= box
    if p.get('seed'):
        lab, _ = ndimage.label(m)
        sx, sy = int(p['seed'][0] * S), int(p['seed'][1] * S)
        k = lab[sy, sx]
        if k == 0:
            ys, xs = np.nonzero(lab); j = np.argmin((xs - sx) ** 2 + (ys - sy) ** 2); k = lab[ys[j], xs[j]]
        m = lab == k
    if p.get('holes'):
        m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        m = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= 30])
    g = int(round(p.get('grow', 1) * S))
    if g:
        m = ndimage.binary_dilation(m, iterations=g)
    if p.get('poly'):
        pm = np.zeros((H, W), np.uint8)
        cv2.fillPoly(pm, [np.array([(int(px * S), int(py * S)) for px, py in p['poly']], np.int32)], 1)
        m &= pm.astype(bool)
    return m


def soft(m, sigma=0.9):
    return np.clip(ndimage.gaussian_filter(m.astype(np.float32), sigma) * 1.15, 0, 1)


def build(key, spec):
    matte = np.array(Image.open(ST / f"{spec['matte']}.webp").convert('RGBA'))
    h1, w1 = matte.shape[:2]
    W, H = w1 * S, h1 * S
    up = np.array(Image.open(SRC / f"{spec['up']}_up.png").convert('RGB').resize((W, H), Image.LANCZOS))
    a = np.array(Image.fromarray(matte[..., 3]).resize((W, H), Image.BICUBIC))
    rgb = up.copy()
    masks = {name: part_mask(rgb, a, p) for name, p in spec['parts'].items()}

    if spec.get('mirror_bell'):
        # 공지 종: 알림 점을 지운 자리(오른쪽 위)가 뭉개져 있어 → 종은 좌우 대칭이니 왼쪽 반을 뒤집어 오른쪽을 다시 만든다
        cm = masks['clapper']
        ys, xs = np.nonzero(cm)
        cx = (xs.min() + xs.max()) / 2
        bm = masks['bell']
        ys, xs = np.nonzero(bm)
        y0, y1 = ys.min(), ys.max()
        for yy in range(y0, y1 + 1):
            for xx in range(int(np.ceil(cx)), W):
                mx = int(round(2 * cx - xx))
                if 0 <= mx < W:
                    rgb[yy, xx] = rgb[yy, mx]
                    bm[yy, xx] = bm[yy, mx]
        masks['bell'] = bm

    union = np.zeros((H, W), bool)
    for m in masks.values():
        union |= m
    fill = union.copy()
    for (x, y, w, h) in spec.get('extra_fill', []):
        fill[int(y * S):int((y + h) * S), int(x * S):int((x + w) * S)] = True
    fill_d = ndimage.binary_dilation(fill, iterations=S * 2)
    # 판: 부위를 지운 자리를 주변 배경으로 메운다
    plate = cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), fill_d.astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA)
    plate = cv2.cvtColor(plate, cv2.COLOR_BGR2RGB)
    # 원본 판(base)은 공지만 대칭 복원본, 나머지는 그대로. 단, 지정한 뭉개진 자리(extra_fill)는 판의 메움으로 덮는다
    base_rgb = rgb.copy()
    if spec.get('extra_fill'):
        ef = np.zeros((H, W), bool)
        for (x, y, w, h) in spec['extra_fill']:
            ef[int(y * S):int((y + h) * S), int(x * S):int((x + w) * S)] = True
        ef &= ~ndimage.binary_dilation(union, iterations=1)
        base_rgb[ef] = plate[ef]
    frames = [np.dstack([base_rgb, a]), np.dstack([plate, a])]
    boxes, colors = {}, {}
    for name, m in masks.items():
        alpha = (soft(m) * a).astype(np.uint8)
        frames.append(np.dstack([base_rgb, alpha]))
        ys, xs = np.nonzero(m)
        boxes[name] = [round(xs.min() / S, 2), round(ys.min() / S, 2), round((xs.max() - xs.min() + 1) / S, 2), round((ys.max() - ys.min() + 1) / S, 2)]
        core = ndimage.binary_erosion(m, iterations=S)
        px = base_rgb[core] if core.any() else base_rgb[m]
        colors[name] = [int(v) for v in np.median(px, axis=0)]
    atlas = np.concatenate(frames, axis=0)
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas, 'RGBA').save(OUT_IMG / f'{key}.webp', quality=90, method=6)
    print(key, atlas.shape, (OUT_IMG / f'{key}.webp').stat().st_size // 1024, 'KB', boxes)
    return {'src': f'ui/live/{key}.webp', 'w': w1, 'h': h1, 's': S, 'frames': ['base', 'plate', *masks.keys()], 'boxes': boxes, 'colors': colors}


def main():
    meta = {k: build(k, v) for k, v in SPECS.items()}
    OUT_META.write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')))
    print('wrote', OUT_META.relative_to(ROOT))


if __name__ == '__main__':
    main()
