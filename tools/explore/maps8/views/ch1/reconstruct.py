"""1챕터 맵 02·04·05(사용자 제공, 카메라 화면 12장) 복원: coordinates.json 좌표에 놓고 겹침 픽셀 일치를 검사한 뒤
tools/explore/maps8/academy_{shopping,approach,central}.png 로 저장. 실행: python3 tools/explore/maps8/views/ch1/reconstruct.py"""
import json
from pathlib import Path
from PIL import Image, ImageChops
root = Path(__file__).resolve().parent
NAME = {'02_shopping': 'academy_shopping', '04_approach': 'academy_approach', '05_central_hall': 'academy_central'}
for item in json.loads((root / 'coordinates.json').read_text())['maps']:
    canvas = Image.new('RGB', tuple(item['canvas_size'])); covered = Image.new('L', canvas.size, 0)
    for v in item['views']:
        t = Image.open(root / v['file']).convert('RGB'); x, y = v['origin']; box = (x, y, x + t.width, y + t.height)
        ov = Image.composite(ImageChops.difference(canvas.crop(box), t), Image.new('RGB', t.size), covered.crop(box))
        assert not any(c.getbbox() for c in ov.split()), 'Overlap mismatch: ' + v['file']
        canvas.paste(t, (x, y)); covered.paste(255, box)
    assert covered.getextrema() == (255, 255), 'Uncovered pixels'
    canvas.save(root.parent.parent / f"{NAME[item['map']]}.png"); print('Verified and reconstructed:', NAME[item['map']], canvas.size)
