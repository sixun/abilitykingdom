import sys, os, glob, numpy as np, cv2
from PIL import Image
R = '/home/claude/in_chars/Ability-Kingdom-Character-Additions/references/'
OUT = '/tmp/claude-0/cut/out'; os.makedirs(OUT, exist_ok=True)

def c2a(c, b):
    # GIMP식 color-to-alpha: 균일 배경 b 위의 픽셀 c를 만드는 최소 알파
    up = np.where(c > b, (c - b) / np.maximum(1 - b, 1e-3), 0)
    dn = np.where(c < b, (b - c) / np.maximum(b, 1e-3), 0)
    return np.clip(np.maximum(up, dn).max(axis=2), 0, 1)

def bg_field(img, m):
    # 모델 마스크 밖(배경)만으로 부드러운 배경 색 면을 만든다(그라데이션 대응)
    h, w = m.shape
    hole = (cv2.dilate((m > 0.03).astype(np.uint8), np.ones((25, 25), np.uint8)) * 255)
    s = 4
    small = cv2.inpaint(cv2.resize(img, (w // s, h // s), interpolation=cv2.INTER_AREA), cv2.resize(hole, (w // s, h // s), interpolation=cv2.INTER_NEAREST), 15, cv2.INPAINT_TELEA)
    small = cv2.GaussianBlur(small, (0, 0), 6)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)

for f in sorted(glob.glob(R + '*/*')):
    name = f.split('/')[-2] + '-' + os.path.basename(f).split('.')[0]
    img = cv2.imread(f, cv2.IMREAD_COLOR)
    m = cv2.imread(f'/tmp/claude-0/cut/{name}-mask.png', 0).astype(np.float32) / 255
    c = img.astype(np.float32) / 255
    mm = np.clip((m - 0.08) / 0.8, 0, 1)
    if 'swordswoman' in name:
        # 체크무늬 배경: 실제 주기·색을 맞춘 체크무늬 판(checker2.fit2)을 배경으로 보고 color-to-alpha
        b = np.load(f"/tmp/claude-0/cut/chk-{name.split('swordswoman-')[1]}.npy").astype(np.float32)
        a2 = c2a(c, b)
        a2 = np.clip((a2 - 0.10) / 0.90, 0, 1)
        L = c.mean(axis=2); sat = c.max(axis=2) - c.min(axis=2)
        # 머리카락 사이로 보이는 체크무늬 칸(예상 배경색과 거의 같은 밝은 무채색)은 모델 마스크 안이어도 지운다
        match = (np.abs(c - b).max(axis=2) < 0.045) & (L > 0.74) & (sat < 0.06)
        match = cv2.morphologyEx(match.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
        mm = np.where(match, 0, mm)
        a2 = np.where(match, 0, a2)
    else:
        b = bg_field(img, m).astype(np.float32) / 255
        a2 = c2a(c, b)
        if 'kiyomi' in name:
            # 푸른 불꽃: 배경보다 밝거나 푸른 쪽만 효과로 살리고, 바깥의 어두운 얼룩(배경 그림자)은 버린다
            up = np.where(c > b, (c - b) / np.maximum(1 - b, 1e-3), 0).max(axis=2)
            up = np.clip((up - 0.16) / 0.84, 0, 1)
            nb, lb, sb, _ = cv2.connectedComponentsWithStats((mm > 0.5).astype(np.uint8), 8)
            body = lb == (1 + int(np.argmax(sb[1:, cv2.CC_STAT_AREA])))
            body = cv2.dilate(body.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
            a2 = np.where(body, a2, up)
            mm = np.where(body, mm, np.minimum(mm, up))
        t = 0.07
        a2 = np.clip((a2 - t) / (1 - t), 0, 1)
    # 모델 바깥으로 멀리 떨어진 작은 잡티 제거(연결 성분이 작으면 지움)
    alpha = np.maximum(mm, a2)
    bin_ = (alpha > 0.15).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(bin_, 8)
    keep = np.zeros(n, bool); keep[1:] = st[1:, cv2.CC_STAT_AREA] >= (300 if 'swordswoman' in name else 60)
    alpha = alpha * keep[lab] + alpha * (lab == 0) * 0
    alpha = np.where(lab == 0, np.where(alpha > 0.15, 0, alpha), alpha)
    # 배경 색 빼기(테두리 번짐 제거)
    a3 = np.maximum(alpha, 1e-3)[..., None]
    fg = np.clip((c - (1 - a3) * b) / a3, 0, 1)
    fg = np.where(alpha[..., None] > 0.97, c, fg)
    rgba = np.dstack([cv2.cvtColor((fg * 255).astype(np.uint8), cv2.COLOR_BGR2RGB), (alpha * 255).astype(np.uint8)])
    ys, xs = np.nonzero(alpha > 0.04)
    x0, y0, x1, y1 = max(xs.min() - 4, 0), max(ys.min() - 4, 0), min(xs.max() + 5, img.shape[1]), min(ys.max() + 5, img.shape[0])
    Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA').save(f'{OUT}/{name}.png')
    print(name, (x0, y0, x1, y1))
