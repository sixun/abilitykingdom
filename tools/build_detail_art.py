"""캐릭터 상세에서 지안 외 캐릭터를 보여줄 임시 전신 아트 배치값을 계산한다.
유진·하린·도윤: 편성용 AI 복원 전신(Complete-Assets/restored/characters), 나머지: v0.1 임시 AI 전신.
머리 위치·몸 높이를 알파 경계로 구해 원본 지안과 비슷한 얼굴 크기로 맞춘다(근사).
사용: python3 tools/build_detail_art.py <Complete-Assets 폴더>"""
import json, os, sys, numpy as np
from PIL import Image
SRC = sys.argv[1]
os.makedirs('public/ref/detail-art', exist_ok=True)
out = {}
for cid in ['yujin', 'harin', 'doyun', 'sein', 'narin', 'rion', 'seoha']:
    if cid in ('yujin', 'harin', 'doyun'):
        im = Image.open(f'{SRC}/restored/characters/formation-{cid}.png').convert('RGBA')
        im.save(f'public/ref/detail-art/{cid}.webp', 'WEBP', quality=90, method=6)
        path, kind = f'ref/detail-art/{cid}.webp', 'restored'
    else:
        im = Image.open(f'public/assets/chars/{cid}_stand.webp').convert('RGBA')
        path, kind = f'assets/chars/{cid}_stand.webp', 'temp'
    a = np.array(im)[..., 3] > 40
    ys, xs = np.where(a)
    top, bot = int(ys.min()), int(ys.max())
    head = a[top:top + max(1, (bot - top) // 9)]
    hx = float(np.where(head)[1].mean())
    out[cid] = {'src': path, 'kind': kind, 'w': im.width, 'h': im.height, 'top': top, 'bodyH': bot - top, 'headX': round(hx, 1)}
json.dump(out, open('src/game/data/ref-detail-art.json', 'w'), indent=1)
print(json.dumps(out, indent=1))
