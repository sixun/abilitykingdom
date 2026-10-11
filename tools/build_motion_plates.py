"""캐릭터 영상 뒤에 깔 '인물 없는 원본 배경판'을 만든다.
원본 화면에서 기존 인물(원본 실루엣 ∪ 새 영상 전 프레임 실루엣) 자리를 OpenCV 인페인트로 지운다.
지운 자리는 대부분 새 인물 영상이 덮고, 영상 움직임 범위의 가장자리만 보인다(근사).
사용: python3 tools/build_motion_plates.py  (build_motion_assets.py 실행 후, /tmp/claude-0/ref-*.png 필요)"""
import json, os, subprocess
import numpy as np, cv2
from PIL import Image

FIT = json.load(open('src/game/data/motion-fit.json'))


def union_alpha(path):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], capture_output=True, check=True)
    fr = np.frombuffer(p.stdout, np.uint8).reshape(-1, 1080, 1080, 4)
    return fr[..., 3].max(axis=0)


def place(alpha, f, W, H):
    """영상 좌표의 알파를 화면 좌표로(배율 s, 위치 x,y)"""
    M = np.float32([[f['s'], 0, f['x']], [0, f['s'], f['y']]])
    return cv2.warpAffine(alpha, M, (W, H), flags=cv2.INTER_LINEAR)


def inpaint(img, hole, r=7):
    # 큰 구멍은 축소해서 채운 뒤 원래 크기로 올려 부드럽게
    h, w = hole.shape
    small = cv2.inpaint(cv2.resize(img, (w // 2, h // 2), interpolation=cv2.INTER_AREA), cv2.resize(hole, (w // 2, h // 2)), r, cv2.INPAINT_TELEA)
    up = cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)
    out = img.copy(); m = hole > 0; out[m] = up[m]
    return out


# ── 캐릭터 상세: 지안 자리 지우기
ref = cv2.imread('/tmp/claude-0/ref-detail.png')
H, W = ref.shape[:2]
new = place(union_alpha('public/motion/detail.webm'), FIT['detail'], W, H)
hole = (cv2.dilate((new > 30).astype(np.uint8), np.ones((9, 9), np.uint8)) * 255)
hole[:, 1000:] = 0
plate = inpaint(ref, hole)
L = json.load(open('src/game/data/ref-detail.json'))
os.makedirs('public/ref/detail/motion', exist_ok=True)
for lid in ('hero-artwork', 'background-remainder'):
    l = next(x for x in L['layers'] if x['id'] == lid)
    a = np.array(Image.open('public/' + l['file']))[..., 3]
    crop = plate[l['y']:l['y'] + l['height'], l['x']:l['x'] + l['width']]
    rgba = np.dstack([cv2.cvtColor(crop, cv2.COLOR_BGR2RGB), a])
    Image.fromarray(rgba, 'RGBA').save(f'public/ref/detail/motion/{lid}-plate.webp', quality=92)

# ── 영입: 리온 자리 지우기(원본 리온 ∪ 새 영상 리온)
ref = cv2.imread('/tmp/claude-0/ref-recruitment.png')
H, W = ref.shape[:2]
new = place(union_alpha('public/motion/recruit.webm'), FIT['recruit'], W, H)
old_rgba = np.array(Image.open('public/ref/restored/recruitment-rion.webp').convert('RGBA'))[..., 3]
of = FIT['recruit-old']
oldm = cv2.warpAffine(old_rgba, np.float32([[of['s'], 0, of['x']], [0, of['s'], of['y']]]), (W, H))
hole = ((cv2.dilate((new > 30).astype(np.uint8), np.ones((9, 9), np.uint8)) | cv2.dilate((oldm > 30).astype(np.uint8), np.ones((13, 13), np.uint8))) * 255).astype(np.uint8)
hole[716:] = 0
# 리온 자리는 복원 옥상 배경(인물 없음)으로 채우고 경계를 부드럽게 섞는다
rbg = cv2.cvtColor(np.array(Image.open('public/ref/restored/recruitment-bg.webp').convert('RGB')), cv2.COLOR_RGB2BGR)
k = cv2.GaussianBlur(hole.astype(np.float32) / 255, (0, 0), 4)[..., None]
plate = (ref * (1 - k) + rbg * k).astype(np.uint8)
L = json.load(open('src/game/data/ref-recruitment.json'))
l = next(x for x in L['layers'] if x['id'] == 'scene-remainder')
a = np.array(Image.open('public/' + l['file']))[..., 3]
crop = plate[l['y']:l['y'] + l['height'], l['x']:l['x'] + l['width']]
os.makedirs('public/ref/recruitment/motion', exist_ok=True)
Image.fromarray(np.dstack([cv2.cvtColor(crop, cv2.COLOR_BGR2RGB), a]), 'RGBA').save('public/ref/recruitment/motion/scene-plate.webp', quality=92)
cv2.imwrite('/tmp/claude-0/motion/recruit-plate-full.png', plate)
print('ok')

# 리온 자리와 겹치는 UI 조각: 그 부분만 투명하게(뒤의 새 리온 영상이 보이도록). 조각의 나머지 픽셀은 원본 그대로
kf = cv2.GaussianBlur(hole.astype(np.float32) / 255, (0, 0), 2)
L = json.load(open('src/game/data/ref-recruitment.json'))
cut = {}
for l in L['layers']:
    if l['id'] in ('scene-remainder', 'bottom-bar-remainder') or l['id'].startswith(('info-', 'pull-', 'currency-')): continue
    x, y, w, h = l['x'], l['y'], l['width'], l['height']
    k = kf[y:y + h, x:x + w]
    if k.max() < 0.05: continue
    src = np.array(Image.open('public/' + l['file']).convert('RGBA'))
    src[..., 3] = (src[..., 3] * (1 - k)).astype(np.uint8)
    Image.fromarray(src, 'RGBA').save(f'public/ref/recruitment/motion/{l["id"]}.webp', lossless=True, quality=100, method=6, exact=True)
    cut[l['id']] = f'ref/recruitment/motion/{l["id"]}.webp'
json.dump(cut, open('src/game/data/recruit-cut.json', 'w'), indent=1)
print('recruit cut', list(cut))
