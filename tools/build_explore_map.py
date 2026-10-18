"""탐색 구역 지도 → 게임용 자료.

입력(tools/explore/src): <zone>_a.jpg(그림, 큰 해상도) + <zone>_walk.jpg(걷기 영역: 흰색=걸을 수 있는 바닥)
출력(public/explore/<zone>):
  t0~t3.webp  그림을 2×2로 나눈 조각(모바일 텍스처 크기 한도 4096 안쪽)
  low.webp    1/4 크기 전체(낮은 품질 설정·미니맵)
  walk.png    걷기 영역 1/4 크기(흰색=걷기 가능). 가장자리를 조금 깎아 발이 벽에 붙지 않게
  occ.png     가림 지도 1/2 크기: 바닥이 아닌 곳(물체)마다 '그 물체가 땅에 닿는 y'(세로 줄 단위 아래끝)를
              R(상위)·G(하위) 바이트로 적고 A=255. 캐릭터 발 y보다 아래에 닿는 물체가 캐릭터를 가린다
사용: python3 tools/build_explore_map.py academy"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

zone = sys.argv[1]
SRC = 'tools/explore/src'
OUT = f'public/explore/{zone}'
os.makedirs(OUT, exist_ok=True)

img = Image.open(f'{SRC}/{zone}_a.jpg').convert('RGB')
W, H = img.size
hw, hh = W // 2, H // 2
for i, (x, y) in enumerate([(0, 0), (hw, 0), (0, hh), (hw, hh)]):
    img.crop((x, y, x + hw, y + hh)).save(f'{OUT}/t{i}.webp', quality=86, method=6)
img.resize((W // 4, H // 4), Image.LANCZOS).save(f'{OUT}/low.webp', quality=86, method=6)

m = np.asarray(Image.open(f'{SRC}/{zone}_walk.jpg').convert('L').resize((hw, hh), Image.BILINEAR)) > 128
m = ndimage.binary_opening(m, iterations=3)   # 난간 윗면·잎 같은 가는 오검출 제거
m = ndimage.binary_closing(m, iterations=4)   # 바닥 틈 메우기
lab, n = ndimage.label(m)
sizes = ndimage.sum(m, lab, range(1, n + 1))
keep = [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.04]
walk = np.isin(lab, keep)
walk = ndimage.binary_fill_holes(walk) & ~ndimage.binary_fill_holes(~walk) | walk  # 바닥 안쪽 작은 구멍 채움
# 바닥 안 작은 섬(벤치 다리 그림자 등 오검출)은 물체로 두되, 아주 작은 물체 조각은 바닥으로
obj = ~walk
lab2, n2 = ndimage.label(obj)
s2 = ndimage.sum(obj, lab2, range(1, n2 + 1))
for i, s in enumerate(s2):
    if s < 60: walk[lab2 == i + 1] = True
obj = ~walk

# 가림 지도: 세로 줄마다 물체 덩어리의 아래끝 y
base = np.zeros((hh, hw), np.int32)
for x in range(hw):
    col = obj[:, x]
    y = 0
    while y < hh:
        if col[y]:
            y1 = y
            while y1 < hh and col[y1]: y1 += 1
            base[y:y1, x] = y1 - 1
            y = y1
        else:
            y += 1
occ = np.zeros((hh, hw, 4), np.uint8)
occ[..., 0] = base >> 8; occ[..., 1] = base & 255; occ[..., 3] = obj * 255
Image.fromarray(occ, 'RGBA').save(f'{OUT}/occ.png', optimize=True)

wq = Image.fromarray((ndimage.binary_erosion(walk, iterations=6) * 255).astype(np.uint8)).resize((W // 4, H // 4), Image.BILINEAR)
wq = wq.point(lambda v: 255 if v > 127 else 0).convert('1')
wq.save(f'{OUT}/walk.png', optimize=True)
print(zone, W, H, 'walk', round(walk.mean(), 3), {f: os.path.getsize(f'{OUT}/{f}') // 1024 for f in os.listdir(OUT)})
