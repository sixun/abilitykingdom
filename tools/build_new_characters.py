"""신규 캐릭터 4명(Character-Additions 패키지)의 원본 참고 이미지 → 게임용 에셋.
1) 배경 제거: /tmp/claude-0/cut/cutout.py 결과(애니메 분할 모델 isnet-anime + 균일 배경 color-to-alpha,
   장검 캐릭터 JPG는 체크무늬를 밝은 무채색 배경으로 처리)를 입력으로 쓴다. 원본에 없는 픽셀은 만들지 않는다.
2) 이 스크립트: 전신(stand)·다른 포즈(action)·얼굴(portrait)·상세 아트(detail-art)로 잘라 저장하고
   상세 화면 배치 수치를 src/game/data/ref-detail-art.json에 추가한다.
사용: python3 tools/build_new_characters.py"""
import json
import numpy as np
from PIL import Image

CUT = '/tmp/claude-0/cut/out'
# id: (stand 원본, action 원본, 얼굴 중심(x,y)·크기(정사각) in stand 좌표, stand 가로 자르기, 상세 아트 원본, 상세 몸 높이)
SPEC = {
    'baekrin': dict(stand='01-baekrin-reference-01', action='01-baekrin-reference-02', face=(305, 172, 300), detail='01-baekrin-reference-01', headX=311),
    'kiyomi': dict(stand='02-kiyomi-reference-01', action='02-kiyomi-reference-02', face=(505, 175, 330), detail='02-kiyomi-reference-01', headX=508),
    'swordswoman': dict(stand='03-swordswoman-reference-02', action='03-swordswoman-reference-01', face=(140, 98, 190), stand_crop=(0, 600), detail='03-swordswoman-reference-01', heroH=1250, headX=1012),
    'kimono': dict(stand='04-kimono-reference-01', action='04-kimono-reference-01', face=(401, 160, 290), detail='04-kimono-reference-01', headX=401),
}


def trim(im):
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 8)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def fit_h(im, h):
    return im if im.height <= h else im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


art = json.load(open('src/game/data/ref-detail-art.json'))
for cid, s in SPEC.items():
    st = Image.open(f'{CUT}/{s["stand"]}.png')
    fx, fy, fs = s['face']
    # 얼굴: 정사각 384 (투명 바탕 → 목록 카드 배경색 위에 놓인다)
    pt = st.crop((fx - fs // 2, fy - fs // 2, fx + fs // 2, fy + fs // 2)).resize((384, 384), Image.LANCZOS)
    pt.save(f'public/assets/chars/{cid}_portrait.webp', quality=90)
    stand = st.crop((s['stand_crop'][0], 0, s['stand_crop'][1], st.height)) if 'stand_crop' in s else st
    fit_h(trim(stand), 1500).save(f'public/assets/chars/{cid}_stand.webp', quality=88)
    fit_h(trim(Image.open(f'{CUT}/{s["action"]}.png')), 1300).save(f'public/assets/chars/{cid}_action.webp', quality=88)
    d = Image.open(f'{CUT}/{s["detail"]}.png')
    d.save(f'public/ref/detail-art/{cid}.webp', quality=90)
    a = np.asarray(d)[..., 3]
    ys, xs = np.nonzero(a > 40)
    top, bot = int(ys.min()), int(ys.max())
    head = a[top:top + max(20, (bot - top) // 14)]
    hx = s.get('headX') or float(np.nonzero(head > 40)[1].mean())
    art[cid] = {'src': f'ref/detail-art/{cid}.webp', 'kind': 'cutout', 'w': d.width, 'h': d.height, 'top': top, 'bodyH': bot - top, 'headX': round(hx, 1), **({'heroH': s['heroH']} if 'heroH' in s else {})}
    print(cid, art[cid])
json.dump(art, open('src/game/data/ref-detail-art.json', 'w'), indent=1, ensure_ascii=False)
