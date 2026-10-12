"""진입 연출용 '밑판'을 만든다(캐릭터 상세).
조각이 늦게 날아 들어오는 동안 그 자리에 구멍(검은 바탕)이 보이지 않도록,
원본 화면에서 해당 조각들을 OpenCV 인페인트로 지운 픽셀만 남긴 이미지를 만든다(근사).
- bg-fill: 패널 밖 오른쪽 배경의 구멍(캐릭터 목록·UPGRADE 자리, 고정)
  (패널 안의 구멍은 단색 패널이라 화면에서 cd2-fill 사각형으로 채운다)
사용: python3 tools/build_motion_fill.py  (/tmp/claude-0/ref-detail.png 필요)"""
import json
import numpy as np, cv2
from PIL import Image

L = json.load(open('src/game/data/ref-detail.json'))
ref = cv2.imread('/tmp/claude-0/ref-detail.png')
H, W = ref.shape[:2]
ANIM = ['roster-prev', 'portrait-jian', 'portrait-02', 'portrait-03', 'portrait-04', 'portrait-05', 'portrait-06', 'roster-next', 'roster-frame',
        'identity-title', 'faction-emblem', 'level-up-arrow', 'level', 'role', 'stat-hp', 'stat-atk', 'stat-def', 'stat-crit-dmg', 'stat-crit-rate', 'stat-speed',
        'tab-stats', 'tab-skills', 'tab-gear', 'upgrade']
by = {l['id']: l for l in L['layers']}

# 남는 판(배경·패널)이 실제로 덮는 곳
cover = np.zeros((H, W), np.float32)
for lid in ('background-remainder', 'info-panel-remainder'):
    l = by[lid]
    a = np.array(Image.open('public/' + l['file']).convert('RGBA'))[..., 3].astype(np.float32) / 255
    sub = cover[l['y']:l['y'] + l['height'], l['x']:l['x'] + l['width']]
    sub[:] = 1 - (1 - sub) * (1 - a)
hole = ((cover < 0.98) * 255).astype(np.uint8)
hole[:, :914] = 0  # 왼쪽은 코드 그래픽 배경이 덮는다
anim = np.zeros((H, W), np.uint8)
for lid in ANIM:
    l = by[lid]
    a = np.array(Image.open('public/' + l['file']).convert('RGBA'))[..., 3]
    anim[l['y']:l['y'] + l['height'], l['x']:l['x'] + l['width']] |= (a > 0).astype(np.uint8) * 255
anim = cv2.dilate(anim, np.ones((5, 5), np.uint8))
need = cv2.bitwise_and(hole, anim)

# 지울 영역 = 움직이는 조각 전체(구멍 주변의 조각 픽셀까지 지워야 판 색이 이어진다)
erase = cv2.dilate(anim, np.ones((3, 3), np.uint8))
h2, w2 = H // 2, W // 2
small = cv2.inpaint(cv2.resize(ref, (w2, h2), interpolation=cv2.INTER_AREA), cv2.resize(erase, (w2, h2)), 9, cv2.INPAINT_TELEA)
up = cv2.resize(small, (W, H), interpolation=cv2.INTER_CUBIC)
fine = cv2.inpaint(ref, erase, 5, cv2.INPAINT_TELEA)
# 테두리 근처는 정밀 인페인트, 안쪽 넓은 곳은 축소 인페인트(얼룩 줄이기)
dist = cv2.distanceTransform((erase > 0).astype(np.uint8), cv2.DIST_L2, 5)
k = np.clip((dist - 4) / 10, 0, 1)[..., None]
filled = (fine * (1 - k) + up * k).astype(np.uint8)

meta = {}
P = by['info-panel-remainder']
in_panel = np.zeros((H, W), bool)
in_panel[P['y']:P['y'] + P['height'], P['x']:P['x'] + P['width']] = True
for name, m in (('bg-fill', need.astype(bool) & ~in_panel),):
    ys, xs = np.nonzero(m)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    alpha = (cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8))[y0:y1, x0:x1] * 255)
    rgba = np.dstack([cv2.cvtColor(filled[y0:y1, x0:x1], cv2.COLOR_BGR2RGB), alpha])
    Image.fromarray(rgba, 'RGBA').save(f'public/ref/detail/motion/{name}.webp', quality=90)
    meta[name] = {'x': int(x0), 'y': int(y0), 'w': int(x1 - x0), 'h': int(y1 - y0), 'file': f'ref/detail/motion/{name}.webp'}
json.dump(meta, open('src/game/data/detail-fill.json', 'w'), indent=1)
print(meta)
