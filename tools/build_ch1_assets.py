"""1장 전투 그림 정리: 배경판 2장(골목·변전소), 적(잠식충·보스 스태틱), 소품 3종(중계기·셔터 장치·결정 기둥).
원본은 tools/ch1_src/ (Creative Claw 생성). 투명 그림은 여백을 잘라내고 발 위치(아래쪽 중심)를 기록한다."""
import json, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools/ch1_src')
OUT = os.path.join(ROOT, 'public/ref/ch1')
os.makedirs(OUT, exist_ok=True)
meta = {}

for name in ['alley', 'substation']:
    im = Image.open(os.path.join(SRC, name + '.jpg')).convert('RGB').resize((1920, 1080), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), quality=84)
    meta[name] = f'ref/ch1/{name}.webp'

def trim(im, pad=6):
    a = im.getchannel('A').point(lambda v: 255 if v > 24 else 0)
    x0, y0, x1, y1 = a.getbbox()
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))

def foot(im):
    a = im.getchannel('A'); w, h = im.size; px = a.load()
    bottom = next(y for y in range(h - 1, 0, -1) if sum(1 for x in range(w) if px[x, y] > 128) > 3)
    xs = [x for y in range(int(bottom - h * 0.08), bottom + 1) for x in range(w) if px[x, y] > 128]
    return ((min(xs) + max(xs)) / 2, bottom)  # 아래 8% 구간의 가로 중심(다리가 벌어져도 가운데)

def save_sprite(key, im, target_h):
    im = trim(im)
    s = min(1.0, target_h * 2 / im.height)  # 화면 표시 크기의 2배 해상도로 저장
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(os.path.join(OUT, key + '.webp'), quality=90, method=6)
    fx, fy = foot(im)
    meta[key] = {'file': f'ref/ch1/{key}.webp', 'w': im.width, 'h': im.height, 'ax': round(fx), 'ay': round(fy), 'dispH': target_h}

save_sprite('mite', Image.open(os.path.join(SRC, 'mite.png')).convert('RGBA'), 92)
save_sprite('boss', Image.open(os.path.join(SRC, 'boss.png')).convert('RGBA'), 330)

# 소품 3종: 알파가 있는 열 구간으로 나눈다
props = Image.open(os.path.join(SRC, 'props.png')).convert('RGBA')
a = props.getchannel('A'); w, h = props.size; px = a.load()
cols = [any(px[x, y] > 24 for y in range(0, h, 2)) for x in range(w)]
runs, x = [], 0
while x < w:
    if cols[x]:
        s0 = x
        while x < w and cols[x]: x += 1
        runs.append((s0, x))
    x += 1
runs = [r for r in runs if r[1] - r[0] > 40]
# 가까운 구간 합치기
merged = []
for r in runs:
    if merged and r[0] - merged[-1][1] < 30: merged[-1] = (merged[-1][0], r[1])
    else: merged.append(r)
assert len(merged) == 3, merged
for key, (x0, x1), th in zip(['relay', 'shutter', 'pylon'], merged, [150, 112, 190]):
    save_sprite(key, props.crop((x0, 0, x1, h)), th)

with open(os.path.join(ROOT, 'src/game/data/ch1-sprites.json'), 'w') as f:
    json.dump(meta, f, ensure_ascii=False, indent=1)
print(json.dumps(meta, ensure_ascii=False))
