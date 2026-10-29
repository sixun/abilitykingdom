"""로비 버튼 '그림 자체가 움직이는' 부위 윤곽 만들기.

원본 조각(public/ref/.../matte/<id>.webp)에서 움직일 부위(종, 봉투, 핀 ...)를 색·밝기 조건으로 골라
윤곽 다각형과 '빈자리 메움색'을 src/game/data/live-parts.json 에 적는다. 새 그림 파일은 만들지 않는다
(게임 페이지는 한 버전에 파일 512개 제한이 있음). 화면에서는 src/ui/LiveRef.tsx 가 이 윤곽으로 원본을
잘라 움직이고, 비는 자리는 메움색으로 칠한다.

부위 조건
  rect  (x, y, w, h)  원본 1배 좌표, 이 안에서만 고른다
  crit  bright | dark | alpha | blue | orange | white | notplate
  seed  (x, y)        이 점이 들어 있는 덩어리만(없으면 rect 안 전부)
  fill  'auto' | None | (r, g, b)   None = 투명으로 비움
  holes True면 덩어리 안쪽 구멍까지 채운다(봉투의 V자 등)
  circle (cx, cy, r) 이 원 안에서만
  grow  윤곽을 바깥으로 넓힐 픽셀 수(가장자리 안티앨리어싱 포함)
확인용 그림: python3 tools/build_live_parts.py --preview <폴더>
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'src/game/data/live-parts.json'

ST = 'public/ref/station/matte/'
LB = 'public/ref/lobby/'
LM = 'public/ref/lobby/matte/'
SPECS = {
    # ── 역 로비 상단 ──
    'notice': (ST + 'notice-nobadge.webp', {
        'bell': dict(rect=(18, 8, 40, 46), crit='bright', fill='auto', holes=True, grow=2),
    }),
    'mail': (ST + 'mail.webp', {
        'env': dict(rect=(6, 13, 44, 38), crit='bright', fill='auto', holes=True, grow=2),
    }),
    'menu': (ST + 'menu-nobadge.webp', {
        't0': dict(grow=2, rect=(10, 14, 17, 18), crit='bright', fill='auto'),
        't1': dict(grow=2, rect=(29, 14, 17, 18), crit='bright', fill='auto'),
        't2': dict(grow=2, rect=(10, 33, 17, 18), crit='bright', fill='auto'),
        't3': dict(grow=2, rect=(29, 33, 17, 18), crit='bright', fill='auto'),
    }),
    'currency-gems': (ST + 'currency-gems.webp', {
        'gem': dict(rect=(22, 6, 34, 48), crit='blue', fill='auto', holes=True, grow=2),
    }),
    'currency-coins': (ST + 'currency-coins.webp', {
        'card': dict(rect=(22, 11, 52, 40), crit='notdark', fill='auto', holes=True, grow=1),
    }),
    # ── 역 로비 왼쪽 ──
    'messages': (ST + 'messages.webp', {
        'icon': dict(rect=(8, 0, 67, 64), crit='orangewhite', fill=None, holes=True),
        'eyes': dict(rect=(29, 22, 24, 14), crit='orange', fill=(255, 255, 255), grow=1),
    }),
    'events': (ST + 'events-nobadge.webp', {
        'cal': dict(rect=(10, 6, 72, 66), crit='alpha', fill=None, holes=True, seed=(45, 40)),
    }),
    'coupon': (ST + 'coupon.webp', {
        'tix': dict(rect=(6, 0, 74, 60), crit='alpha', fill=None, holes=True, seed=(45, 30)),
    }),
    'costume': (ST + 'costume.webp', {
        'hanger': dict(rect=(26, 19, 38, 29), crit='dark', fill='auto', grow=1),
    }),
    'wanted': (ST + 'wanted.webp', {
        'scope': dict(rect=(10, 18, 58, 58), crit='blue', fill='auto', grow=1),
    }),
    'shop': (ST + 'shop.webp', {
        'stall': dict(rect=(12, 58, 85, 70), crit='white', fill='auto', grow=1),
    }),
    'training': (ST + 'training-nobadge.webp', {
        'gear': dict(rect=(30, 32, 86, 67), crit='blue', fill='auto', grow=1),
    }),
    # ── 역 로비 오른쪽 ──
    'quest': (ST + 'quest.webp', {
        'mark': dict(rect=(0, 0, 73, 66), circle=(37, 33, 33), crit='light', fill='auto', holes=True, grow=1),
        'arrow': dict(rect=(300, 8, 56, 52), crit='blue', fill='auto', holes=True, grow=1),
    }),
    'arena': (ST + 'arena.webp', {
        'card': dict(rect=(38, 28, 62, 64), crit='white', fill='auto', holes=True, grow=1),
    }),
    'raid': (ST + 'raid.webp', {
        'shield': dict(rect=(38, 26, 56, 66), crit='white', fill='auto', holes=True, grow=1, seed=(66, 30)),
    }),
    'story': (ST + 'story-nobadge.webp', {
        'bldg': dict(rect=(44, 10, 92, 102), crit='bright', fill='auto', holes=True, grow=2),
    }),
    'exploration': (ST + 'exploration-nobadge.webp', {
        'pin': dict(rect=(44, 44, 40, 58), crit='dark', fill='auto', holes=True, grow=1, seed=(69, 60)),
    }),
    # ── 폐기(2026-10-29): 카페(소파) 로비. 카페 로비를 쓰지 않으므로 주석 처리 ──
#     # ── 카페(소파) 로비 ──
#     'sofa:back': (LB + 'back.webp', {
#         'arrow': dict(rect=(4, 4, 76, 48), crit='red', fill='auto', holes=True, grow=2),
#     }),
#     'sofa:stamina': (LB + 'stamina.webp', {
#         'bat': dict(rect=(118, 0, 46, 50), crit='blue', fill='auto', holes=True, grow=2),
#     }),
#     'sofa:currency-coins': (LB + 'currency-coins.webp', {
#         'coin': dict(rect=(108, 0, 46, 50), crit='bright', fill='auto', holes=True, grow=2),
#     }),
#     'sofa:currency-gems': (LB + 'currency-gems.webp', {
#         'medal': dict(rect=(108, 0, 50, 48), crit='notdark', fill='auto', holes=True, grow=1),
#     }),
#     'sofa:character-switch': (LM + 'character-switch.webp', {
#         'person': dict(rect=(32, 8, 21, 30), crit='bright', fill='auto', grow=1),
#         'al': dict(rect=(18, 12, 14, 26), crit='bright', fill='auto', grow=1),
#         'ar': dict(rect=(53, 12, 15, 26), crit='bright', fill='auto', grow=1),
#     }),
#     'sofa:nav-story': (LM + 'nav-story.webp', {'book': dict(rect=(18, 24, 60, 46), crit='dark', fill='auto', holes=True, grow=1)}),
#     'sofa:nav-explore': (LM + 'nav-explore.webp', {'pin': dict(rect=(30, 4, 34, 46), crit='bright', fill='auto', holes=True, grow=1, seed=(46, 14))}),
#     'sofa:nav-wanted': (LM + 'nav-wanted.webp', {'scope': dict(rect=(18, 24, 60, 52), crit='bright', fill='auto', grow=1)}),
#     'sofa:nav-training': (LM + 'nav-training.webp', {'bell': dict(rect=(10, 24, 74, 50), crit='bright', fill='auto', grow=1)}),
#     'sofa:nav-arena': (LM + 'nav-arena.webp', {'swords': dict(rect=(18, 24, 66, 52), crit='bright', fill='auto', grow=1)}),
#     'sofa:nav-raid': (LM + 'nav-raid.webp', {'beast': dict(rect=(10, 4, 68, 58), crit='bright', fill='auto', holes=True, grow=1)}),
#     'sofa:nav-characters': (LM + 'nav-characters.webp', {'person': dict(rect=(20, 4, 52, 58), crit='bright', fill='auto', holes=True, grow=1)}),
#     'sofa:nav-formation': (LM + 'nav-formation.webp', {
#         'p0': dict(rect=(32, 20, 15, 38), crit='bright', fill='auto', grow=1),
#         'p1': dict(rect=(47, 12, 24, 46), crit='bright', fill='auto', grow=1),
#         'p2': dict(rect=(71, 20, 16, 38), crit='bright', fill='auto', grow=1),
#     }),
#     'sofa:nav-shop': (LM + 'nav-shop.webp', {'cart': dict(rect=(12, 8, 58, 54), crit='bright', fill='auto', holes=True, grow=1)}),
#     'sofa:nav-recruit': (LM + 'nav-recruit.webp', {'hex': dict(rect=(14, 4, 62, 58), crit='bright', fill='auto', holes=True, grow=1)}),
}


def hsv(rgb):
    hsv_ = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    return hsv_[..., 0] * 2, hsv_[..., 1] / 255, hsv_[..., 2] / 255


def crit_mask(img, crit):
    rgb, a = img[..., :3].astype(np.float32), img[..., 3]
    h, s, v = hsv(rgb)
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    vis = a > 60
    if crit == 'bright':
        return vis & (lum > 140) & (s < 0.3)
    if crit == 'white':
        return vis & (lum > 175) & (s < 0.25)
    if crit == 'dark':
        return vis & (lum < 120)
    if crit == 'red':
        return vis & ((h < 15) | (h > 340)) & (s > 0.45) & (v > 0.45)
    if crit == 'notdark':
        return vis & (lum > 70)
    if crit == 'light':
        return vis & (lum > 85)
    if crit == 'alpha':
        return a > 90
    if crit == 'blue':
        return vis & (h > 185) & (h < 245) & (s > 0.35) & (v > 0.35)
    if crit == 'orange':
        return vis & (h > 10) & (h < 50) & (s > 0.45) & (v > 0.5)
    if crit == 'orangewhite':
        return vis & (((h > 10) & (h < 55) & (s > 0.4) & (v > 0.5)) | ((lum > 200) & (s < 0.2)))
    raise ValueError(crit)


def build_part(img, p):
    H, W = img.shape[:2]
    x, y, w, h = p['rect']
    m = crit_mask(img, p['crit'])
    box = np.zeros_like(m)
    box[max(0, y):min(H, y + h), max(0, x):min(W, x + w)] = True
    if p.get('circle'):
        cx, cy, r = p['circle']
        yy, xx = np.mgrid[0:H, 0:W]
        box &= (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
    m &= box
    if p.get('seed'):
        lab, _ = ndimage.label(m)
        sx, sy = p['seed']
        k = lab[sy, sx]
        if k == 0:  # 시드가 살짝 비껴가면 가장 가까운 덩어리
            ys, xs = np.nonzero(lab)
            j = np.argmin((xs - sx) ** 2 + (ys - sy) ** 2)
            k = lab[ys[j], xs[j]]
        m = lab == k
    if p.get('holes'):
        m = ndimage.binary_fill_holes(m)
    # 너무 작은 부스러기 제거
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = [i + 1 for i, sz in enumerate(sizes) if sz >= 6]
        m = np.isin(lab, keep)
    m = ndimage.binary_dilation(m, iterations=p.get('grow', 1)) & box if p.get('grow', 1) else m
    cs, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    polys = []
    for c in cs:
        if cv2.contourArea(c) < 4:
            continue
        c = cv2.approxPolyDP(c, 0.7, True)
        polys.append([[int(q[0][0]), int(q[0][1])] for q in c])
    fill = p.get('fill')
    if fill == 'auto':
        ring = ndimage.binary_dilation(m, iterations=3) & ~ndimage.binary_dilation(m, iterations=1)
        px = img[ring]
        px = px[px[:, 3] > 60] if (px[:, 3] > 60).any() else px
        fill = [int(v) for v in np.median(px[:, :3], axis=0)]
    elif fill is not None:
        fill = list(fill)
    ys, xs = np.nonzero(m)
    return {'polys': polys, 'fill': fill, 'box': [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]}, m


def main():
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    out = {}
    for key, (src, parts) in SPECS.items():
        img = np.array(Image.open(ROOT / src).convert('RGBA'))
        out[key] = {'src': src.replace('public/', ''), 'parts': {}}
        tint = img.copy()
        for name, p in parts.items():
            info, m = build_part(img, p)
            out[key]['parts'][name] = info
            col = np.array([255, 0, 200, 255])
            tint[m] = (tint[m] * 0.45 + col * 0.55).astype(np.uint8)
            print(key, name, 'polys', len(info['polys']), 'box', info['box'], 'fill', info['fill'])
        if preview:
            k = 5 if img.shape[1] < 200 else 3
            both = np.concatenate([img, tint], axis=1)
            im = Image.fromarray(both).resize((both.shape[1] * k, both.shape[0] * k), Image.NEAREST)
            bg = Image.new('RGBA', im.size, (70, 80, 100, 255))
            bg.alpha_composite(im)
            bg.convert('RGB').save(Path(preview) / f'{key}.png')
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print('wrote', OUT.relative_to(ROOT))


if __name__ == '__main__':
    main()
