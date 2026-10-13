"""영입 배너 연출용 추가 조각(build_recruit_scenes.py 결과 + 시안에서).
- NIGHT SHIFT: 제목을 글자(크림색)·틀(주황)로 나눔 → 글자는 쾅 찍히고 틀은 그려지고 빛이 틀을 따라 돈다
- ONE MORE PLAY?: 제목을 글자 12개로 나눔(빨간 글자 덩어리 기준, 그림자는 가장 가까운 글자에 붙임)
  인물 모자이크 3단계(블록 28·14·7px), 간판 글자(밝은 글씨) 조각, 오락기 화면의 INSERT COIN을 지운 조각
결과: public/ref/recruit/<배너>/fx-*.webp, src/game/data/ref-recruit-fx.json
사용: python3 tools/build_recruit_fx.py <시안 폴더>"""
import json, sys
import numpy as np, cv2
from PIL import Image

SRC = sys.argv[1]
M = json.load(open('src/game/data/ref-recruit-scenes.json'))
FX = {}


def load(v):
    return np.asarray(Image.open('public/' + v['file']).convert('RGBA'))


def save(path, arr):
    Image.fromarray(arr.astype(np.uint8), 'RGBA').save('public/' + path, quality=92)


# ── NIGHT SHIFT 제목: 글자 / 틀 ──
v = M['nightshift']['title']; im = load(v).astype(np.int32)
r, g, b, a = [im[..., i] for i in range(4)]
orange = (r > 150) & (r - b > 70) & (g < 175)
om = cv2.dilate(orange.astype(np.uint8), np.ones((3, 3), np.uint8)) & (a > 0)
frame = im.copy(); frame[..., 3] = (a * om).astype(np.int32)
text = im.copy(); text[..., 3] = (a * (1 - om)).astype(np.int32)
save('ref/recruit/nightshift/fx-title-text.webp', text)
save('ref/recruit/nightshift/fx-title-frame.webp', frame)
FX['nightshift'] = {'titleText': 'ref/recruit/nightshift/fx-title-text.webp', 'titleFrame': 'ref/recruit/nightshift/fx-title-frame.webp', 'title': {k: v[k] for k in ('x', 'y', 'w', 'h')}}

