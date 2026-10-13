"""FP1 썸머 패스 화면 시안(1672×941)을 움직일 수 있는 조각으로 나눈다.
- base: 장면 전체. 움직이는 조각 자리(손글씨·제목·도장·티켓·폴라로이드·꼬리표·탭 밑줄)는 지우고(OpenCV 인페인트, 근사)
        아래 보상 띠 자리(y≥602)는 위 장면을 뒤집어 흐리게 채운다(띠가 올라오는 동안만 잠깐 보임)
- 글씨 조각(title·sun·fp1·hw1·hw2·stamp): 글자 획만 알파로 따낸다(주변 밝기 차이 + 연결 요소 거르기)
- 종이 조각(ticket·polaroid·tag): 네 꼭짓점 다각형으로 따낸다. 티켓의 레벨 숫자·경험치 글자·막대는 지우고 화면에서 실제 값으로 그린다
- strip: 아래 보상 띠 판(열·버튼·화살표·GET PREMIUM 자리를 지운 종이) + 열 6개·BASIC·PREMIUM·GET PREMIUM·화살표 조각
배너: 로비 캐러셀용 FP1 SUMMER PASS 배너(2172×724 → 1060×353)
사용: python3 tools/build_summer_pass_assets.py <썸머 패스 화면 png> <썸머 패스 배너 png> [디버그 폴더]"""
import json, os, sys
import numpy as np, cv2
from PIL import Image

src, banner = sys.argv[1], sys.argv[2]
DBG = sys.argv[3] if len(sys.argv) > 3 else None
OUT = 'public/ref/pass/summer'
os.makedirs(OUT, exist_ok=True)
img = cv2.imread(src)
H, W = img.shape[:2]
STRIP_Y = 602
meta = {}

def rgba(bgr, a):
    return Image.fromarray(np.dstack([cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), a]), 'RGBA')

def save(k, bgr, a, box, q=90):
    x0, y0 = box[:2]
    ys, xs = np.nonzero(a > 8)  # 투명 여백은 잘라 낸다
    if len(xs):
        bx0, by0, bx1, by1 = max(0, xs.min() - 2), max(0, ys.min() - 2), min(a.shape[1], xs.max() + 3), min(a.shape[0], ys.max() + 3)
    else:
        bx0, by0, bx1, by1 = 0, 0, a.shape[1], a.shape[0]
    rgba(bgr[by0:by1, bx0:bx1], a[by0:by1, bx0:bx1]).save(f'{OUT}/{k}.webp', quality=q)
    meta[k] = {'x': int(x0 + bx0), 'y': int(y0 + by0), 'w': int(bx1 - bx0), 'h': int(by1 - by0), 'file': f'ref/pass/summer/{k}.webp'}

hole = np.zeros((H, W), np.uint8)

# ── 글씨 조각 ─────────────────────────────────────────
def strokes(box, mode, keep, t=16, soft=10, minarea=6):
    x0, y0, x1, y1 = box
    c = img[y0:y1, x0:x1]
    g = cv2.cvtColor(c, cv2.COLOR_BGR2GRAY).astype(np.float32)
    bl = cv2.GaussianBlur(g, (0, 0), 7)
    b, gg, r = [c[..., i].astype(np.float32) for i in range(3)]
    if mode == 'dark': d = bl - g
    elif mode == 'light': d = np.where(np.minimum(np.minimum(b, gg), r) > 175, g - bl, 0)
    elif mode == 'blue': d = np.where(g < 238, (b - r) - 30, 0)
    elif mode == 'yellow': d = np.where((r > 200) & (gg > 160), (r - b) - 50, 0)
    m = (d > t).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
    good = np.zeros_like(m)
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if area < minarea: continue
        if not keep(x0 + cen[i][0], y0 + cen[i][1], x0 + x, y0 + y, x0 + x + w, y0 + y + h): continue
        good[lab == i] = 1
    for ex0, ey0, ex1, ey1 in ERASE.get(mode_key[0], []):  # 글씨에 붙은 구름·나무 결 조각
        good[ey0 - y0:ey1 - y0, ex0 - x0:ex1 - x0] = 0
    near = cv2.dilate(good, np.ones((5, 5), np.uint8))
    a = np.clip((d - (t - soft)) / (soft * 1.6), 0, 1) * near
    a = np.maximum(a, good * 1.0)
    a = (cv2.GaussianBlur(a.astype(np.float32), (0, 0), 0.5) * 255).astype(np.uint8)
    hole[y0:y1, x0:x1] |= cv2.dilate(near, np.ones((5, 5), np.uint8)) * 255
    return c.copy(), a

ERASE = {'hw2': [(1276, 160, 1291, 224), (1340, 140, 1376, 151), (1374, 198, 1436, 224), (1318, 214, 1335, 226)]}
mode_key = ['']

def inside(x0, y0, x1, y1):
    return lambda cx, cy, bx0, by0, bx1, by1: x0 <= bx0 and y0 <= by0 and bx1 <= x1 and by1 <= y1

