"""필드 HUD 아이콘·장식 잘라내기.
사용자 시안(field_hud_mock.png, 1672×941)을 nano-banana-pro 4K로 'HUD만 남기고 글자·배경 제거(자홍 배경)' 시킨 hud_b.jpg에서
자홍색을 빼고(hud_b_key.png), 버튼·아이콘마다 잘라 src/assets/hud/<이름>.webp 로 저장한다(2배 크기).
- 자홍이 섞여 보라색으로 탁해진 어두운 판은 남색(시안의 색)으로 돌리고, 버튼 안쪽은 불투명하게 채운다.
좌표는 시안 1672 기준 (x0, y0, x1, y1). 실행: python3 tools/hud/slice_hud.py"""
import colorsys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = os.path.join(os.path.dirname(__file__), 'hud_b_key.png')
OUT = os.path.join(os.path.dirname(__file__), '../../src/assets/hud')
K = 5504 / 1672
BOX = {
    'portrait': (8, 0, 200, 160), 'side-tab': (16, 332, 64, 508),
    'coin': (624, 12, 660, 48), 'gem': (870, 6, 908, 54),
    'gift': (1100, 2, 1165, 60), 'scales': (1185, 2, 1255, 60), 'compass': (1276, 2, 1338, 64), 'bag': (1374, 6, 1434, 60), 'char': (1468, 2, 1530, 60),
    'menu': (1550, 8, 1648, 70), 'mini-ring': (1340, 84, 1600, 350), 'map': (1598, 156, 1662, 220), 'quest': (1598, 242, 1662, 308),
    'dance': (1562, 490, 1662, 590), 'awaken': (1392, 580, 1500, 690), 'active': (1318, 652, 1416, 752), 'attack': (1450, 642, 1630, 820),
    'dodge': (1176, 758, 1282, 864), 'talk': (1314, 758, 1426, 868), 'target': (1576, 800, 1652, 876),
    'mount': (18, 584, 88, 656), 'camp': (18, 656, 88, 726), 'stick': (100, 612, 300, 802),
}
ROUND = {  # 가운데(비율)와 반지름(짧은 변 비율)
    'attack': (0.5, 0.5, 0.48), 'awaken': (0.5, 0.48, 0.47), 'active': (0.5, 0.5, 0.48), 'dodge': (0.5, 0.5, 0.48), 'talk': (0.5, 0.5, 0.49),
    'dance': (0.5, 0.5, 0.48), 'target': (0.5, 0.5, 0.48), 'mount': (0.5, 0.5, 0.48), 'camp': (0.5, 0.5, 0.48), 'map': (0.5, 0.5, 0.49), 'quest': (0.5, 0.5, 0.49),
    'stick': (0.5, 0.5, 0.46),
}
DOTS = ['gift', 'scales', 'menu', 'quest']  # 시안의 빨간 점은 지우고 화면에서 실제 알림일 때만 그린다


def fix(px):
    rgb = px[..., :3].astype(np.float32) / 255
    out = rgb.copy()
    H, W = rgb.shape[:2]
    flat = rgb.reshape(-1, 3)
    hsv = np.array([colorsys.rgb_to_hsv(*c) for c in flat]).reshape(H, W, 3)
    h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    purple = (h > 255) & (h < 335) & (v < 0.62)
    hsv[..., 0] = np.where(purple, 228 / 360, hsv[..., 0])
    hsv[..., 1] = np.where(purple, np.minimum(s, 0.55), hsv[..., 1])
    hsv[..., 2] = np.where(purple, v * 0.82, hsv[..., 2])
    out = np.array([colorsys.hsv_to_rgb(*c) for c in hsv.reshape(-1, 3)]).reshape(H, W, 3)
    return (out * 255).astype(np.uint8)


def main():
    im = np.array(Image.open(SRC).convert('RGBA'))
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for name, (x0, y0, x1, y1) in BOX.items():
        c = im[int(y0 * K):int(y1 * K), int(x0 * K):int(x1 * K)].copy()
        a = c[..., 3].astype(np.float32) / 255
        solid = ndimage.binary_fill_holes(a > 0.45)
        lab, n = ndimage.label(solid)
        if name in ROUND:  # 둥근 버튼: 가운데 원만(옆 버튼 조각 제거)
            hh, ww = solid.shape; yy, xx = np.mgrid[0:hh, 0:ww]
            cx, cy, r = ROUND[name]
            solid &= (xx - cx * ww) ** 2 + (yy - cy * hh) ** 2 <= (r * min(ww, hh)) ** 2
            lab, n = ndimage.label(solid)
        if n > 1:  # 가장 큰 덩어리 + 그에 붙은 것만
            sizes = ndimage.sum(solid, lab, range(1, n + 1))
            keep = [i + 1 for i, v in enumerate(sizes) if v >= sizes.max() * 0.15]
            solid = np.isin(lab, keep)
        if name in DOTS:  # 시안에 그려진 빨간 알림 점은 지운다(실제 알림일 때만 화면에서 그림)
            hsv_ = np.array(Image.fromarray(c[..., :3]).convert('HSV')).astype(np.float32)
            red = ((hsv_[..., 0] < 12) | (hsv_[..., 0] > 240)) & (hsv_[..., 1] > 120) & (hsv_[..., 2] > 120)
            lab2, n2 = ndimage.label(ndimage.binary_dilation(red, iterations=2))
            if n2:
                sz = ndimage.sum(red, lab2, range(1, n2 + 1)); big = np.argmax(sz) + 1
                dot = ndimage.binary_fill_holes(lab2 == big)
                dot = ndimage.binary_dilation(dot, iterations=int(3 * K / 2))
                solid &= ~dot
        edge = ndimage.gaussian_filter(solid.astype(np.float32), 1.2)
        alpha = np.clip(np.maximum(edge, a * solid), 0, 1)
        rgb = fix(c)
        out = np.dstack([rgb, (alpha * 255).astype(np.uint8)])
        img = Image.fromarray(out, 'RGBA').resize(((x1 - x0) * 2, (y1 - y0) * 2), Image.LANCZOS)
        img.save(f'{OUT}/{name}.webp', quality=92, method=6)
        meta[name] = [x0, y0, x1 - x0, y1 - y0]
    # 버프 아이콘 4개는 시안 원본에서 그대로(불투명 사각 아이콘)
    mock = Image.open(os.path.join(os.path.dirname(__file__), 'field_hud_mock.png')).convert('RGB')
    for i, x in enumerate([200, 237, 274, 311]):
        mock.crop((x, 115, x + 30, 146)).resize((60, 62), Image.LANCZOS).save(f'{OUT}/buff{i}.webp', quality=92)
    json.dump(meta, open(os.path.join(os.path.dirname(__file__), '../../src/game/data/field-hud.json'), 'w'))
    print(len(meta), 'sprites')


if __name__ == '__main__':
    main()
