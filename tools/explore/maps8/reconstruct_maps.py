"""Run: python3 reconstruct_maps.py (requires Pillow). Writes reconstructed/*.png."""
import json
from pathlib import Path
from PIL import Image, ImageChops

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'map_manifest.json').read_text(encoding='utf-8'))
destination = root  # 이 저장소: tools/explore/maps8/<맵>.png
destination.mkdir(exist_ok=True)
for item in manifest['maps']:
    canvas = Image.new('RGB', tuple(item['canvas_size']))
    covered = Image.new('L', canvas.size, 0)
    for view in item['views']:
        tile = Image.open(root / view['file']).convert('RGB')
        assert list(tile.size) == view['size'], view['file']
        x, y = view['origin']
        box = (x, y, x + tile.width, y + tile.height)
        difference = ImageChops.difference(canvas.crop(box), tile)
        overlap = Image.composite(difference, Image.new('RGB', tile.size), covered.crop(box))
        assert not any(channel.getbbox() for channel in overlap.split()), 'Overlap mismatch: ' + view['file']
        canvas.paste(tile, (x, y))
        covered.paste(255, box)
    assert covered.getextrema() == (255, 255), 'Uncovered map pixels'
    target = destination / (item['id'] + '.png')
    canvas.save(target)
    print('Verified and reconstructed:', target.name, canvas.size)
