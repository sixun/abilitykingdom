"""원본 분리 조각(Original-Pixel-Slices)과 복원 에셋을 앱용으로 변환한다.
- 원본 조각: 무손실 WebP(픽셀 동일) + layout.json 경로 갱신
- 복원 배경/캐릭터: 손실 WebP(원본과 픽셀 동일하지 않은 AI 복원본)
사용: python3 tools/build_ref_assets.py <Ability-Kingdom-Complete-Assets 폴더> <fit.json>"""
import json, os, sys, shutil, numpy as np, cv2
from PIL import Image
SRC = sys.argv[1]; FIT = json.load(open(sys.argv[2]))
SL = f'{SRC}/slices/Ability-Kingdom-UI-Assets'
OUT = 'public/ref'
os.makedirs(OUT, exist_ok=True)
for screen in ['lobby', 'recruitment', 'formation']:
    L = json.load(open(f'{SL}/{screen}/layout.json'))
    os.makedirs(f'{OUT}/{screen}', exist_ok=True)
    layers = []
    for l in L['layers']:
        name = os.path.splitext(os.path.basename(l['file']))[0] + '.webp'
        im = Image.open(f"{SL}/{screen}/{l['file']}").convert('RGBA')
        im.save(f'{OUT}/{screen}/{name}', 'WEBP', lossless=True, quality=100, method=6, exact=True)
        layers.append({k: l[k] for k in ('id', 'x', 'y', 'width', 'height')} | {'group': l.get('group', ''), 'file': f'ref/{screen}/{name}'})
    json.dump({'canvas': L['canvas'], 'layers': layers}, open(f'src/game/data/ref-{screen}.json', 'w'), ensure_ascii=False, indent=0)
    ref = 'formation-reference.png' if screen == 'formation' else 'reference.png'
    shutil.copy(f'{SL}/{screen}/{ref}', f'/tmp/claude-0/ref-{screen}.png')
R = f'{SRC}/restored'
os.makedirs(f'{OUT}/restored', exist_ok=True)
for n, (w, h) in {'formation': (1456, 819), 'recruitment': (1456, 819), 'lobby': (1456, 818)}.items():
    Image.open(f'{R}/backgrounds/{n}-background.png').convert('RGB').resize((w, h), Image.LANCZOS).save(f'{OUT}/restored/{n}-bg.webp', 'WEBP', quality=90, method=6)
for n, f in FIT.items():
    Image.open(f'{R}/characters/formation-{n}.png').convert('RGBA').resize((f['w'], f['h']), Image.LANCZOS).save(f'{OUT}/restored/formation-{n}.webp', 'WEBP', quality=92, method=6)
for n in ['lobby-jian', 'recruitment-rion']:
    im = Image.open(f'{R}/characters/{n}.png').convert('RGBA'); im.save(f'{OUT}/restored/{n}.webp', 'WEBP', quality=92, method=6)
# 지안 썸네일의 '선택' 표시(체크·청록 모서리)를 지운 파생본: 원본 조각 + OpenCV 인페인트(근사)
p = cv2.imread(f'{SL}/formation/layers/portrait-jian.png', cv2.IMREAD_UNCHANGED)
print('portrait-jian', p.shape)
os.makedirs(f'{OUT}/ui', exist_ok=True)
for d in ['skins', 'icons']:
    shutil.copytree(f'{SRC}/ui/{d}', f'{OUT}/ui/{d}', dirs_exist_ok=True)
json.dump(FIT, open('src/game/data/ref-fit.json', 'w'), indent=1)
print('ok')
