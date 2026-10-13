"""S01 패스 화면 시안(1672×941)을 움직일 수 있는 조각으로 나눈다.
- hero: 왼쪽 센카 그림(패널 경계 모양으로 잘림)
- panel-plate: 오른쪽 종이 패널에서 움직이는 요소 자리를 지운 판(OpenCV 인페인트, 근사)
- 조각: 제목·탭·레벨 문양·보상 카드 5장·GET PREMIUM 버튼(시안 픽셀 그대로)
레벨 숫자·경험치 막대·Basic/Premium 탭·마일스톤 줄은 화면에서 실제 값으로 그린다.
배너: 로비 캐러셀용 S01 PASS 배너(2172×724 → 1060×353)
사용: python3 tools/build_pass_assets.py <패스 화면 png> <패스 배너 png>"""
import json, sys
import numpy as np, cv2
from PIL import Image

src, banner = sys.argv[1], sys.argv[2]
OUT = 'public/ref/pass'
img = cv2.imread(src)
H, W = img.shape[:2]

# 그림/패널 경계: 위쪽(탭 줄 위)은 x=836, 아래쪽(보상 카드 줄부터)은 x=772
edge = np.zeros((H, W), np.uint8)
edge[:272, :836] = 255
edge[272:, :772] = 255
art_mask = cv2.GaussianBlur(edge, (0, 0), 1.2)

SL = {  # 시안 픽셀 그대로 쓰는 조각 (x0, y0, x1, y1)
    'title': (884, 12, 1668, 134),
    'tabs': (880, 134, 1630, 201),
    'emblem': (866, 204, 936, 268),
    'card-senka': (780, 342, 1198, 594),
    'card-lobby': (1204, 342, 1642, 594),
    'card-icons': (772, 597, 1117, 809),
    'card-talk': (1121, 597, 1364, 809),
    'card-xmas': (1368, 597, 1642, 809),
    'premium': (1322, 828, 1658, 910),
}
LIVE = [(940, 214, 1090, 262), (1100, 228, 1625, 256), (776, 272, 1645, 337), (780, 830, 1310, 912)]  # 실제 값으로 다시 그리는 자리

hole = np.zeros((H, W), np.uint8)
for x0, y0, x1, y1 in list(SL.values()) + LIVE:
    hole[y0:y1, x0:x1] = 255
hole &= ~edge  # 그림 쪽은 건드리지 않음
small = cv2.inpaint(cv2.resize(img, (W // 2, H // 2), interpolation=cv2.INTER_AREA), cv2.resize(hole, (W // 2, H // 2), interpolation=cv2.INTER_NEAREST), 6, cv2.INPAINT_TELEA)
up = cv2.resize(small, (W, H), interpolation=cv2.INTER_CUBIC)
plate = img.copy(); plate[hole > 0] = up[hole > 0]
# 종이 결을 살짝 되살린다(인페인트 얼룩 완화): 글자 없는 종이 조각의 잡음 세기만큼 고운 잡음을 더함
noise = (img.astype(np.float32) - cv2.GaussianBlur(img, (0, 0), 3).astype(np.float32))
sd = float(noise[140:200, 842:866].std())
rng = np.random.default_rng(1)
grain = cv2.GaussianBlur(rng.normal(0, sd * 1.4, (H, W)).astype(np.float32), (0, 0), 0.7)[..., None]
plate = np.where(hole[..., None] > 0, np.clip(plate.astype(np.float32) + grain, 0, 255), plate).astype(np.uint8)

def rgba(bgr, a):
    return Image.fromarray(np.dstack([cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), a]), 'RGBA')

rgba(img[:, :860], art_mask[:, :860]).save(f'{OUT}/hero.webp', quality=90)
pa = 255 - art_mask
rgba(plate[:, 760:], pa[:, 760:]).save(f'{OUT}/panel-plate.webp', quality=88)

meta = {'plate': {'x': 760, 'y': 0, 'w': W - 760, 'h': H, 'file': f'ref/pass/panel-plate.webp'}, 'hero': {'x': 0, 'y': 0, 'w': 860, 'h': H, 'file': 'ref/pass/hero.webp'}}
for k, (x0, y0, x1, y1) in SL.items():
    crop = img[y0:y1, x0:x1].copy()
    if k == 'tabs':  # 파란 밑줄은 지우고 화면에서 움직이는 밑줄로 그린다
        c = crop.astype(int); m = ((c[..., 0] > 150) & (c[..., 2] < 140) & (c[..., 0] - c[..., 2] > 50)).astype(np.uint8) * 255
        m = cv2.dilate(m, np.ones((3, 3), np.uint8))
        crop = cv2.inpaint(crop, m, 3, cv2.INPAINT_TELEA)
    a = np.full(crop.shape[:2], 255, np.uint8)
    a[:, :] = 255 - edge[y0:y1, x0:x1] if k.startswith('card') else 255
    rgba(crop, a).save(f'{OUT}/{k}.webp', quality=92)
    meta[k] = {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'file': f'ref/pass/{k}.webp'}

b = Image.open(banner).convert('RGB')
b.resize((1060, round(1060 * b.height / b.width)), Image.LANCZOS).save(f'{OUT}/banner-s01.webp', quality=88)
json.dump(meta, open('src/game/data/ref-pass.json', 'w'), indent=1)
cv2.imwrite('/tmp/claude-0/cl/pass-plate-full.png', plate)
print('ok', list(meta))
