"""복원 캐릭터(전신 RGBA)를 원본 편성 화면의 해당 인물 위치·크기에 맞춘다.
원본 가시영역 마스크 안에서 색 차이가 최소가 되는 배율·위치를 탐색한다(얼굴·어깨 기준 정렬 목적)."""
import json, sys, numpy as np, cv2
SL = sys.argv[1]  # slices/Ability-Kingdom-UI-Assets/formation
RS = sys.argv[2]  # restored/characters
ref = cv2.cvtColor(cv2.imread(f'{SL}/formation-reference.png'), cv2.COLOR_BGR2RGB).astype(np.float32)
L = {l['id']: l for l in json.load(open(f'{SL}/layout.json'))['layers']}
out = {}
for name in ['jian', 'yujin', 'harin', 'doyun']:
    l = L[f'character-{name}-visible']
    sl = cv2.imread(f"{SL}/{l['file']}", cv2.IMREAD_UNCHANGED)
    mask = np.zeros(ref.shape[:2], np.float32)
    mask[l['y']:l['y'] + l['height'], l['x']:l['x'] + l['width']] = (sl[:, :, 3] > 0)
    # 위쪽 60%(얼굴·상체)에 가중치
    top, bot = l['y'], l['y'] + l['height']
    w = np.zeros_like(mask); w[top:top + int((bot - top) * 0.6)] = 1.0; w[top + int((bot - top) * 0.6):bot] = 0.35
    rc = cv2.imread(f'{RS}/formation-{name}.png', cv2.IMREAD_UNCHANGED)
    rgb = cv2.cvtColor(rc[:, :, :3], cv2.COLOR_BGR2RGB).astype(np.float32); al = rc[:, :, 3].astype(np.float32) / 255
    ys, xs = np.nonzero(rc[:, :, 3] > 20); rtop, rbot = ys.min(), ys.max(); rcx = (xs.min() + xs.max()) / 2
    D = 4
    refs = cv2.resize(ref, (ref.shape[1] // D, ref.shape[0] // D), interpolation=cv2.INTER_AREA)
    ms = cv2.resize(mask, (mask.shape[1] // D, mask.shape[0] // D), interpolation=cv2.INTER_AREA)
    ws = cv2.resize(w * mask, (mask.shape[1] // D, mask.shape[0] // D), interpolation=cv2.INTER_AREA)
    best = None
    # 초기 추정: 머리 꼭대기 = 가시영역 위쪽, 가시 높이 / 전신 비율
    vis_h = l['height']
    for s in np.linspace(0.36, 0.86, 51):
        cw, ch = int(rc.shape[1] * s / D), int(rc.shape[0] * s / D)
        c_rgb = cv2.resize(rgb, (cw, ch), interpolation=cv2.INTER_AREA); c_al = cv2.resize(al, (cw, ch), interpolation=cv2.INTER_AREA)
        y0c = (top - rtop * s) / D; x0c = (l['x'] + l['width'] / 2 - rcx * s) / D
        for dy in range(-12, 13, 2):
            for dx in range(-24, 25, 2):
                x0, y0 = int(x0c + dx), int(y0c + dy)
                H, W = ms.shape
                xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + cw), min(H, y0 + ch)
                if xb <= xa or yb <= ya: continue
                cr = c_rgb[ya - y0:yb - y0, xa - x0:xb - x0]; ca = c_al[ya - y0:yb - y0, xa - x0:xb - x0]
                rr = refs[ya:yb, xa:xb]; mm = ws[ya:yb, xa:xb]
                wgt = mm * ca
                if wgt.sum() < 50: continue
                err = (np.abs(cr - rr).mean(axis=2) * wgt).sum() / wgt.sum()
                cover = 1 - (np.minimum(ca, ms[ya:yb, xa:xb]).sum() / max(1, ms.sum()))
                score = err + 60 * cover
                if best is None or score < best[0]: best = (score, s, x0 * D, y0 * D, err, cover)
    # 미세 조정(원 해상도 근처)
    score, s, x0, y0, err, cover = best
    out[name] = {'scale': round(float(s), 4), 'x': int(x0), 'y': int(y0), 'w': int(rc.shape[1] * s), 'h': int(rc.shape[0] * s),
                 'feetY': int(y0 + rbot * s), 'centerX': int(x0 + rcx * s), 'err': round(float(err), 2), 'uncovered': round(float(cover), 3)}
    print(name, out[name])
json.dump(out, open('/tmp/claude-0/fit.json', 'w'), indent=1)
