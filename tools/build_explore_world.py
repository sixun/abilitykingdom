"""탐색 월드 → 게임용 자료(조각 스트리밍용).

입력: tools/explore/world/world.png(월드 전체 그림) + tools/explore/world/seg.jpg(분할 그림, 3:2로 덧댄 월드를 칠한 것)
  분할 색: 흰색=걸을 수 있는 바닥, 빨강=나뭇잎·꽃·수풀(바람에 흔들림), 파랑=물(흐름), 노랑=천·깃발(펄럭임), 검정=그 밖의 물체
출력(public/explore/<zone>):
  w_<열>_<행>.webp  2048 조각(카메라 근처만 받아 그린다)
  low.webp          1/8 크기 전체(미니맵)
  aux.png           1/4 크기: R·G = 물체가 땅에 닿는 y(1/4 단위), B = 255 걷기 가능 / 0 물체, A=255 (가림·충돌용, 필터 없이 읽음)
  anim.webp         1/4 크기: R 나뭇잎, G 물, B 천 — 부드럽게 흐린 움직임 가중치
사용: python3 tools/build_explore_world.py academy"""
import os, sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None
zone = sys.argv[1]
D = 'tools/explore/world'
OUT = f'public/explore/{zone}'
T = 2048
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(f'{OUT}/{f}')

w = Image.open(f'{D}/world.png' if os.path.exists(f'{D}/world.png') else f'{D}/world_src.jpg').convert('RGB')  # world.png는 작업용(저장소 밖)
W, H = w.size
cols, rows = -(-W // T), -(-H // T)
for r in range(rows):
    for c in range(cols):
        w.crop((c * T, r * T, min(W, (c + 1) * T), min(H, (r + 1) * T))).save(f'{OUT}/w_{c}_{r}.webp', quality=84, method=6)
w.resize((W // 8, H // 8), Image.LANCZOS).save(f'{OUT}/low.webp', quality=84, method=6)

# 분할: 3:2로 덧댄 월드에 칠한 그림 → 월드 크기로 되돌리기
PH = round(W / 1.5)
seg = Image.open(f'{D}/seg.jpg').convert('RGB').resize((W // 4, PH // 4), Image.BILINEAR)
s = np.asarray(seg).astype(np.int32)[: H // 4]
qh, qw = s.shape[:2]
R, G, B = s[..., 0], s[..., 1], s[..., 2]
white = (R > 170) & (G > 170) & (B > 170)
red = (R > 150) & (G < 110) & (B < 110)
blue = (B > 150) & (R < 110) & (G < 160)
yellow = (R > 170) & (G > 150) & (B < 100)

# 손보정: 계단처럼 분할이 줄무늬로 나오는 곳
from PIL import ImageDraw
ov = json.load(open(f'{D}/overrides.json'))
def poly_mask(polys):
    im = Image.new('L', (qw, qh), 0); d = ImageDraw.Draw(im)
    for pg in polys: d.polygon([(x / 4, y / 4) for x, y in pg], fill=255)
    return np.asarray(im) > 0
force_walk, force_block = poly_mask(ov['walk']), poly_mask(ov['block'])
white = white | force_walk
walk = ndimage.binary_opening(white, iterations=1)
walk = ndimage.binary_closing(walk, iterations=2)
lab, n = ndimage.label(walk)
sizes = ndimage.sum(walk, lab, range(1, n + 1))
walk = np.isin(lab, [i + 1 for i, v in enumerate(sizes) if v > sizes.max() * 0.01])
walk = (walk | force_walk) & ~force_block
obj = ~walk
lab2, n2 = ndimage.label(obj)
s2 = ndimage.sum(obj, lab2, range(1, n2 + 1))
for i, v in enumerate(s2):
    if v < 15: walk[lab2 == i + 1] = True
obj = ~walk
base = np.zeros((qh, qw), np.int32)
for x in range(qw):
    col = obj[:, x]; y = 0
    while y < qh:
        if col[y]:
            y1 = y
            while y1 < qh and col[y1]: y1 += 1
            base[y:y1, x] = y1 - 1; y = y1
        else: y += 1
walk_e = ndimage.binary_erosion(walk, iterations=2)  # 발이 벽에 붙지 않게
aux = np.zeros((qh, qw, 4), np.uint8)
aux[..., 0] = base >> 8; aux[..., 1] = base & 255; aux[..., 2] = np.where(walk_e, 255, np.where(walk, 128, 0)); aux[..., 3] = 255
Image.fromarray(aux, 'RGBA').save(f'{OUT}/aux.png', optimize=True)

def soft(m, r):
    return np.clip(ndimage.gaussian_filter(m.astype(np.float32), r) * 1.6, 0, 1)
anim = np.dstack([soft(red, 1.5), soft(blue, 1.2), soft(yellow, 1.2)])
Image.fromarray((anim * 255).astype(np.uint8)).save(f'{OUT}/anim.webp', quality=90)

meta = {'W': W, 'H': H, 'tile': T, 'cols': cols, 'rows': rows}
DATA = 'src/game/data/explore-world.json'
all_ = json.load(open(DATA)) if os.path.exists(DATA) else {}
all_[zone] = meta
json.dump(all_, open(DATA, 'w'))
print(zone, meta, 'walk', round(walk.mean(), 3), 'leaf', round(red.mean(), 3), 'water', round(blue.mean(), 4), 'cloth', round(yellow.mean(), 4))
print({f: os.path.getsize(f'{OUT}/{f}') // 1024 for f in sorted(os.listdir(OUT))})
