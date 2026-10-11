"""영상 위에 올릴 UI 조각의 배경을 걷어낸다(알파 매트). 원본 조각 픽셀은 그대로 두고 알파만 만든다.
방법(조각별):
  full  : 불투명 띠·패널(그대로)
  diff  : 원본 vs UI 없는 복원 배경의 차이 → 닫기·구멍 채우기·작은 조각 제거 → 1px 부드럽게
  lum   : 흰 아이콘·글자(밝은 픽셀 + 2px 외곽선 + 빨간 알림)  ※ 인물 위에 그려진 하단 메뉴용
  hull  : diff 결과의 볼록 껍질(사각·사선 카드)
  round : 둥근 사각형(알약 버튼), 인자 = 모서리 반지름
  poly  : 다각형(조각 좌표)
  hullc : 파란 테두리·밝은 픽셀의 볼록 껍질(인물 가방 위에 겹친 반투명 파란 카드)
  band  : 지정 높이(화면 y) 아래는 불투명 띠, 위로 튀어나온 부분만 lum
결과: public/ref/<화면>/matte/<id>.webp, src/game/data/ref-matte.json
사용: python3 tools/build_motion_mattes.py"""
import json, os
import numpy as np, cv2
from PIL import Image

BG = {'station': 'public/ref/restored/station-bg.webp', 'lobby': 'public/ref/restored/lobby-bg.webp', 'recruitment': 'public/ref/restored/recruitment-bg.webp'}


def fill_holes(m):
    h, w = m.shape
    ff = m.copy(); pad = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, pad, (0, 0), 1)
    # 가장자리에서 닿지 않은 0 = 구멍
    border = np.zeros((h + 2, w + 2), np.uint8); border[1:-1, 1:-1] = m
    inv = (1 - border).astype(np.uint8); mask = np.zeros((h + 4, w + 4), np.uint8)
    cv2.floodFill(inv, mask, (0, 0), 0)
    return np.maximum(m, inv[1:-1, 1:-1])


def drop_small(m, area):
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    out = np.zeros_like(m)
    for i in range(1, n):
        if st[i, 4] >= area: out[lab == i] = 1
    return out


def matte(ref, bg, l, method, arg=None):
    x, y, w, h = l['x'], l['y'], l['width'], l['height']
    a = ref[y:y + h, x:x + w].astype(np.int16); b = bg[y:y + h, x:x + w].astype(np.int16)
    if method == 'full':
        return np.full((h, w), 255, np.uint8)
    if method == 'round':
        m = np.zeros((h, w), np.uint8); r = arg or h // 2
        cv2.rectangle(m, (r, 1), (w - r - 1, h - 2), 255, -1); cv2.rectangle(m, (1, r), (w - 2, h - r - 1), 255, -1)
        for cx, cy in ((r, r), (w - r - 1, r), (r, h - r - 1), (w - r - 1, h - r - 1)): cv2.circle(m, (cx, cy), r - 1, 255, -1)
        return cv2.GaussianBlur(m, (3, 3), 0.8)
    if method == 'poly':
        m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [np.int32(arg)], 255)
        return cv2.GaussianBlur(m, (3, 3), 0.8)
    if method == 'band':
        m = matte(ref, bg, l, 'lum').astype(np.uint8)
        m[max(0, arg - y):] = 255
        return m
    if method == 'hullc':
        r, g, bb = a[..., 0], a[..., 1], a[..., 2]
        core = (((bb - r) > 50) & (bb > 120) | (a.min(axis=2) > 175)).astype(np.uint8)
        core = drop_small(core, 25)
        pts = cv2.findNonZero(core); m = np.zeros((h, w), np.uint8)
        if pts is not None: cv2.fillConvexPoly(m, cv2.convexHull(pts), 255)
        return cv2.GaussianBlur(cv2.dilate(m, np.ones((3, 3), np.uint8)), (3, 3), 0.8)
    if method == 'lum':
        mn = a.min(axis=2); r, g, bb = a[..., 0], a[..., 1], a[..., 2]
        core = ((mn > 165) | ((r > 200) & (g < 140) & (bb < 120))).astype(np.uint8)
        core = drop_small(core, 6)
        m = cv2.dilate(core, np.ones((5, 5), np.uint8))
        m = fill_holes(m)
        return cv2.GaussianBlur(m * 255, (3, 3), 0.8)
    d = np.abs(cv2.GaussianBlur(a.astype(np.float32), (0, 0), 1.2) - cv2.GaussianBlur(b.astype(np.float32), (0, 0), 1.2)).max(axis=2)
    core = (d > (arg or 46)).astype(np.uint8)
    core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    core = drop_small(fill_holes(core), 60)
    if method == 'hull':
        pts = cv2.findNonZero(core)
        m = np.zeros_like(core)
        if pts is not None: cv2.fillConvexPoly(m, cv2.convexHull(pts), 1)
        core = m
    core = cv2.dilate(core, np.ones((3, 3), np.uint8))
    return cv2.GaussianBlur(core * 255, (3, 3), 0.8)


