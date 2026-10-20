"""탐색 월드 그림을 조각 단위로 넓힌다(이어 그리기).

world.png(RGBA, 알파 0 = 아직 그림 없음)를 기준으로
  init <원본.jpg>                       원본 구역을 (0,0)에 놓고 월드 크기를 정한다
  window <이름> <x> <y> <w> <h>         그 창의 그림(이미 있는 부분 + 빈 곳 회색)과 마스크(빈 곳 투명)를 만든다
  merge <이름> <결과.jpg> <x> <y> <w> <h>  생성 결과를 빈 곳에 채우고, 경계는 넓게 섞어 이음매를 숨긴다
  preview                               미리보기(1/6 크기)
사용: python3 tools/explore/world.py ..."""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

D = 'tools/explore/world'
WORLD = f'{D}/world.png'
WW, WH = 7760, 4800  # v2: 0.6배 축척 아카데미(0,2140) + 북쪽 캠퍼스 · 동쪽 성수 거리
os.makedirs(D, exist_ok=True)
cmd = sys.argv[1]

if cmd == 'init':
    src = Image.open(sys.argv[2]).convert('RGB')
    w = Image.new('RGBA', (WW, WH), (0, 0, 0, 0))
    w.paste(src, (0, 0))
    w.save(WORLD)
elif cmd == 'window':
    name, x, y, ww, hh = sys.argv[2], *map(int, sys.argv[3:7])
    w = Image.open(WORLD)
    crop = Image.new('RGBA', (ww, hh), (0, 0, 0, 0))
    crop.alpha_composite(w.crop((max(0, x), max(0, y), min(WW, x + ww), min(WH, y + hh))), (max(0, -x), max(0, -y)))
    a = np.asarray(crop)[..., 3]
    rgb = np.asarray(crop.convert('RGB')).copy()
    rgb[a < 128] = (128, 128, 128)
    Image.fromarray(rgb).save(f'{D}/{name}_in.png')
    m = np.zeros((hh, ww, 4), np.uint8); m[..., 3] = np.where(a > 128, 255, 0)  # 투명 = 새로 그릴 곳
    Image.fromarray(m, 'RGBA').save(f'{D}/{name}_mask.png')
    print(name, 'known', round((a > 128).mean(), 3))
elif cmd == 'merge':
    name, res, x, y, ww, hh = sys.argv[2], sys.argv[3], *map(int, sys.argv[4:8])
    w = Image.open(WORLD); wa = np.asarray(w).astype(np.float32)
    g = np.asarray(Image.open(res).convert('RGB').resize((ww, hh), Image.LANCZOS)).astype(np.float32)
    x0, y0, x1, y1 = max(0, x), max(0, y), min(WW, x + ww), min(WH, y + hh)
    gx0, gy0 = x0 - x, y0 - y
    reg = wa[y0:y1, x0:x1]; gg = g[gy0:gy0 + (y1 - y0), gx0:gx0 + (x1 - x0)]
    known = reg[..., 3] > 128
    # 이미 있는 그림 안쪽 FEATHER 픽셀까지는 새 그림과 섞는다(새 그림이 원래 그림을 거의 그대로 다시 그리므로 이음매가 사라진다)
    FEATHER = 140
    dist = ndimage.distance_transform_edt(known)
    k = np.clip(dist / FEATHER, 0, 1)[..., None]          # 1 = 원래 그림 그대로
    k = k * k * (3 - 2 * k)
    out = reg[..., :3] * k + gg * (1 - k)
    reg[..., :3] = out; reg[..., 3] = 255
    wa[y0:y1, x0:x1] = reg
    Image.fromarray(wa.astype(np.uint8), 'RGBA').save(WORLD)
    print('merged', name, 'filled', round((wa[..., 3] > 128).mean(), 3))
elif cmd == 'preview':
    w = Image.open(WORLD)
    bg = Image.new('RGBA', w.size, (255, 0, 255, 255)); bg.alpha_composite(w)
    bg.convert('RGB').resize((WW // 6, WH // 6)).save('/tmp/claude-0/world_prev.jpg', quality=85)
