"""원본에서 글자·알림 표시만 지운 '글자 없는 패치'를 만든다(OpenCV 인페인트 근사).
동적 값이 원본과 다를 때 해당 영역을 이 패치로 덮고 그 위에 실제 HTML 텍스트를 올린다.
픽셀 동일한 원본이 아니라 원본에서 파생한 근사본이다.
사용: python3 tools/make_textless.py  (tools/build_ref2_assets.py 실행 후, /tmp/claude-0/ref-*.png 필요)"""
import json, os
import numpy as np, cv2

OUT = 'public/ref'

def masks(img, rect, kind, th=170):
    x, y, w, h = rect
    a = img[y:y + h, x:x + w].astype(int)
    b, g, r = a[..., 0], a[..., 1], a[..., 2]
    mn = a.min(axis=2); mx = a.max(axis=2)
    if kind == 'box':
        m = np.ones((h, w), np.uint8)
    elif kind == 'bright':
        m = (mn > th).astype(np.uint8)
    elif kind == 'value':  # 흰 숫자 + 주황 퍼센트
        m = ((mn > th) | ((r > 190) & (g > 90) & (b < 110))).astype(np.uint8)
    elif kind == 'ink':  # 어두운 바탕 위의 밝은 요소 전부(아이콘 포함)
        m = (mx > th).astype(np.uint8)
    elif kind == 'level':  # 흰 숫자, 회색 상한, 파란 경험치 막대
        m = ((mn > th) | ((b > 180) & (r < 90))).astype(np.uint8)
    elif kind == 'identity':  # 흰 글자 + 파란 사선
        m = ((mn > th) | ((b > 140) & (r < 100) & (b - r > 60))).astype(np.uint8)
    return m

def build(screen, items):
    img = cv2.imread(f'/tmp/claude-0/ref-{screen}.png')
    meta = {}
    for name, it in items.items():
        x, y, w, h = it['rect']
        full = np.zeros(img.shape[:2], np.uint8)
        for (mr, kind, *opt) in it['masks']:
            mx, my, mw, mh = mr
            full[my:my + mh, mx:mx + mw] |= masks(img, mr, kind, *(opt or []))
        k = it.get('dilate', 2)
        if k:
            full = cv2.dilate(full, np.ones((2 * k + 1, 2 * k + 1), np.uint8))
        res = cv2.inpaint(img, full * 255, it.get('radius', 5), cv2.INPAINT_TELEA)
        crop = res[y:y + h, x:x + w]
        os.makedirs(f'{OUT}/{screen}/textless', exist_ok=True)
        cv2.imwrite(f'{OUT}/{screen}/textless/{name}.webp', crop, [cv2.IMWRITE_WEBP_QUALITY, 95])
        meta[name] = {'x': x, 'y': y, 'w': w, 'h': h, 'file': f'ref/{screen}/textless/{name}.webp'}
        if it.get('sprite'):  # 지운 부분만 알파로 남긴 원본 조각(같은 표시를 다른 위치에 재사용)
            diff = (np.abs(img.astype(int) - res.astype(int)).max(axis=2) > 18).astype(np.uint8)[y:y + h, x:x + w]
            diff = cv2.dilate(diff, np.ones((3, 3), np.uint8))
            rgba = cv2.cvtColor(img[y:y + h, x:x + w], cv2.COLOR_BGR2BGRA); rgba[..., 3] = diff * 255
            cv2.imwrite(f'{OUT}/{screen}/textless/{name}-sprite.png', rgba)
            meta[name]['sprite'] = f'ref/{screen}/textless/{name}-sprite.png'
    return meta

def badge(x, y, w, h, pad=4):
    return {'rect': [x - pad - 4, y - pad - 4, w + 2 * pad + 8, h + 2 * pad + 8], 'masks': [([x - pad, y - pad, w + 2 * pad, h + 2 * pad], 'box')], 'dilate': 0, 'radius': 4}

STATION = {
    'gems-num': {'rect': [700, 26, 86, 40], 'masks': [([742, 28, 43, 36], 'bright', 160)]},
    'coins-num': {'rect': [900, 26, 146, 40], 'masks': [([975, 28, 64, 36], 'bright', 160)]},
    'profile-lv': {'rect': [24, 67, 54, 27], 'masks': [([25, 68, 52, 25], 'bright', 150)]},
    'profile-name': {'rect': [34, 89, 80, 31], 'masks': [([36, 90, 76, 29], 'bright', 150)]},
    'quest-text': {'rect': [1362, 124, 170, 36], 'masks': [([1366, 127, 162, 30], 'bright', 160)]},
    'attendance-timer': {'rect': [1561, 258, 74, 30], 'masks': [([1564, 260, 68, 26], 'bright', 175)]},
    'badge-profile': badge(99, 15, 31, 28, 3),
    'badge-notice': {**badge(1451, 27, 13, 13), 'sprite': True},
    'badge-menu': badge(1624, 27, 13, 13),
    'badge-events': badge(106, 364, 13, 12),
    'badge-exploration': badge(1590, 505, 32, 30, 3),
    'badge-training': badge(409, 704, 10, 9),
    'badge-formation': badge(708, 818, 12, 12),
    'badge-recruitment': badge(1139, 818, 11, 12),
    'badge-story': badge(1599, 687, 29, 29, 3),
}

STAT_ROWS = {'hp': (926, 480, 340, 57), 'atk': (1271, 480, 345, 57), 'def': (926, 537, 340, 53),
             'crit-dmg': (1271, 537, 345, 53), 'crit-rate': (926, 590, 340, 54), 'speed': (1271, 590, 345, 54)}
DETAIL = {
    'identity': {'rect': [930, 185, 445, 178], 'masks': [([930, 186, 445, 177], 'identity', 105)], 'dilate': 4, 'radius': 7},
    'level-text': {'rect': [950, 390, 245, 66], 'masks': [([955, 393, 236, 62], 'level', 110)], 'dilate': 2},
    'role-content': {'rect': [1318, 392, 290, 66], 'masks': [([1322, 395, 282, 60], 'ink', 95)], 'dilate': 2},
    'emblem': {'rect': [1335, 158, 288, 208], 'masks': [([1338, 164, 280, 198], 'ink', 60)], 'dilate': 3, 'radius': 9},
    'lobby-text': {'rect': [66, 834, 236, 52], 'masks': [([70, 836, 228, 48], 'bright', 160)], 'dilate': 2},
}
for k, (x, y, w, h) in STAT_ROWS.items():
    DETAIL[f'stat-{k}'] = {'rect': [x + 190, y + 6, w - 200, h - 12], 'masks': [([x + 192, y + 8, w - 204, h - 16], 'value', 170)], 'dilate': 2}

meta = {'station': build('station', STATION), 'detail': build('detail', DETAIL)}
json.dump(meta, open('src/game/data/ref-textless.json', 'w'), indent=0)
print('ok', sum(len(v) for v in meta.values()))
