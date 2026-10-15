"""주파수 너머 배너: 이름표 조각(character-name)의 '리온' 글자를 지우고 '라온'으로 다시 쓴다(별·아이콘은 원본 유지).
원본은 tools/recruit_name_src.webp 로 보관해 다시 돌려도 같은 결과가 나오게 한다."""
import os, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, 'public/ref/recruitment/character-name.webp')
SRC = os.path.join(ROOT, 'tools/recruit_name_src.webp')
if not os.path.exists(SRC): shutil.copy(DST, SRC)
im = Image.open(SRC).convert('RGB')
W, H = im.size
# 글자 영역: x 70~150. 위아래 띠 색으로 열마다 세로 보간해 지운다
box = (68, 6, 152, H - 6)
px = im.load()
for y in range(box[1], box[3]):
    l = px[box[0] - 1, y]; r = px[box[2], y]
    for x in range(box[0], box[2]):
        t = (x - box[0]) / max(1, box[2] - box[0])
        px[x, y] = tuple(int(l[i] * (1 - t) + r[i] * t) for i in range(3))
region = im.crop(box).filter(ImageFilter.GaussianBlur(2))
im.paste(region, box[:2])
font = None
for path, idx in [('/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc', None), ('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', None)]:
    if not os.path.exists(path): continue
    for i in range(10):
        try:
            f = ImageFont.truetype(path, 32, index=i)
            if 'KR' in ' '.join(f.getname()): font = f; break
        except OSError: break
    if font: break
d = ImageDraw.Draw(im)
text = '라온'
bb = d.textbbox((0, 0), text, font=font)
tw, th = bb[2] - bb[0], bb[3] - bb[1]
x = 75 - bb[0]; y = (H - th) // 2 - bb[1]
d.text((x + 1, y + 2), text, font=font, fill=(0, 0, 0))
d.text((x, y), text, font=font, fill=(250, 250, 250))
im.save(DST, quality=92)
print('ok', font.getname(), tw, th)
