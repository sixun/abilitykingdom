"""v0.6.1 그림 정리
1) S01 패스 왼쪽 센카 그림 교체(고해상도 표지 그림 1122×1402) + 'SENKA' 큰 글자 모양 마스크(홀로그램 효과용)
   - 그림을 0.709배(796×994)로 줄여 왼쪽 위에 맞춤: 패널 경계(위 836px, 아래 772px) 안에 'S01 PORTRAIT'까지 들어오게
   - 오른쪽 모자란 폭(796→860)은 가장자리를 거울로 이어 흐리게 채움(위쪽 패널 틈에만 보임)
   - 글자 마스크: 밝고(>120) 채도 낮고(<85) 붉은 기 없는(피부 제외) 큰 덩어리, 레이스 무늬 빈틈은 닫기
2) 영입 왼쪽 배너 목록 4장(2017×780 → 폭 600)
3) NIGHT SHIFT 제목 글자를 NIGHT / SHIFT로 나눔(기울어진 두 줄: 글자 덩어리 중심으로 판별)
4) ONE MORE PLAY? 이름표에서 이름 글자(채린)를 지움 → 화면에서 실제 이름(칸나)을 그린다
사용: python3 tools/build_banner_art.py <폴더(senka.png, b-rion.png, b-serenity.png, b-nightshift.png, b-omp.png)>"""
import json, sys
import numpy as np, cv2
from PIL import Image

SRC = sys.argv[1]

# ── 1) 센카 ──
im = cv2.imread(f'{SRC}/senka.png')
b, g, r = [im[..., i].astype(int) for i in range(3)]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(int)
lum = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(int)
m = ((lum > 120) & (hsv[..., 1] < 85) & (r - b < 12)).astype(np.uint8) * 255
m[335:] = 0
mc = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(mc, 8)
keep = np.zeros_like(m)
for i in range(1, n):
    if st[i, 4] > 600 and st[i, 3] > 30: keep[lab == i] = 255
keep = cv2.morphologyEx(keep, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
near = cv2.dilate(keep, np.ones((7, 7), np.uint8))
keep |= ((lum > 140) & (near > 0) & (hsv[..., 1] < 90)).astype(np.uint8) * 255  # 레이스 무늬의 밝은 점
keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
keep = cv2.GaussianBlur(keep, (0, 0), 1.0)

S = 0.709
w, h = round(im.shape[1] * S), round(im.shape[0] * S)
sm = cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)
mk = cv2.resize(keep, (w, h), interpolation=cv2.INTER_AREA)
W, H = 860, 941
pad = W - w
canvas = cv2.copyMakeBorder(sm[:H], 0, 0, 0, pad, cv2.BORDER_REFLECT)
blur = cv2.GaussianBlur(canvas, (0, 0), 6)
ramp = np.clip((np.arange(W) - (w - 6)) / 24, 0, 1)[None, :, None]
canvas = (canvas * (1 - ramp) + blur * ramp).astype(np.uint8)
mcan = np.zeros((H, W), np.uint8); mcan[:, :w] = mk[:H]
Image.fromarray(cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)).save('public/ref/pass/hero.webp', quality=90)
Image.fromarray(np.dstack([np.full((H, W, 3), 255, np.uint8), mcan]), 'RGBA').save('public/ref/pass/senka-holo-mask.webp', quality=90)
print('senka', w, h)

# ── 2) 배너 목록 ──
for k in ('rion', 'serenity', 'nightshift', 'omp'):
    bn = Image.open(f'{SRC}/b-{k}.png').convert('RGB')
    bn.resize((600, round(600 * bn.height / bn.width)), Image.LANCZOS).save(f'public/ref/recruit/list-{k}.webp', quality=90)

# ── 3) NIGHT / SHIFT ──
F = json.load(open('src/game/data/ref-recruit-fx.json'))
tx = np.asarray(Image.open('public/ref/recruit/nightshift/fx-title-text.webp').convert('RGBA'))
a = (tx[..., 3] > 60).astype(np.uint8)
n, lab, st, cen = cv2.connectedComponentsWithStats(a, 8)
seed = np.zeros(a.shape, np.int32)
for i in range(1, n):
    if st[i, 4] < 60: continue
    seed[lab == i] = 1 if cen[i][1] + 0.22 * cen[i][0] < 190 else 2
_, idx = cv2.distanceTransformWithLabels((seed == 0).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
ys, xs = np.nonzero(seed)
lut = np.zeros(idx.max() + 1, np.int32); lut[idx[ys, xs]] = seed[ys, xs]
owner = lut[idx]
for k, v in (('night', 1), ('shift', 2)):
    o = tx.copy(); o[..., 3] = (tx[..., 3] * (owner == v)).astype(np.uint8)
    Image.fromarray(o, 'RGBA').save(f'public/ref/recruit/nightshift/fx-{k}.webp', quality=92)
F['nightshift']['night'] = 'ref/recruit/nightshift/fx-night.webp'
F['nightshift']['shift'] = 'ref/recruit/nightshift/fx-shift.webp'

# ── 4) 이름표 이름 지우기(ONE MORE PLAY?) ──
M = json.load(open('src/game/data/ref-recruit-scenes.json'))
t = M['omp']['tag']
tag = np.asarray(Image.open('public/' + t['file']).convert('RGBA')).copy()
x0, y0, x1, y1 = 404 - t['x'], 568 - t['y'], 470 - t['x'], 606 - t['y']
rgb = np.ascontiguousarray(tag[..., :3])
hole = np.zeros(rgb.shape[:2], np.uint8)
reg = rgb[y0:y1, x0:x1].astype(int)
hole[y0:y1, x0:x1] = (((reg[..., 0] - reg[..., 2]) > 40) | (reg.sum(2) < 450)).astype(np.uint8) * 255
hole = cv2.dilate(hole, np.ones((5, 5), np.uint8))
rgb = cv2.inpaint(rgb, hole, 4, cv2.INPAINT_TELEA)
tag[..., :3] = rgb
Image.fromarray(tag, 'RGBA').save('public/ref/recruit/omp/fx-tag-noname.webp', quality=92)
F['omp']['tagNoName'] = 'ref/recruit/omp/fx-tag-noname.webp'
F['omp']['tagName'] = {'x': 406, 'y': 568, 'h': 38}
json.dump(F, open('src/game/data/ref-recruit-fx.json', 'w'), indent=1)
print('ok')
