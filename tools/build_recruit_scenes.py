"""새 영입 배너 3종(SERENITY·NIGHT SHIFT·ONE MORE PLAY?) 시안(1672×941)을 움직일 수 있는 조각으로 나눈다.
- base: 장면. 인물·제목·이름표·목록·위 UI·뽑기 장치 자리는 지우고(OpenCV 인페인트, 근사), 아래 바 자리는 위 장면을 뒤집어 흐리게 채운다
- char: 인물(애니메 분할 모델 isnet-anime 마스크). 이름표·뽑기 장치와 겹친 곳은 인물 쪽 픽셀로 메움
- title*: 제목 글자만 알파로 따냄(색·밝기 차이 + 연결 요소 거르기)
- tag, list0~3, back, tabs, faces, gems, tickets: 사각 조각(가장자리 부드럽게). 재화 숫자는 지우고 화면에서 실제 값으로 그린다
- bar: 아래 바 판(교환소·포인트·선물·장치·버튼 자리를 지움) + exchange, points(숫자·막대 지움), gift, pull1, pull10
- dev*: 뽑기 장치(GrabCut). 캡슐 기계는 손잡이 원판(knob), 추첨기는 통+손잡이(drum)와 받침(stand), 쿠지는 접힌 종이(flap)와 나머지(paper)
- 썸네일: 목록에서 고르지 않은 상태의 배너 조각(주파수 너머 화면의 목록 교체용)
- 새 캐릭터 에셋(세렌·이안·채린): 인물 조각 → stand/action/portrait/상세 아트
사용: python3 tools/build_recruit_scenes.py <시안 폴더(serenity.png, nightshift.png, omp.png)> [디버그 폴더]"""
import json, os, sys
import numpy as np, cv2
import onnxruntime as ort
from PIL import Image

SRC = sys.argv[1]
DBG = sys.argv[2] if len(sys.argv) > 2 else None
MODEL = '/tmp/claude-0/models/isnet-anime.onnx'  # https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx
W, H = 1672, 941

FACE = {'seren': (1214, 228, 270), 'ian': (1206, 204, 244), 'chaerin': (1262, 192, 236)}  # 얼굴 중심(x, y)·정사각 크기(시안 좌표)
C = {
    'serenity': dict(char_id='seren', bar=820, charbox=(880, 40, 1672, 830),
        titles={'title': ((400, 292, 792, 374), 'light'), 'title-line': ((400, 372, 792, 412), 'light')},
        tag=(392, 596, 704, 660),
        back=(16, 14, 260, 86), tabs=(326, 18, 776, 82), faces=(786, 18, 1168, 80), gems=(1222, 20, 1428, 66), tickets=(1442, 20, 1650, 66),
        gems_num=(1290, 27, 1394, 60), tickets_num=(1528, 27, 1584, 60),
        list=[(20, 108, 302, 230), (12, 232, 326, 360), (20, 364, 302, 475), (20, 485, 302, 594)],
        exchange=(32, 838, 233, 908), points=(286, 836, 712, 910), gift=(718, 836, 800, 910),
        points_num=(408, 840, 528, 880), points_bar=(296, 878, 702, 900),
        pull1=(1045, 836, 1313, 915), pull10=(1321, 834, 1653, 916), hint=(942, 832, 1040, 896),
        dev=(798, 754, 947, 929), dev_kind='capsule', knob=(898, 875, 25)),
    'nightshift': dict(char_id='ian', bar=814, charbox=(700, 0, 1672, 830), char_cut=[(0, 0, 800, 380), (0, 0, 756, 941)],
        titles={'title': ((325, 292, 748, 656), 'night')},
        tag=(1324, 558, 1656, 630),
        back=(8, 14, 254, 86), tabs=(320, 12, 748, 80), gems=(1203, 20, 1410, 68), tickets=(1423, 20, 1638, 68),
        gems_num=(1272, 28, 1360, 62), tickets_num=(1512, 28, 1566, 62),
        list=[(10, 98, 292, 217), (10, 223, 292, 335), (4, 340, 300, 458), (10, 461, 288, 567)],
        exchange=(28, 838, 237, 908), points=(286, 836, 726, 912), gift=(734, 836, 818, 910),
        points_num=(406, 842, 518, 878), points_bar=(298, 878, 708, 900),
        pull1=(945, 835, 1241, 915), pull10=(1258, 832, 1648, 918),
        dev=(762, 714, 944, 928), dev_kind='lottery', dev_cut=(0, 832, 820, 941), no_fill_above=852, axle=(863, 790), drum_bottom=848),
    'omp': dict(char_id='chaerin', bar=828, charbox=(900, 60, 1672, 845),
        titles={'title': ((350, 228, 915, 382), 'red'), 'title2': ((388, 378, 868, 530), 'red')},
        tag=(376, 550, 720, 616),
        back=(22, 16, 266, 88), tabs=(320, 22, 763, 83), faces=(782, 22, 1163, 83), gems=(1210, 22, 1418, 70), tickets=(1436, 22, 1650, 70),
        gems_num=(1280, 31, 1380, 64), tickets_num=(1540, 31, 1590, 64),
        list=[(18, 106, 302, 230), (18, 236, 300, 347), (18, 355, 300, 463), (12, 466, 308, 583)],
        exchange=(28, 846, 240, 915), points=(282, 844, 636, 918), gift=(634, 844, 718, 916),
        points_num=(400, 848, 505, 886), points_bar=(294, 878, 628, 900),
        pull1=(1015, 843, 1268, 916), pull10=(1279, 840, 1653, 919), hint=(902, 840, 990, 912),
        dev=(738, 832, 904, 922), dev_kind='peel', flap=(826, 833, 903, 905)),
}

sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0]


def seg(rgb):
    h, w = rgb.shape[:2]
    x = cv2.resize(rgb, (1024, 1024), interpolation=cv2.INTER_CUBIC).astype(np.float32) / 255. - 0.5
    out = sess.run(None, {inp.name: x.transpose(2, 0, 1)[None]})[0][0, 0]
    out = (out - out.min()) / (out.max() - out.min() + 1e-8)
    return cv2.resize((out * 255).astype(np.uint8), (w, h), interpolation=cv2.INTER_CUBIC)


def rgba(bgr, a):
    return Image.fromarray(np.dstack([cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), a]), 'RGBA')


def feather(h, w, e=2.5):
    m = np.zeros((h, w), np.uint8); m[3:-3, 3:-3] = 255
    return cv2.GaussianBlur(m, (0, 0), e)


def big_inpaint(img, hole, q=3, r=7):
    sm = cv2.inpaint(cv2.resize(img, (W // q, H // q), interpolation=cv2.INTER_AREA), cv2.dilate(cv2.resize(hole, (W // q, H // q), interpolation=cv2.INTER_NEAREST), np.ones((3, 3), np.uint8)), r, cv2.INPAINT_TELEA)
    up = cv2.GaussianBlur(cv2.resize(sm, (W, H), interpolation=cv2.INTER_CUBIC), (0, 0), 2)
    out = img.copy(); out[hole > 0] = up[hole > 0]
    return out


def title_mask(img, box, mode):
    x0, y0, x1, y1 = box
    c = img[y0:y1, x0:x1].astype(np.int32)
    b, g, r = c[..., 0], c[..., 1], c[..., 2]
    lum = (0.11 * b + 0.59 * g + 0.3 * r)
    bl = cv2.GaussianBlur(lum.astype(np.float32), (0, 0), 9)
    if mode == 'light':  # 어두운 배경 위 흰 글자
        d = np.clip((lum - bl - 14) / 30, 0, 1) * (lum > 140)
    elif mode == 'night':  # 크림색 글자 + 주황 틀
        cream = (lum > 175) & (np.abs(r - b) < 70)
        orange = (r > 170) & (g > 70) & (g < 160) & (b < 110)
        d = (cream | orange).astype(np.float32)
    else:  # 'red': 빨간 글자 + 짙은 청록 그림자
        red = (r > 175) & (g < 120) & (b < 110)
        near = cv2.dilate(red.astype(np.uint8), np.ones((19, 19), np.uint8)) > 0
        teal = near & (lum < 135) & (g >= r - 5) & (b >= r - 10)
        white = (cv2.dilate(red.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & (lum > 200) & (np.abs(r - b) < 40)
        d = (red | teal | white).astype(np.float32)
    m = (d > 0.35).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if st[i, 4] >= (150 if mode != 'light' else 12): keep[lab == i] = 1
    if mode != 'light':
        keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    a = np.maximum(d * cv2.dilate(keep, np.ones((3, 3), np.uint8)), keep).astype(np.float32)
    return (cv2.GaussianBlur(a, (0, 0), 0.6) * 255).astype(np.uint8)


def grabcut(img, box, iters=6):
    x0, y0, x1, y1 = box
    m = np.zeros(img.shape[:2], np.uint8)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, m, (x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4), bgd, fgd, iters, cv2.GC_INIT_WITH_RECT)
    return np.where((m == cv2.GC_FGD) | (m == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)


meta_all = {}
thumbs = {}
for name, c in C.items():
    OUT = f'public/ref/recruit/{name}'
    os.makedirs(OUT, exist_ok=True)
    img = cv2.imread(f'{SRC}/{name}.png')
    meta = {}

    def save(k, bgr, a, x0, y0, q=90, trim=True):
        if trim:
            ys, xs = np.nonzero(a > 6)
            bx0, by0, bx1, by1 = max(0, xs.min() - 1), max(0, ys.min() - 1), min(a.shape[1], xs.max() + 2), min(a.shape[0], ys.max() + 2)
        else:
            bx0, by0, bx1, by1 = 0, 0, a.shape[1], a.shape[0]
        rgba(bgr[by0:by1, bx0:bx1], a[by0:by1, bx0:bx1]).save(f'{OUT}/{k}.webp', quality=q)
        meta[k] = {'x': int(x0 + bx0), 'y': int(y0 + by0), 'w': int(bx1 - bx0), 'h': int(by1 - by0), 'file': f'ref/recruit/{name}/{k}.webp'}

    hole = np.zeros((H, W), np.uint8)
    BAR = c['bar']

    # ── 뽑기 장치(아래 바 위로 솟은 부분 포함) ──
    dx0, dy0, dx1, dy1 = c['dev']
    dm = grabcut(img, c['dev'])
    dm[:dy0] = 0; dm[dy1:] = 0; dm[:, :dx0] = 0; dm[:, dx1:] = 0
    dm = cv2.morphologyEx(dm, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(dm, 8)
    if n > 1:
        big = 1 + int(np.argmax(st[1:, 4])); dm = np.where(lab == big, 255, 0).astype(np.uint8)
    dm = cv2.morphologyEx(dm, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    # 바 위(아이보리 바탕): 바탕색과 다른 픽셀 + 윤곽 안쪽 채우기로 다시 잡는다(흰 공·흰 종이 포함)
    ivory = np.median(img[BAR + 6:BAR + 14, 236:282].reshape(-1, 3), 0)
    reg = img[BAR:dy1, dx0:dx1].astype(np.int32)
    diff = (np.abs(reg - ivory).max(2) > c.get('ivory_t', 22)).astype(np.uint8) * 255
    diff = cv2.morphologyEx(diff, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    ff = diff.copy(); hh, ww = ff.shape
    pad = np.zeros((hh + 2, ww + 2), np.uint8)
    flood = ff.copy(); cv2.floodFill(flood, pad, (0, hh - 1), 255)
    filled = diff | cv2.bitwise_not(flood)
    if 'no_fill_above' in c:  # 추첨기: 통·손잡이·받침 사이에 갇힌 바탕은 채우지 않음(트레이 안 흰 공만 채움)
        cut = c['no_fill_above'] - BAR
        filled[:cut] = diff[:cut]
    lower = np.zeros_like(dm); lower[BAR:dy1, dx0:dx1] = filled
    if 'dev_cut' in c: x0, y0, x1, y1 = c['dev_cut']; lower[y0:y1, x0:x1] = 0
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(lower, 8)
    keep2 = np.zeros_like(lower)
    for i in range(1, n2):
        if st2[i, 4] > 400: keep2[lab2 == i] = 255
    dm[BAR:] = 0
    dm = np.maximum(dm, keep2)
    dm = cv2.morphologyEx(dm, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    dsoft = cv2.GaussianBlur(dm, (0, 0), 0.8)
    hole |= cv2.dilate(dm, np.ones((9, 9), np.uint8))

    # ── 인물 ──
    bx0, by0, bx1, by1 = c['charbox']
    cm = np.zeros((H, W), np.uint8)
    cm[by0:by1, bx0:bx1] = seg(cv2.cvtColor(img[by0:by1, bx0:bx1], cv2.COLOR_BGR2RGB))
    cm[BAR:] = 0
    for x0, y0, x1, y1 in c.get('char_cut', []): cm[y0:y1, x0:x1] = 0
    # 위 UI(재화 등)가 인물(머리카락) 위에 놓인 곳: 모델은 UI까지 인물로 잡으므로, 위아래 인물 마스크를 이어 붙이고 픽셀은 인페인트
    ui = np.zeros((H, W), np.uint8)
    for key in ('back', 'tabs', 'faces', 'gems', 'tickets'):
        if key not in c: continue
        x0, y0, x1, y1 = c[key]
        above = cm[max(0, y0 - 3), x0:x1].astype(np.int32) if y0 >= 3 else np.zeros(x1 - x0, np.int32)
        below = cm[min(H - 1, y1 + 3), x0:x1].astype(np.int32)
        above = np.where(above > 200, above, 0); below = np.where(below > 200, below, 0)
        t = np.linspace(0, 1, y1 - y0)[:, None]  # 위 → 아래로 이어지게(위가 비어 있으면 위로 갈수록 옅어짐)
        cm[y0:y1, x0:x1] = (above[None, :] * (1 - t) + below[None, :] * np.clip((t - 0.55) / 0.45, 0, 1) ** 1.5).astype(np.uint8)
        bx0, by0, bx1, by1 = max(0, x0 - 16), max(0, y0 - 16), min(W, x1 + 16), min(H, y1 + 8)
        cm[by0:by1, bx0:bx1] = np.minimum(cm[by0:by1, bx0:bx1], cv2.GaussianBlur(cm[by0:by1, bx0:bx1], (0, 0), 7))
        ui[y0:y1, x0:x1] = 255
    cm[dm > 0] = 0
    over = ui & ((cm > 60).astype(np.uint8) * 255)  # 인물 위에 놓인 UI(이름표·재화) 자리: 인물 쪽 픽셀로 메움
    tagm = np.zeros((H, W), np.uint8)
    x0, y0, x1, y1 = c['tag']; tagm[y0:y1, x0:x1] = 255
    tagm &= cv2.dilate((cm > 100).astype(np.uint8) * 255, np.ones((41, 41), np.uint8))
    if tagm.any():
        ring = cv2.dilate(tagm, np.ones((15, 15), np.uint8))
        closed = cv2.morphologyEx(cm, cv2.MORPH_CLOSE, np.ones((61, 61), np.uint8))
        cm = np.where(ring > 0, np.maximum(cm, closed), cm)
    over |= tagm
    cfill = cv2.inpaint(img, cv2.dilate(over, np.ones((3, 3), np.uint8)), 9, cv2.INPAINT_TELEA) if over.any() else img.copy()
    for key in ('back', 'tabs', 'faces', 'gems', 'tickets'):  # 위 UI 밑 인물 픽셀: 바로 아래 줄 색을 위로 늘여 씀(머리카락이 이어지게)
        if key not in c: continue
        x0, y0, x1, y1 = c[key]
        ry = min(H - 1, y1 + 3)
        cfill[y0:y1, x0:x1] = cv2.GaussianBlur(np.repeat(img[ry:ry + 1, x0:x1], y1 - y0, 0), (0, 0), 1.5)
    ca = cv2.GaussianBlur(np.clip((cm.astype(np.float32) - 40) * 1.4, 0, 255).astype(np.uint8), (0, 0), 0.6)
    ca[BAR:] = 0
    save('char', cfill, ca, 0, 0, q=90)
    chole = cv2.dilate((cm > 60).astype(np.uint8) * 255, np.ones((13, 13), np.uint8))

    # ── 제목 ──
    for k, (box, mode) in c['titles'].items():
        x0, y0, x1, y1 = box
        a = title_mask(img, box, mode)
        save(k, img[y0:y1, x0:x1].copy(), a, x0, y0, q=92)
        hole[y0:y1, x0:x1] |= cv2.dilate((a > 20).astype(np.uint8) * 255, np.ones((7, 7), np.uint8))

    # ── 사각 조각(이름표·목록·위 UI) ──
    rects = {'tag': c['tag'], 'back': c['back'], 'tabs': c['tabs'], 'gems': c['gems'], 'tickets': c['tickets']}
    if 'faces' in c: rects['faces'] = c['faces']
    for i, r in enumerate(c['list']): rects[f'list{i}'] = r
    for k, (x0, y0, x1, y1) in rects.items():
        crop = img[y0:y1, x0:x1].copy()
        if k in ('gems', 'tickets'):  # 숫자 자리 지움
            nx0, ny0, nx1, ny1 = c[f'{k}_num']
            lm = np.zeros(crop.shape[:2], np.uint8); lm[ny0 - y0:ny1 - y0, nx0 - x0:nx1 - x0] = 255
            crop = cv2.inpaint(crop, lm, 4, cv2.INPAINT_TELEA)
        if k == 'faces':  # 시안 얼굴 줄은 지우고 실제 신규 대원 얼굴을 그린다
            pass
        save(k, crop, feather(y1 - y0, x1 - x0, 1.6 if not k.startswith('list') else 1.2), x0, y0, q=92, trim=False)
        hole[y0:y1, x0:x1] = 255

    # ── 아래 바 ──
    bar = img.copy()
    sub = {'exchange': c['exchange'], 'points': c['points'], 'gift': c['gift'], 'pull1': c['pull1'], 'pull10': c['pull10']}
    sh = np.zeros((H, W), np.uint8)
    for x0, y0, x1, y1 in sub.values(): sh[y0:y1, x0:x1] = 255
    sh |= cv2.dilate(dm, np.ones((7, 7), np.uint8))
    sh[:BAR] = 0
    bar = cv2.inpaint(bar, sh, 5, cv2.INPAINT_TELEA)
    bar = cv2.bilateralFilter(bar, 0, 10, 4) * (sh[..., None] > 0) + bar * (sh[..., None] == 0)
    ba = np.zeros((H - BAR + 2, W), np.uint8); ba[2:] = 255; ba[:3] = (np.array([0, 110, 220]))[:, None]
    save('bar', bar[BAR - 2:].astype(np.uint8), ba, 0, BAR - 2, q=88, trim=False)
    for k, (x0, y0, x1, y1) in sub.items():
        crop = img[y0:y1, x0:x1].copy()
        if k == 'points':
            lm = np.zeros(crop.shape[:2], np.uint8)
            for rx0, ry0, rx1, ry1 in (c['points_num'], c['points_bar']):
                lm[ry0 - y0:ry1 - y0, rx0 - x0:rx1 - x0] = 255
            crop = cv2.inpaint(crop, lm, 4, cv2.INPAINT_TELEA)
            crop = (cv2.bilateralFilter(crop, 0, 10, 4) * (lm[..., None] > 0) + crop * (lm[..., None] == 0)).astype(np.uint8)
        a = feather(y1 - y0, x1 - x0, 1.6)
        if k == 'points':  # 장치가 포인트 칸 오른쪽을 덮는 경우 그 부분은 비움
            a = (a.astype(np.float32) * (1 - dm[y0:y1, x0:x1] / 255.0)).astype(np.uint8)
        save(k, crop, a, x0, y0, q=92, trim=False)

    # ── 장치 부품 ──
    kind = c['dev_kind']
    whole = img.copy()
    if kind == 'capsule':
        kx, ky, kr = c['knob']
        km = np.zeros((H, W), np.uint8); cv2.circle(km, (kx, ky), kr, 255, -1)
        kmask = cv2.GaussianBlur(km, (0, 0), 0.8)
        save('dev-knob', img[ky - kr - 2:ky + kr + 3, kx - kr - 2:kx + kr + 3].copy(), kmask[ky - kr - 2:ky + kr + 3, kx - kr - 2:kx + kr + 3], kx - kr - 2, ky - kr - 2, q=92, trim=False)
        whole = cv2.inpaint(img, cv2.dilate(km, np.ones((3, 3), np.uint8)), 3, cv2.INPAINT_TELEA)
        cv2.circle(whole, (kx, ky), kr - 2, tuple(int(v) for v in img[ky + kr + 4, kx]), -1)
        save('dev', whole[dy0:dy1, dx0:dx1].copy(), dsoft[dy0:dy1, dx0:dx1], dx0, dy0, q=92)
    elif kind == 'lottery':
        ax, ay = c['axle']
        drum = dm.copy(); drum[c['drum_bottom']:] = 0
        crank = np.zeros_like(dm); crank[ay - 14:c['drum_bottom'] + 2, ax:dx1] = 255
        drum = np.maximum(drum, crank & dm)
        stand = dm.copy(); stand[drum > 0] = 0
        # 받침 위 통에 가려졌던 자리: 받침 색으로 대충 메움(통이 도는 동안만 잠깐 보임)
        sfill = cv2.inpaint(img, cv2.dilate(drum, np.ones((3, 3), np.uint8)), 7, cv2.INPAINT_TELEA)
        save('dev-stand', sfill[dy0:dy1, dx0:dx1].copy(), cv2.GaussianBlur(stand, (0, 0), 0.8)[dy0:dy1, dx0:dx1], dx0, dy0, q=92)
        save('dev-drum', img[dy0:dy1, dx0:dx1].copy(), cv2.GaussianBlur(drum, (0, 0), 0.8)[dy0:dy1, dx0:dx1], dx0, dy0, q=92)
    else:  # peel
        fx0, fy0, fx1, fy1 = c['flap']
        cc = img[fy0:fy1, fx0:fx1].astype(np.int32)
        b, g, r = cc[..., 0], cc[..., 1], cc[..., 2]
        hsv = cv2.cvtColor(img[fy0:fy1, fx0:fx1], cv2.COLOR_BGR2HSV).astype(np.int32)
        sticker = (r > 150) & (r - b > 45) & (hsv[..., 0] < 25)  # 종이 밑 주황·분홍 스티커
        fm = np.zeros((H, W), np.uint8)
        fm[fy0:fy1, fx0:fx1] = ((~sticker) & (dm[fy0:fy1, fx0:fx1] > 0)).astype(np.uint8) * 255
        fm = cv2.morphologyEx(fm, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(fm, 8)
        if n > 1:
            big = 1 + int(np.argmax(st[1:, 4])); fm = np.where(lab == big, 255, 0).astype(np.uint8)
        # 접힌 종이는 오른쪽 위 삼각형 영역(접힌 선 아래 왼쪽은 종이 본체)
        tri = np.zeros_like(fm); cv2.fillPoly(tri, [np.array([(fx0, fy0), (fx1 + 2, fy0), (fx1 + 2, fy1)], np.int32)], 255)
        tri = cv2.dilate(tri, np.ones((5, 5), np.uint8))
        fm &= tri
        save('dev-flap', img[fy0:fy1, fx0:fx1].copy(), cv2.GaussianBlur(fm, (0, 0), 0.7)[fy0:fy1, fx0:fx1], fx0, fy0, q=92, trim=False)
        under = img.copy()
        ui = cv2.dilate(fm, np.ones((3, 3), np.uint8))
        under = cv2.inpaint(under, ui, 5, cv2.INPAINT_TELEA)
        rest = dm.copy(); rest[(fm > 0)] = 0
        rest = np.maximum(rest, cv2.dilate(fm, np.ones((5, 5), np.uint8)) & dm)
        save('dev', under[dy0:dy1, dx0:dx1].copy(), cv2.GaussianBlur(rest, (0, 0), 0.7)[dy0:dy1, dx0:dx1], dx0, dy0, q=92)

    # ── 기본 장면 ──
    hole[BAR - 2:] = 0
    base = big_inpaint(img, hole)
    # 인물 자리: 원본을 크게 흐린 그림(인물이 흐릿한 실루엣으로 남음 → 들어올 때 초점이 맞듯 보임, 시차 가장자리도 자연스러움)
    soft = cv2.GaussianBlur(base if False else img, (0, 0), 16)
    cf = (cv2.GaussianBlur(chole, (0, 0), 6) / 255.0)[..., None]
    base = (base * (1 - cf) + soft * cf).astype(np.uint8)
    nn = H - BAR
    base[BAR:] = cv2.GaussianBlur(base[BAR - nn:BAR][::-1], (0, 0), 6)
    Image.fromarray(cv2.cvtColor(base, cv2.COLOR_BGR2RGB)).save(f'{OUT}/base.webp', quality=86)
    meta['base'] = {'x': 0, 'y': 0, 'w': W, 'h': H, 'file': f'ref/recruit/{name}/base.webp'}
    meta['_bar'] = BAR
    meta['_cfg'] = {k: c[k] for k in ('gems_num', 'tickets_num', 'points_num', 'points_bar', 'knob', 'axle', 'flap', 'dev', 'dev_kind', 'tag', 'list', 'tabs', 'hint') if k in c}
    meta_all[name] = meta

    # 새 캐릭터 에셋: 인물 조각(바 위까지) → stand/action(같은 그림), 얼굴, 상세 아트
    cid = c['char_id']
    ys, xs = np.nonzero(ca > 20)
    crop = rgba(cfill, ca).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    crop.save(f'public/assets/chars/{cid}_stand.webp', quality=88)
    crop.save(f'public/assets/chars/{cid}_action.webp', quality=88)
    crop.save(f'public/ref/detail-art/{cid}.webp', quality=90)
    meta_all.setdefault('_chars', {})[cid] = {'crop': [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]}
    fx, fy, fs = FACE[cid]
    rgba(cfill, ca).crop((fx - fs // 2, fy - fs // 2, fx + fs // 2, fy + fs // 2)).resize((384, 384), Image.LANCZOS).save(f'public/assets/chars/{cid}_portrait.webp', quality=90)
    art = json.load(open('src/game/data/ref-detail-art.json'))
    a2 = np.asarray(crop)[..., 3]; ys2, xs2 = np.nonzero(a2 > 40)
    art[cid] = {'src': f'ref/detail-art/{cid}.webp', 'kind': 'cutout', 'w': crop.width, 'h': crop.height, 'top': int(ys2.min()), 'bodyH': int(ys2.max() - ys2.min()), 'headX': float(fx - xs.min()), 'heroH': 1000}  # 반신(아래는 바에 가려 없음): 화면 높이 정도로
    json.dump(art, open('src/game/data/ref-detail-art.json', 'w'), indent=1, ensure_ascii=False)
    if DBG:
        cv2.imwrite(f'{DBG}/{name}-base.png', base)
        cv2.imwrite(f'{DBG}/{name}-hole.png', hole)
    print(name, 'ok')

# 목록 썸네일(고르지 않은 상태): SERENITY는 NIGHT SHIFT 화면, NIGHT SHIFT·OMP는 SERENITY 화면에서
TH = {'serenity': ('nightshift', 1), 'nightshift': ('serenity', 2), 'omp': ('serenity', 3)}
for k, (src, i) in TH.items():
    x0, y0, x1, y1 = C[src]['list'][i]
    im = Image.open(f'{SRC}/{src}.png').convert('RGB').crop((x0 + 2, y0 + 2, x1 - 2, y1 - 2))
    im.save(f'public/ref/recruit/thumb-{k}.webp', quality=90)
json.dump(meta_all, open('src/game/data/ref-recruit-scenes.json', 'w'), indent=1)

# 비 무늬(SERENITY 창밖 비): 투명 바탕 위 짧은 빗줄기, 세로로 이어 붙여 아래로 흘린다
rng = np.random.default_rng(7)
for k, (n, lo, hi, alpha) in {'rain-near': (70, 26, 44, 150), 'rain-far': (130, 12, 22, 95)}.items():
    t = np.zeros((256, 256, 4), np.uint8)
    for _ in range(n):
        x, y, L = int(rng.integers(0, 256)), int(rng.integers(0, 256)), int(rng.integers(lo, hi))
        for d in range(L):
            yy = (y + d) % 256; xx = (x + d // 9) % 256
            t[yy, xx] = (215, 228, 255, int(alpha * (0.35 + 0.65 * d / L)))
    Image.fromarray(t, 'RGBA').save(f'public/ref/recruit/{k}.webp', quality=95, lossless=True)
print('rain ok')
