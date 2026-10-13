"""직접 조작 영입 연출용 소품(카드팩·캡슐 기계·회전추첨기·쿠지 상자·쿠지 종이)을 게임용 조각으로 나눈다.
원본: Creative Claw gpt-image-2.5-flare(투명 배경)로 만든 그림(tools/pull_props/*.png, 스토리보드 4장 참고).
- pack: 몸통 / 위 절취 띠(절취선 y에서 분리)
- capsule: 기계(손잡이 원판 자리는 그대로) / 손잡이 원판(원형으로 따냄 → 돌림)
- lottery: 통 앞판(팔각, 받침 기둥·축·손잡이에 가려진 곳은 팔각 대칭(45°)으로 돌린 그림에서 채움) / 받침·트레이 / 축+손잡이
- kujibox, ticket: 그대로(투명 여백만 잘라 냄)
결과: public/ref/pull/*.webp, src/game/data/pull-props.json(저장 그림 좌표 기준)
사용: python3 tools/build_pull_props.py"""
import json, os
import numpy as np, cv2
from PIL import Image

SRC = 'tools/pull_props'
OUT = 'public/ref/pull'
os.makedirs(OUT, exist_ok=True)
meta = {}


def load(n):
    return np.asarray(Image.open(f'{SRC}/{n}.png').convert('RGBA')).copy()


def save(name, arr, scale, crop=None):
    """arr: RGBA(원본 좌표). crop=(x0,y0,x1,y1) 원본 좌표, 없으면 알파 bbox. 반환: 저장 크기·원점"""
    if crop is None:
        ys, xs = np.nonzero(arr[..., 3] > 4)
        crop = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    x0, y0, x1, y1 = crop
    im = Image.fromarray(arr[y0:y1, x0:x1], 'RGBA')
    w, h = round((x1 - x0) * scale), round((y1 - y0) * scale)
    im.resize((w, h), Image.LANCZOS).save(f'{OUT}/{name}.webp', quality=90)
    return {'file': f'ref/pull/{name}.webp', 'w': w, 'h': h, 'ox': x0, 'oy': y0, 's': scale}


def to(m, x, y):  # 원본 좌표 → 저장 그림 좌표
    return [round((x - m['ox']) * m['s'], 1), round((y - m['oy']) * m['s'], 1)]


# ── 카드팩 ──
pk = load('pack'); S = 0.7; TEAR = 252
full = save('pack', pk, S)
body = pk.copy(); body[:TEAR, :, 3] = 0
strip = pk.copy(); strip[TEAR:, :, 3] = 0
crop = (full['ox'], full['oy'], full['ox'] + round(full['w'] / S), full['oy'] + round(full['h'] / S))
b = save('pack-body', body, S, crop); st = save('pack-strip', strip, S, crop)
meta['pack'] = {'body': b['file'], 'strip': st['file'], 'w': b['w'], 'h': b['h'], 'tearY': to(b, 0, TEAR)[1]}
os.remove(f'{OUT}/pack.webp')

