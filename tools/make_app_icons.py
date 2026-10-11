"""리온 전신 이미지(투명 PNG)에서 얼굴 쪽을 잘라 앱 아이콘 세트를 만든다.
사용: python3 tools/make_app_icons.py <리온 PNG> <출력 폴더>"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
im = Image.open(SRC).convert('RGBA')

def background(n):
    """짙은 남색 + 라임·보라 사선(리온 의상 색)"""
    y, x = np.mgrid[0:n, 0:n] / n
    r = np.sqrt((x - 0.55) ** 2 + (y - 0.35) ** 2)
    base = np.clip(1 - r * 1.25, 0, 1)[..., None]
    c0, c1 = np.array([10, 11, 20]), np.array([42, 30, 78])
    rgb = (c0 + (c1 - c0) * base).astype(np.uint8)
    bg = Image.fromarray(rgb, 'RGB').convert('RGBA')
    d = ImageDraw.Draw(bg)
    s = n / 1024
    d.polygon([(0, 760 * s), (1024 * s, 200 * s), (1024 * s, 330 * s), (0, 890 * s)], fill=(200, 245, 59, 255))
    d.polygon([(0, 900 * s), (1024 * s, 340 * s), (1024 * s, 372 * s), (0, 932 * s)], fill=(137, 92, 230, 255))
    return bg

def subject(box, n):
    """얼굴 영역을 잘라 n×n으로. 윤곽에 옅은 그림자"""
    crop = im.crop(box).resize((n, n), Image.LANCZOS)
    a = crop.split()[3]
    sh = Image.new('RGBA', (n, n), (0, 0, 0, 0)); sh.putalpha(a.filter(ImageFilter.GaussianBlur(n / 80)).point(lambda v: int(v * 0.55)))
    out = Image.new('RGBA', (n, n)); out.alpha_composite(sh, (int(n / 120), int(n / 90))); out.alpha_composite(crop)
    return out

FACE = (250, 28, 534, 312)      # 아이콘 정사각형(얼굴 크게)
WIDE = (190, -30, 590, 370)     # 안드로이드 적응형 전경(가장자리가 잘려도 얼굴은 안쪽 66%에)

def padded_crop(box):
    x0, y0, x1, y1 = box
    canvas = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    canvas.alpha_composite(im.crop((max(0, x0), max(0, y0), min(im.width, x1), min(im.height, y1))), (max(0, -x0), max(0, -y0)))
    return canvas

# 1) 기본 아이콘 1024(iOS: 알파 없음)
bg = background(1024)
icon = bg.copy(); icon.alpha_composite(subject(FACE, 1024))
icon.convert('RGB').save(f'{OUT}/icon-1024.png')
# 2) 안드로이드 적응형 전경/배경 432(=108dp@xxxhdpi)
fg_src = padded_crop(WIDE)
fg = Image.new('RGBA', (432, 432)); fg.alpha_composite(fg_src.resize((432, 432), Image.LANCZOS))
fg.save(f'{OUT}/adaptive-foreground.png')
background(432).convert('RGB').save(f'{OUT}/adaptive-background.png')
# 3) 웹/PWA
for n, name in [(512, 'pwa-512.png'), (192, 'pwa-192.png'), (180, 'apple-touch-icon.png'), (48, 'favicon-48.png')]:
    icon.convert('RGB').resize((n, n), Image.LANCZOS).save(f'{OUT}/{name}')
# 원형 미리보기(확인용)
m = Image.new('L', (1024, 1024), 0); ImageDraw.Draw(m).ellipse((0, 0, 1023, 1023), fill=255)
r = icon.copy(); r.putalpha(m); r.save(f'{OUT}/preview-round.png')
print('ok')
