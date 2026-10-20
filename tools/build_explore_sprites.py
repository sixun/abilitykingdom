"""탐색 모드 캐릭터 스프라이트(8방향 대기·걷기) → 캐릭터마다 아틀라스 webp + 프레임 표.

원본: tools/explore/<kind>/walk_<방향>.mp4 (초록 단색 배경, 제자리 걷기, 같은 크기 시작 장면)
설정: tools/explore/sets.json
  "seren": {"height": 230, "dirs": {"S": {"loop": [20, 123, 24, 40]}, "N": {...}}}
  - loop: a~b 사이에서 처음과 끝이 가장 닮은 mn~mx 프레임 구간을 걷기 고리로
  - 대기(idle)는 걷기 고리 중 실루엣이 가장 좁은 장면 1장(게임이 숨쉬기를 더한다)
처리: 색 차이 키잉 + 번짐 제거 → 정면 영상 첫 장면의 몸 높이를 height로 맞춤(모든 방향 같은 배율)
      → 방향마다 첫 장면의 발 위치를 기준점으로 → 잘라서 아틀라스에 채움
출력: public/explore/c-<kind>.webp, src/game/data/explore-sprites.json
사용: python3 tools/build_explore_sprites.py [kind ...]"""
import json, os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import build_motion_sets as B  # noqa: E402

ROOT = 'tools/explore'
OUT = 'public/explore'
DATA = 'src/game/data/explore-sprites.json'
ATLAS_W = 2048
DIRS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']


def build(kind, cfg):
    first = {}
    for d, c in cfg['dirs'].items():
        fs = B.frames(f'{ROOT}/{kind}/walk_{d}.mp4')
        first[d] = fs
    ref = 'S' if 'S' in first else next(iter(first))
    f0 = B.load(first[ref][0]); k0 = B.key(f0, 'g', B.bg_of(f0))
    bh, _, _ = B.body(k0[..., 3])
    sc = cfg['height'] / bh
    print(kind, 'body', bh, 'scale', round(sc, 3))
    tiles = []; anchors = []; clips = {}
    for d, c in cfg['dirs'].items():
        fs = first[d]
        bg = B.bg_of(B.load(fs[0]))
        ka = B.key(B.load(fs[0]), 'g', bg)
        _, bx, by = B.body(ka[..., 3])
        a, b, mn, mx = c['loop']
        i, j = B.best_loop(fs, 'g', a, min(b, len(fs) - 1), mn, mx)
        n = c.get('n', min(12, j - i))
        idx = [round(i + (j - i) * q / n) for q in range(n)]
        fps = round(n * 24 / (j - i), 2)
        seq = [0] + idx
        start = len(tiles)
        for x in seq:
            k = B.key(B.load(fs[x]), 'g', bg)
            im = Image.fromarray(k.astype(np.uint8), 'RGBA')
            im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
            al = np.asarray(im)[..., 3]
            ys, xs = np.nonzero(al > 24)
            x0, y0, x1, y1 = max(0, xs.min() - 2), max(0, ys.min() - 2), min(im.width, xs.max() + 3), min(im.height, ys.max() + 3)
            tiles.append(im.crop((x0, y0, x1, y1)))
            anchors.append((bx * sc - x0, by * sc - y0))
        # 대기: 걷기 고리 중 실루엣이 가장 좁은 장면(팔·다리가 모인 자세). 첫 장면은 시트의 팔 벌린 자세라 어색하다
        ws = [tiles[start + 1 + q].width for q in range(n)]
        clips[d] = {'idle': start + 1 + int(np.argmin(ws)), 'walk': [start + 1, n], 'fps': fps}
        print(' ', d, 'loop', i, j, 'n', n, 'fps', fps)
    order = sorted(range(len(tiles)), key=lambda q: -tiles[q].height)
    pos = [None] * len(tiles); x = y = rowh = 0
    for q in order:
        t = tiles[q]
        if x + t.width > ATLAS_W: x = 0; y += rowh + 2; rowh = 0
        pos[q] = (x, y); x += t.width + 2; rowh = max(rowh, t.height)
    H = y + rowh
    atlas = Image.new('RGBA', (ATLAS_W, H), (0, 0, 0, 0))
    fr = []
    for q, t in enumerate(tiles):
        atlas.paste(t, pos[q])
        fr.append([pos[q][0], pos[q][1], t.width, t.height, round(anchors[q][0], 1), round(anchors[q][1], 1)])
    os.makedirs(OUT, exist_ok=True)
    out = f'{OUT}/c-{kind}.webp'
    atlas.save(out, quality=88, method=6)
    print(' atlas', ATLAS_W, H, len(fr), 'frames', os.path.getsize(out) // 1024, 'KB')
    return {'file': f'explore/c-{kind}.webp', 'W': ATLAS_W, 'H': H, 'h': cfg['height'], 'fr': fr, 'dirs': clips}


if __name__ == '__main__':
    conf = json.load(open(f'{ROOT}/sets.json'))
    data = json.load(open(DATA)) if os.path.exists(DATA) else {}
    for k in sys.argv[1:] or list(conf.keys()): data[k] = build(k, conf[k])
    json.dump(data, open(DATA, 'w'), ensure_ascii=False, separators=(',', ':'))
