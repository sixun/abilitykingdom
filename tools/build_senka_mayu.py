"""센카·마유 캐릭터 에셋(다른 캐릭터와 같은 형식): 이미지 모델(gpt-image-2.5-flare, 투명 배경)로 만든 전신 2포즈(tools/char_src)
→ portrait(얼굴 384), stand·action(투명 여백 제거, 높이 1500 이하), 상세 아트 + ref-detail-art.json 배치값
사용: python3 tools/build_senka_mayu.py"""
import json
import numpy as np
from PIL import Image
FACE = {'senka': (528, 118, 250), 'mayu': (512, 120, 250)}  # stand 그림 기준 얼굴 중심·정사각 크기
art = json.load(open('src/game/data/ref-detail-art.json'))
def trim(im):
    a = np.asarray(im)[..., 3]; ys, xs = np.nonzero(a > 8)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
def fit_h(im, h): return im if im.height <= h else im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
for cid, (fx, fy, fs) in FACE.items():
    st = Image.open(f'tools/char_src/{cid}_stand.png').convert('RGBA')
    st.crop((fx - fs // 2, fy - fs // 2, fx + fs // 2, fy + fs // 2)).resize((384, 384), Image.LANCZOS).save(f'public/assets/chars/{cid}_portrait.webp', quality=90)
    fit_h(trim(st), 1500).save(f'public/assets/chars/{cid}_stand.webp', quality=88)
    fit_h(trim(Image.open(f'tools/char_src/{cid}_action.png').convert('RGBA')), 1500).save(f'public/assets/chars/{cid}_action.webp', quality=88)
    st.save(f'public/ref/detail-art/{cid}.webp', quality=90)
    a = np.asarray(st)[..., 3]; ys, xs = np.nonzero(a > 40)
    art[cid] = {'src': f'ref/detail-art/{cid}.webp', 'kind': 'cutout', 'w': st.width, 'h': st.height, 'top': int(ys.min()), 'bodyH': int(ys.max() - ys.min()), 'headX': float(fx)}
    print(cid, art[cid])
json.dump(art, open('src/game/data/ref-detail-art.json', 'w'), indent=1, ensure_ascii=False)
