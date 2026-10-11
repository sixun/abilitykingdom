"""Black Han Sans를 앱에서 실제로 쓰는 한글만 남겨 1개 파일로 만든다.
src/ 안의 문자열이 바뀌면 다시 실행: python3 tools/subset_font.py
(필요: pip install fonttools brotli, npm i @fontsource/black-han-sans)
사용자 입력(팀 이름 등)의 글자가 없으면 브라우저가 기본 글꼴로 대체한다."""
import json, re, glob, os
from fontTools.ttLib import TTFont
from fontTools.merge import Merger
from fontTools import subset

SRC = 'node_modules/@fontsource/black-han-sans'
OUT = 'src/assets/fonts/black-han-sans-subset.woff2'
chars = set()
for f in glob.glob('src/**/*.ts*', recursive=True):
    chars |= set(re.findall(r'[가-힣]', open(f, encoding='utf-8').read()))

def covers(cp, spec):
    for part in spec.split(','):
        part = part.strip()[2:]
        a, b = part.split('-') if '-' in part else (part, part)
        if int(a, 16) <= cp <= int(b, 16):
            return True
    return False

uni = json.load(open(f'{SRC}/unicode.json'))
need = [k.strip('[]') for k, spec in uni.items() if k == 'latin' or any(covers(ord(c), spec) for c in chars)]
tmp = []
for i, k in enumerate(need):
    p = f'{SRC}/files/black-han-sans-{k}-400-normal.woff2'
    if not os.path.exists(p):
        continue
    t = TTFont(p); t.flavor = None
    out = f'/tmp/bhs-part-{i}.ttf'; t.save(out); tmp.append(out)
font = Merger().merge(tmp)
text = ''.join(sorted(chars)) + ''.join(chr(c) for c in range(0x20, 0x7f)) + '·…“”‘’→★×'
opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']
ss = subset.Subsetter(opts); ss.populate(text=text); ss.subset(font)
font.flavor = 'woff2'; font.save(OUT)
print(f'{OUT}: {len(chars)} hangul, {os.path.getsize(OUT)} bytes')
