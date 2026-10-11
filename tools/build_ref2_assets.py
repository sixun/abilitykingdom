"""역 로비(Station-Lobby)·지안 상세(Jian-Detail) 패키지를 앱용으로 변환한다.
- 원본 조각: 무손실 WebP(픽셀 동일) + src/game/data/ref-{station,detail}.json
- 복원 배경: 손실 WebP(AI 복원본, 원본과 픽셀 동일하지 않음)
사용: python3 tools/build_ref2_assets.py <Ability-Kingdom-Station-Lobby 폴더> <Ability-Kingdom-Jian-Detail 폴더>"""
import json, os, sys, shutil
from PIL import Image

PKG = {'station': sys.argv[1], 'detail': sys.argv[2]}
OUT = 'public/ref'
for screen, src in PKG.items():
    L = json.load(open(f'{src}/layout.json'))
    os.makedirs(f'{OUT}/{screen}', exist_ok=True)
    layers = []
    for l in L['layers']:
        name = os.path.splitext(os.path.basename(l['file']))[0] + '.webp'
        Image.open(f"{src}/{l['file']}").convert('RGBA').save(f'{OUT}/{screen}/{name}', 'WEBP', lossless=True, quality=100, method=6, exact=True)
        extra = {k: l[k] for k in ('label', 'route') if k in l}
        layers.append({k: l[k] for k in ('id', 'x', 'y', 'width', 'height')} | {'group': '', 'file': f'ref/{screen}/{name}'} | extra)
    json.dump({'canvas': L['canvas'], 'layers': layers}, open(f'src/game/data/ref-{screen}.json', 'w'), ensure_ascii=False, indent=0)
    os.makedirs('/tmp/claude-0', exist_ok=True)
    shutil.copy(f'{src}/reference.png', f'/tmp/claude-0/ref-{screen}.png')

os.makedirs(f'{OUT}/restored', exist_ok=True)
Image.open(f"{PKG['station']}/restored/station-background.png").convert('RGB').save(f'{OUT}/restored/station-bg.webp', 'WEBP', quality=90, method=6)
print('ok')