PLAN = {
    'station': {
        'profile': ('diff',), 'currency-gems': ('hull',), 'currency-coins': ('hull',), 'notice': ('hull',), 'mail': ('hull',), 'menu': ('hull',),
        'pickup': ('hull',), 'quest': ('hull',), 'attendance': ('hull',),
        'messages': ('diff',), 'events': ('diff',), 'coupon': ('diff',), 'costume': ('diff',), 'arena': ('diff',), 'raid': ('diff',),
        'wanted': ('hullc',), 'shop': ('hullc',), 'training': ('hullc',), 'exploration': ('hull',), 'story': ('hull',),
        'characters': ('lum',), 'formation': ('lum',), 'home': ('lum',), 'bag': ('lum',), 'recruitment': ('lum',),
    },
    'lobby': {
        'event-terminal': ('hull',), 'event-story': ('full',), 'event-explore': ('full',), 'event-wanted': ('full',), 'character-switch': ('round', 26),
        **{f'nav-{n}': ('band', 698) for n in ('story', 'explore', 'wanted', 'training', 'arena', 'raid', 'characters', 'formation', 'shop', 'recruit')},
    },
    'recruitment': {
        'info-detail': ('round', 26), 'info-probability': ('round', 26),
    },
}

REF = {'station': '/tmp/claude-0/ref-station.png', 'lobby': '/tmp/claude-0/ref-lobby.png', 'recruitment': '/tmp/claude-0/ref-recruitment.png'}
meta = {}
for screen, plan in PLAN.items():
    ref = np.array(Image.open(REF[screen]).convert('RGB'))
    bg = np.array(Image.open(BG[screen]).convert('RGB').resize((ref.shape[1], ref.shape[0])))
    L = json.load(open(f'src/game/data/ref-{screen}.json'))
    os.makedirs(f'public/ref/{screen}/matte', exist_ok=True)
    meta[screen] = {}
    for l in L['layers']:
        if l['id'] not in plan: continue
        method, *arg = plan[l['id']]
        al = matte(ref, bg, l, method, arg[0] if arg else None)
        src = np.array(Image.open('public/' + l['file']).convert('RGBA'))
        src[..., 3] = np.minimum(src[..., 3], al)
        Image.fromarray(src, 'RGBA').save(f'public/ref/{screen}/matte/{l["id"]}.webp', lossless=True, quality=100, method=6, exact=True)
        meta[screen][l['id']] = f'ref/{screen}/matte/{l["id"]}.webp'
# 역 로비의 글자 지운 패치: 패치를 붙인 화면에서 밑 조각의 매트를 다시 계산해 그 영역만 잘라 쓴다
TL = json.load(open('src/game/data/ref-textless.json'))['station']
ref = np.array(Image.open(REF['station']).convert('RGB'))
bg = np.array(Image.open(BG['station']).convert('RGB').resize((ref.shape[1], ref.shape[0])))
L = json.load(open('src/game/data/ref-station.json'))
meta['station-textless'] = {}
for name, tm in TL.items():
    img = ref.copy(); pt = np.array(Image.open('public/' + tm['file']).convert('RGB'))
    img[tm['y']:tm['y'] + tm['h'], tm['x']:tm['x'] + tm['w']] = pt
    alpha = np.zeros(ref.shape[:2], np.uint8)
    for l in L['layers']:
        if l['id'] not in PLAN['station']: continue
        if l['x'] > tm['x'] + tm['w'] or l['x'] + l['width'] < tm['x'] or l['y'] > tm['y'] + tm['h'] or l['y'] + l['height'] < tm['y']: continue
        method, *arg = PLAN['station'][l['id']]
        al = matte(img, bg, l, method, arg[0] if arg else None)
        src_a = np.array(Image.open('public/' + l['file']).convert('RGBA'))[..., 3]
        region = alpha[l['y']:l['y'] + l['height'], l['x']:l['x'] + l['width']]
        np.maximum(region, np.minimum(al, src_a), out=region)
    out = np.dstack([pt, alpha[tm['y']:tm['y'] + tm['h'], tm['x']:tm['x'] + tm['w']]])
    os.makedirs('public/ref/station/textless-matte', exist_ok=True)
    Image.fromarray(out, 'RGBA').save(f'public/ref/station/textless-matte/{name}.webp', lossless=True, quality=100, method=6, exact=True)
    meta['station-textless'][name] = f'ref/station/textless-matte/{name}.webp'
# 알림 표시를 지운 조각(실제 상태가 없을 때 쓰는 판): 글자 지운 패치를 붙인 화면에서 같은 방법으로 매트
BADGE_OF = {'profile': 'badge-profile', 'notice': 'badge-notice', 'menu': 'badge-menu', 'events': 'badge-events', 'training': 'badge-training',
            'exploration': 'badge-exploration', 'story': 'badge-story', 'formation': 'badge-formation', 'recruitment': 'badge-recruitment'}
meta['station-nobadge'] = {}
for lid, bname in BADGE_OF.items():
    tm = TL[bname]
    img = ref.copy(); img[tm['y']:tm['y'] + tm['h'], tm['x']:tm['x'] + tm['w']] = np.array(Image.open('public/' + tm['file']).convert('RGB'))
    l = next(x for x in L['layers'] if x['id'] == lid)
    method, *arg = PLAN['station'][lid]
    al = matte(img, bg, l, method, arg[0] if arg else None)
    src_a = np.array(Image.open('public/' + l['file']).convert('RGBA'))[..., 3]
    rgb = img[l['y']:l['y'] + l['height'], l['x']:l['x'] + l['width']]
    Image.fromarray(np.dstack([rgb, np.minimum(al, src_a)]), 'RGBA').save(f'public/ref/station/matte/{lid}-nobadge.webp', lossless=True, quality=100, method=6, exact=True)
    meta['station-nobadge'][lid] = f'ref/station/matte/{lid}-nobadge.webp'
json.dump(meta, open('src/game/data/ref-matte.json', 'w'), indent=1)
print('ok', {k: len(v) for k, v in meta.items()})