# ── ONE MORE PLAY? 제목 글자 ──
letters = []
for key in ('title', 'title2'):
    v = M['omp'][key]; im = load(v)
    r, g, b, a = [im[..., i].astype(np.int32) for i in range(4)]
    red = ((r > 175) & (g < 130) & (b < 120) & (a > 100)).astype(np.uint8)
    red = cv2.morphologyEx(red, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(red, 8)
    comps = [i for i in range(1, n) if st[i, 4] > 200]
    comps.sort(key=lambda i: st[i, 0])
    # '?'의 점은 바로 앞 글자에 합친다(폭이 좁고 아래쪽)
    groups = []
    for i in comps:
        if groups and st[i, 2] < 40 and st[i, 1] > im.shape[0] * 0.6:
            groups[-1].append(i)
        else:
            groups.append([i])
    seed = np.zeros(a.shape, np.int32)
    for gi, grp in enumerate(groups):
        for i in grp: seed[lab == i] = gi + 1
    # 모든 불투명 픽셀을 가장 가까운 글자에 배정
    inv = (seed == 0).astype(np.uint8)
    _, idx = cv2.distanceTransformWithLabels(inv, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(seed)
    lut = np.zeros(idx.max() + 1, np.int32)
    # 라벨 번호 → 씨앗 픽셀의 글자 번호
    lut[idx[ys, xs]] = seed[ys, xs]
    owner = lut[idx]
    for gi in range(len(groups)):
        m = (owner == gi + 1) & (a > 0)
        yy, xx = np.nonzero(m)
        x0, y0, x1, y1 = xx.min(), yy.min(), xx.max() + 1, yy.max() + 1
        piece = im[y0:y1, x0:x1].copy(); piece[..., 3] = (im[y0:y1, x0:x1, 3] * m[y0:y1, x0:x1])
        f = f'ref/recruit/omp/fx-l{len(letters)}.webp'
        save(f, piece)
        letters.append({'x': int(v['x'] + x0), 'y': int(v['y'] + y0), 'w': int(x1 - x0), 'h': int(y1 - y0), 'file': f, 'row': 0 if key == 'title' else 1})

# ── 인물 모자이크 ──
v = M['omp']['char']; ch = Image.open('public/' + v['file']).convert('RGBA')
mos = []
for bs in (28, 14, 7):
    small = ch.resize((max(1, ch.width // bs), max(1, ch.height // bs)), Image.BOX)
    arr = np.asarray(small).copy(); arr[..., 3] = np.where(arr[..., 3] > 90, 255, 0)
    big = Image.fromarray(arr, 'RGBA').resize((small.width * bs, small.height * bs), Image.NEAREST)
    f = f'ref/recruit/omp/fx-px{bs}.webp'
    big.save('public/' + f, quality=90)
    mos.append({'file': f, 'w': big.width, 'h': big.height, 'bs': bs})

# ── 간판 글씨 · INSERT COIN ──
img = cv2.imread(f'{SRC}/omp.png')
x0, y0, x1, y1 = 996, 96, 1118, 194
c = img[y0:y1, x0:x1]
lum = cv2.cvtColor(c, cv2.COLOR_BGR2GRAY).astype(np.float32)
bl = cv2.GaussianBlur(lum, (0, 0), 6)
al = np.clip((lum - bl - 6) / 22, 0, 1)
al = (cv2.GaussianBlur(al, (0, 0), 0.6) * 255).astype(np.uint8)
glow = np.dstack([np.full_like(al, 255), np.full_like(al, 226), np.full_like(al, 170), al])
save('ref/recruit/omp/fx-sign.webp', glow)
sign = {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'file': 'ref/recruit/omp/fx-sign.webp'}

ix0, iy0, ix1, iy1 = 1532, 420, 1632, 446
cc = img[iy0 - 6:iy1 + 6, ix0 - 6:ix1 + 6].copy()
g2 = cv2.cvtColor(cc, cv2.COLOR_BGR2GRAY)
mk = ((g2.astype(np.int32) - cv2.GaussianBlur(g2, (0, 0), 5).astype(np.int32)) > 8).astype(np.uint8) * 255
mk[:6] = 0; mk[-6:] = 0; mk[:, :6] = 0; mk[:, -6:] = 0
mk = cv2.dilate(mk, np.ones((3, 3), np.uint8))
er = cv2.inpaint(cc, mk, 4, cv2.INPAINT_TELEA)
ea = np.zeros(er.shape[:2], np.uint8); ea[4:-4, 4:-4] = 255; ea = cv2.GaussianBlur(ea, (0, 0), 1.5)
Image.fromarray(np.dstack([cv2.cvtColor(er, cv2.COLOR_BGR2RGB), ea]), 'RGBA').save('public/ref/recruit/omp/fx-nocoin.webp', quality=92)
nocoin = {'x': ix0 - 6, 'y': iy0 - 6, 'w': ix1 - ix0 + 12, 'h': iy1 - iy0 + 12, 'file': 'ref/recruit/omp/fx-nocoin.webp'}

FX['omp'] = {'letters': letters, 'mosaic': mos, 'sign': sign, 'nocoin': nocoin,
             'screen': [[1508, 328], [1672, 318], [1672, 522], [1484, 520]],
             'buttons': [[1452, 534, 17, '#ff5a5a'], [1484, 563, 13, '#ffd34a'], [1511, 571, 13, '#4a7dff'], [1559, 568, 14, '#ff5a5a'], [1605, 550, 15, '#ff5a5a'], [1631, 565, 13, '#ffd34a'], [1326, 530, 15, '#ff5a5a']]}
json.dump(FX, open('src/game/data/ref-recruit-fx.json', 'w'), indent=1)
print('letters', len(letters), [(l['x'], l['w']) for l in letters])

# NIGHT SHIFT 틀 모서리(빛이 틀을 따라 도는 경로, 캔버스 좌표)
v = M['nightshift']['title']
fa = np.asarray(Image.open('public/ref/recruit/nightshift/fx-title-frame.webp'))[..., 3]
pts = cv2.findNonZero((fa > 60).astype(np.uint8))
hull = cv2.convexHull(pts)
poly = cv2.approxPolyDP(hull, 6, True).reshape(-1, 2)
FX['nightshift']['frame'] = [[int(p[0] + v['x']), int(p[1] + v['y'])] for p in poly]
json.dump(FX, open('src/game/data/ref-recruit-fx.json', 'w'), indent=1)
print('frame', FX['nightshift']['frame'])