TXT = {
    'title': ((28, 60, 392, 245), 'blue', lambda cx, cy, bx0, by0, bx1, by1: inside(36, 72, 382, 242)(cx, cy, bx0, by0, bx1, by1) and (bx1 - bx0) * (by1 - by0) > 60, 26),
    'sun': ((262, 128, 352, 218), 'yellow', inside(262, 128, 352, 218), 10),
    'fp1': ((60, 225, 300, 292), 'dark', inside(62, 228, 298, 290), 18),
    'stamp': ((405, 40, 606, 175), 'dark', lambda cx, cy, bx0, by0, bx1, by1: (by0 > 44 and (cx - 474) ** 2 + (cy - 108) ** 2 < 66 ** 2) or (bx0 > 538 and bx1 < 600 and 82 < cy < 132), 12),
    'hw1': ((66, 298, 302, 366), 'dark', lambda cx, cy, bx0, by0, bx1, by1: inside(68, 300, 300, 364)(cx, cy, bx0, by0, bx1, by1) and not (bx0 > 280 and by0 < 306), 16),
    'hw2': ((1276, 122, 1436, 224), 'light', lambda cx, cy, bx0, by0, bx1, by1: bx0 > 1280 and bx1 < 1434 and by0 > 124 and (bx1 - bx0) * (by1 - by0) > 30 and not (cy > 192 and bx0 > 1408) and not (bx1 < 1290 and (bx1 - bx0) < 5), 18),
}
for k, (box, mode, keep, t) in TXT.items():
    mode_key[0] = k
    c, a = strokes(box, mode, keep, t=t)
    save(k, c, a, box, q=92)

# ── 종이 조각(다각형) ─────────────────────────────────
POLY = {
    'ticket': [(18, 398), (368, 380), (378, 566), (24, 590)],
    'polaroid': [(361, 340), (523, 314), (556, 560), (393, 580)],
    'tag': [(1582, 433), (1660, 433), (1663, 586), (1566, 582)],
}
# 티켓·폴라로이드 사이 노란 꽃(줄기 포함)은 폴라로이드와 함께 움직인다
FL = (322, 470, 408, 598)
fc = img[FL[1]:FL[3], FL[0]:FL[2]]
hsv = cv2.cvtColor(fc, cv2.COLOR_BGR2HSV)
fm = ((hsv[..., 1] > 70) & (hsv[..., 0] < 60)).astype(np.uint8) * 255
fm = cv2.morphologyEx(fm, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
flower = np.zeros((H, W), np.uint8); flower[FL[1]:FL[3], FL[0]:FL[2]] = cv2.dilate(fm, np.ones((3, 3), np.uint8))
paper = np.zeros((H, W), np.uint8)
for k, pts in POLY.items():
    p = np.array(pts, np.int32)
    x0, y0 = p.min(0) - 6; x1, y1 = p.max(0) + 6
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [p], 255)
    if k == 'polaroid':
        m |= flower; x0, y1 = min(x0, FL[0]), max(y1, FL[3])
    if k != 'tag': paper |= cv2.dilate(m, np.ones((9, 9), np.uint8))
    hole |= cv2.dilate(m, np.ones((7, 7), np.uint8))
    a = cv2.GaussianBlur(m, (0, 0), 1.0)[y0:y1, x0:x1]
    c = img[y0:y1, x0:x1].copy()
    if k == 'ticket':  # 실제 값으로 다시 그리는 자리: 레벨 글자, 경험치 글자, 막대
        lm = np.zeros(c.shape[:2], np.uint8)
        for rx0, ry0, rx1, ry1 in [(128, 406, 262, 452), (276, 432, 368, 459), (88, 456, 368, 480)]:
            lm[ry0 - y0:ry1 - y0, rx0 - x0:rx1 - x0] = 255
        c = cv2.inpaint(c, lm, 5, cv2.INPAINT_TELEA)
        c = cv2.bilateralFilter(c, 0, 8, 3) * (lm[..., None] > 0) + c * (lm[..., None] == 0)
        c = c.astype(np.uint8)
    save(k, c, a, (x0, y0, x1, y1), q=92)

# 탭 밑줄(REWARDS 아래 파란 줄)은 화면에서 움직이는 밑줄로 그린다
hole[33:44, 1328:1414] = 255