# ── 캡슐 기계 ──
cp = load('capsule'); S = 0.8; KX, KY, KR = 656, 585, 121
m = save('capsule', cp, S)
knob = np.zeros_like(cp)
cm = np.zeros(cp.shape[:2], np.uint8); cv2.circle(cm, (KX, KY), KR, 255, -1, cv2.LINE_AA)
knob[...] = cp; knob[..., 3] = (cp[..., 3].astype(np.int32) * cm // 255).astype(np.uint8)
k = save('capsule-knob', knob, S, (KX - KR, KY - KR, KX + KR + 1, KY + KR + 1))
meta['capsule'] = {'file': m['file'], 'w': m['w'], 'h': m['h'], 'knob': {'file': k['file'], 'c': to(m, KX, KY), 'r': round(KR * S, 1)},
                   'chute': to(m, 215, 600) + to(m, 440, 865)}

# ── 회전추첨기 ──
lt = load('lottery'); S = 0.8; CX, CY = 501, 367
OCT = np.array([(365, 85), (640, 85), (793, 240), (793, 490), (640, 648), (365, 648), (212, 490), (212, 240)], np.int32)
octm = np.zeros(lt.shape[:2], np.uint8); cv2.fillPoly(octm, [OCT], 255, cv2.LINE_AA)
hsv = cv2.cvtColor(np.ascontiguousarray(lt[..., :3]), cv2.COLOR_RGB2HSV).astype(np.int32)
# 앞에 놓인 것들: 받침 기둥(축 아래), 축 원판, 손잡이 팔(채도 낮은 쇠) + 손잡이(팔각 밖)
pole = np.zeros_like(octm); pole[420:660, 462:540] = 255
hub = np.zeros_like(octm); cv2.circle(hub, (CX, CY), 80, 255, -1, cv2.LINE_AA)
band = np.zeros_like(octm); cv2.fillPoly(band, [np.array([(520, 330), (830, 300), (1000, 300), (1000, 470), (800, 470), (600, 470), (520, 420)], np.int32)], 255)
steel = ((hsv[..., 1] < 70) & (lt[..., 3] > 100)).astype(np.uint8) * 255
arm = cv2.morphologyEx(steel & band, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
handle = np.zeros_like(octm); handle[300:420, 790:1005] = 255; handle &= (lt[..., 3] > 4).astype(np.uint8) * 255
crank = hub | arm | handle
crank = cv2.dilate(crank, np.ones((3, 3), np.uint8))
# 통 앞판: 축·기둥·손잡이를 지운 앞판 그림(같은 모델로 편집해 만든 lottery-drum.png)을 원래 팔각 자리에 맞춰 늘려 씀
dn = np.asarray(Image.open(f'{SRC}/lottery-drum.png').convert('RGBA'))
ys, xs = np.nonzero(dn[..., 3] > 20)
ys2, xs2 = np.nonzero(octm > 128)
sx = (xs2.max() - xs2.min()) / (xs.max() - xs.min()); sy = (ys2.max() - ys2.min()) / (ys.max() - ys.min())
A = np.float32([[sx, 0, xs2.min() - xs.min() * sx], [0, sy, ys2.min() - ys.min() * sy]])
drum = cv2.warpAffine(dn, A, (lt.shape[1], lt.shape[0]), flags=cv2.INTER_AREA)
crank_a = lt.copy(); crank_a[..., 3] = (lt[..., 3].astype(np.int32) * cv2.GaussianBlur(crank, (0, 0), .7) // 255).astype(np.uint8)
stand_a = lt.copy(); keep = ((cv2.dilate(octm, np.ones((5, 5), np.uint8)) < 128) | (pole > 0)) & (crank == 0)
stand_a[..., 3] = np.where(keep, lt[..., 3], 0).astype(np.uint8)
whole = save('lottery-full', lt, S)
crop = (whole['ox'], whole['oy'], whole['ox'] + round(whole['w'] / S), whole['oy'] + round(whole['h'] / S))
d = save('lottery-drum', drum, S, crop); sd = save('lottery-stand', stand_a, S, crop); ck = save('lottery-crank', crank_a, S, crop)
os.remove(f'{OUT}/lottery-full.webp')
meta['lottery'] = {'drum': d['file'], 'stand': sd['file'], 'crank': ck['file'], 'w': d['w'], 'h': d['h'], 'axle': to(d, CX, CY),
                   'exit': to(d, 640, 642), 'tray': to(d, 230, 760) + to(d, 790, 830)}

# ── 쿠지 상자·종이 ──
kb = load('kujibox'); m = save('kujibox', kb, 0.72)
meta['kujibox'] = {'file': m['file'], 'w': m['w'], 'h': m['h'], 'open': to(m, 300, 200) + to(m, 1330, 560)}
tk = load('ticket'); m = save('ticket', tk, 0.55)
meta['ticket'] = {'file': m['file'], 'w': m['w'], 'h': m['h']}

json.dump(meta, open('src/game/data/pull-props.json', 'w'), indent=1)
print(json.dumps(meta, indent=1))
