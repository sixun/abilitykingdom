"""아카데미 맵 2개(정문 진입로 · 수업동 연결 복도) → 스토리 탐색용 자료.

원본: 사용자 제공 ability_kingdom_academy_maps_8_and_plan.zip — 맵당 겹치는 카메라 화면 4장(maps/gate, maps/hall)을
그 안의 map_manifest.json 좌표로 복원한 1672×941 배경(reconstruct_maps.py, 겹침 픽셀 일치 검사 통과).
이 폴더(tools/explore/maps8)에 둔 것:
  <맵>.png          복원 배경(원본 그대로, 1672×941)
  <맵>_up.webp      AI 4배 업스케일(aura-sr) — 비교용. 게임은 원본을 그대로 2배(3344×1882)로 키워 쓴다
  <맵>_seg.jpg      바닥 분할(nano-banana-pro 4K, 흰색 = 서 있을 수 있는 바닥, 검정 = 그 밖의 물체)
  <맵>_overrides.json  손보정 다각형(원본 1672 좌표): walk = 걷기로 강제, block = 막기, nowalk = 바닥이지만 못 들어감(차도 등)
출력(public/explore/<맵>): w_<열>_<행>.webp, low.webp, aux.png, anim.webp — 형식은 tools/build_explore_world.py 와 같다
  aux: R·G = 물체가 바닥에 닿는 y(1/4 단위, 가림용), B = 255 걷기 / 128 바닥이지만 못 걷는 곳 / 0 물체
사용: python3 tools/build_explore_maps8.py [academy_gate academy_hall]
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SRC = 'tools/explore/maps8'
S = 2   # 게임 월드 = 원본 1672 × 2
T = 2048
Q = 4   # aux 는 월드의 1/4


def poly_mask(polys, w, h, k):
    im = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(im)
    for pg in polys:
        d.polygon([(x * k, y * k) for x, y in pg], fill=255)
    return np.asarray(im) > 0


def build(zone):
    out = f'public/explore/{zone}'
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        os.remove(f'{out}/{f}')
    src = Image.open(f'{SRC}/{zone}.png').convert('RGB')
    W, H = src.width * S, src.height * S
    # 원본 픽셀을 그대로 2배(기획: 제공 이미지의 재질·조명·색 유지). AI 업스케일(<맵>_up.webp)은 비교용으로만 둔다
    up = src.resize((W, H), Image.LANCZOS)
    cols, rows = -(-W // T), -(-H // T)
    for r in range(rows):
        for c in range(cols):
            up.crop((c * T, r * T, min(W, (c + 1) * T), min(H, (r + 1) * T))).save(f'{out}/w_{c}_{r}.webp', quality=86, method=6)
    up.resize((W // 8, H // 8), Image.LANCZOS).save(f'{out}/low.webp', quality=84, method=6)

    qw, qh = W // Q, H // Q
    k = S / Q  # 원본 좌표 → 1/4 칸
    seg = np.asarray(Image.open(f'{SRC}/{zone}_seg.jpg').convert('L').resize((qw, qh), Image.BILINEAR)) > 128
    ov = json.load(open(f'{SRC}/{zone}_overrides.json'))
    force_walk = poly_mask(ov.get('walk', []), qw, qh, k)
    block = poly_mask(ov.get('block', []), qw, qh, k)
    nowalk = poly_mask(ov.get('nowalk', []), qw, qh, k)
    floor = ndimage.binary_opening(seg, iterations=1) | force_walk
    floor &= ~block
    # 분할 잡티(작은 바닥 조각·작은 구멍) 정리
    lab, n = ndimage.label(floor)
    sizes = ndimage.sum(floor, lab, range(1, n + 1))
    floor = np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v >= 40]) | force_walk
    holes = ~floor
    lab2, n2 = ndimage.label(holes)
    s2 = ndimage.sum(holes, lab2, range(1, n2 + 1))
    for i, v in enumerate(s2):
        if v < 4:
            floor[lab2 == i + 1] = True
    floor &= ~block
    walk = floor & ~nowalk
    obj = ~floor
    base = np.zeros((qh, qw), np.int32)
    for x in range(qw):
        col = obj[:, x]; y = 0
        while y < qh:
            if col[y]:
                y1 = y
                while y1 < qh and col[y1]:
                    y1 += 1
                base[y:y1, x] = y1 - 1; y = y1
            else:
                y += 1
    walk_e = ndimage.binary_erosion(walk, iterations=2)  # 발이 벽·물체에 붙지 않게
    aux = np.zeros((qh, qw, 4), np.uint8)
    aux[..., 0] = base >> 8; aux[..., 1] = base & 255
    aux[..., 2] = np.where(walk_e, 255, np.where(floor, 128, 0)); aux[..., 3] = 255
    Image.fromarray(aux, 'RGBA').save(f'{out}/aux.png', optimize=True)
    Image.new('RGB', (qw, qh), (0, 0, 0)).save(f'{out}/anim.webp', quality=90)  # 흔들림·물 없음(배경을 일렁이지 않는다)

    # 확인용 그림: 걷기(초록)·바닥이지만 못 감(노랑)·물체(그대로)
    view = np.asarray(src.resize((qw, qh), Image.BILINEAR)).astype(np.float32)
    tint = view.copy()
    tint[walk_e] = view[walk_e] * 0.45 + np.array([40, 230, 120]) * 0.55
    nf = floor & ~walk_e
    tint[nf] = view[nf] * 0.45 + np.array([250, 220, 40]) * 0.55
    Image.fromarray(tint.astype(np.uint8)).resize((src.width, src.height), Image.NEAREST).save(f'{SRC}/{zone}_walk_check.png')

    meta = {'W': W, 'H': H, 'tile': T, 'cols': cols, 'rows': rows, 'fg': [], 'fgRects': {}}
    DATA = 'src/game/data/explore-world.json'
    all_ = json.load(open(DATA))
    all_[zone] = meta
    json.dump(all_, open(DATA, 'w'))
    lab3, n3 = ndimage.label(walk_e)
    sz = sorted(ndimage.sum(walk_e, lab3, range(1, n3 + 1)), reverse=True)
    print(zone, meta['W'], meta['H'], 'walk', round(walk_e.mean(), 3), 'islands', [int(v) for v in sz[:5]])
    print({f: os.path.getsize(f'{out}/{f}') // 1024 for f in sorted(os.listdir(out))})


if __name__ == '__main__':
    for z in (sys.argv[1:] or ['academy_gate', 'academy_hall']):
        build(z)