# ── 기본 장면(base) ───────────────────────────────────
hole[STRIP_Y:] = 0
small = cv2.inpaint(cv2.resize(img, (W // 2, H // 2), interpolation=cv2.INTER_AREA), cv2.resize(hole, (W // 2, H // 2), interpolation=cv2.INTER_NEAREST), 7, cv2.INPAINT_TELEA)
up = cv2.resize(small, (W, H), interpolation=cv2.INTER_CUBIC)
base = img.copy(); base[hole > 0] = up[hole > 0]
fine = cv2.inpaint(img, cv2.dilate(hole, np.ones((3, 3), np.uint8)), 4, cv2.INPAINT_TELEA)
thin = cv2.erode(hole, np.ones((9, 9), np.uint8))  # 얇은 획 자리는 원해상도 인페인트가 더 자연스럽다
base[(hole > 0) & (thin == 0)] = fine[(hole > 0) & (thin == 0)]
# 티켓·폴라로이드 자리(넓은 모래밭): 아주 낮은 해상도로 채운 부드러운 바탕 + 모래 결
q = 8
cs = cv2.inpaint(cv2.resize(img, (W // q, H // q), interpolation=cv2.INTER_AREA), cv2.dilate(cv2.resize(paper, (W // q, H // q), interpolation=cv2.INTER_NEAREST), np.ones((3, 3), np.uint8)), 3, cv2.INPAINT_TELEA)
cs = cv2.GaussianBlur(cv2.resize(cs, (W, H), interpolation=cv2.INTER_CUBIC), (0, 0), 10).astype(np.float32)
sand_sd = 2.6  # 고운 모래 결(시안 모래밭 잡음 수준)
sg = cv2.GaussianBlur(np.random.default_rng(5).normal(0, sand_sd, (H, W)).astype(np.float32), (0, 0), 0.9)[..., None]
pf = (cv2.GaussianBlur(paper, (0, 0), 3) / 255.0)[..., None]
base = (base * (1 - pf) + np.clip(cs + sg, 0, 255) * pf).astype(np.uint8)
# 띠 자리: 위 장면을 뒤집어 흐리게
n = H - STRIP_Y
flip = base[STRIP_Y - n:STRIP_Y][::-1]
base[STRIP_Y:] = cv2.GaussianBlur(flip, (0, 0), 6)
Image.fromarray(cv2.cvtColor(base, cv2.COLOR_BGR2RGB)).save(f'{OUT}/base.webp', quality=86)
meta['base'] = {'x': 0, 'y': 0, 'w': W, 'h': H, 'file': 'ref/pass/summer/base.webp'}

# ── 아래 보상 띠 ──────────────────────────────────────
S0 = 598
SL = {  # (x0, y0, x1, y1)
    'col31': (186, 618, 370, 904), 'col32': (386, 618, 572, 904), 'col33': (586, 618, 770, 904),
    'col34': (786, 618, 970, 904), 'col35': (976, 616, 1172, 906), 'col36': (1183, 618, 1370, 904),
    'basic': (20, 680, 178, 738), 'premium': (20, 773, 181, 833),
    'getp': (1424, 657, 1668, 863), 'arrow1': (376, 736, 400, 766), 'arrow2': (1385, 745, 1405, 773),
}
sh = np.zeros((H, W), np.uint8)
for x0, y0, x1, y1 in SL.values():
    sh[y0:y1, x0:x1] = 255
strip = img.copy()
sm = cv2.inpaint(cv2.resize(img, (W // 2, H // 2), interpolation=cv2.INTER_AREA), cv2.resize(sh, (W // 2, H // 2), interpolation=cv2.INTER_NEAREST), 6, cv2.INPAINT_TELEA)
sup = cv2.resize(sm, (W, H), interpolation=cv2.INTER_CUBIC)
strip[sh > 0] = sup[sh > 0]
noise = (img.astype(np.float32) - cv2.GaussianBlur(img, (0, 0), 3).astype(np.float32))
sd = float(noise[910:935, 400:900].std())
grain = cv2.GaussianBlur(np.random.default_rng(3).normal(0, sd * 1.3, (H, W)).astype(np.float32), (0, 0), 0.7)[..., None]
strip = np.where(sh[..., None] > 0, np.clip(strip.astype(np.float32) + grain, 0, 255), strip).astype(np.uint8)
sa = np.zeros((H - S0, W), np.uint8)
ramp = np.clip((np.arange(S0, H) - (STRIP_Y + 1)) / 5.0, 0, 1)
sa[:] = (ramp * 255).astype(np.uint8)[:, None]
rgba(strip[S0:], sa).save(f'{OUT}/strip.webp', quality=88)
meta['strip'] = {'x': 0, 'y': S0, 'w': W, 'h': H - S0, 'file': 'ref/pass/summer/strip.webp'}
for k, (x0, y0, x1, y1) in SL.items():
    c = img[y0:y1, x0:x1].copy()
    a = np.full(c.shape[:2], 255, np.uint8)
    if k.startswith('col') or k in ('basic', 'premium', 'getp'):  # 가장자리 3px을 부드럽게(판 종이와 이음매 숨김)
        e = np.zeros_like(a); e[3:-3, 3:-3] = 255
        a = cv2.GaussianBlur(e, (0, 0), 1.6)
    rgba(c, a).save(f'{OUT}/{k}.webp', quality=92)
    meta[k] = {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'file': f'ref/pass/summer/{k}.webp'}

b = Image.open(banner).convert('RGB')
b.resize((1060, round(1060 * b.height / b.width)), Image.LANCZOS).save('public/ref/pass/banner-summer.webp', quality=88)
json.dump(meta, open('src/game/data/ref-pass-summer.json', 'w'), indent=1)
if DBG:
    cv2.imwrite(f'{DBG}/sp-base.png', base)
    cv2.imwrite(f'{DBG}/sp-strip.png', strip)
    cv2.imwrite(f'{DBG}/sp-hole.png', hole)
print('ok', {k: (v['x'], v['y'], v['w'], v['h']) for k, v in meta.items()})
