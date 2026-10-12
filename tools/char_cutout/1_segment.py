import sys, numpy as np, onnxruntime as ort
from PIL import Image
sess = ort.InferenceSession('/tmp/claude-0/models/isnet-anime.onnx', providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0]
print(inp.name, inp.shape)
def mask(path, size=1024):
    im = Image.open(path).convert('RGB'); W, H = im.size
    x = np.asarray(im.resize((size, size), Image.BICUBIC), np.float32) / 255.
    x = (x - 0.5) / 1.0
    x = x.transpose(2, 0, 1)[None]
    out = sess.run(None, {inp.name: x})[0][0, 0]
    out = (out - out.min()) / (out.max() - out.min() + 1e-8)
    return np.asarray(Image.fromarray((out * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC))
import glob, os
for f in sorted(glob.glob('/home/claude/in_chars/Ability-Kingdom-Character-Additions/references/*/*')):
    m = mask(f)
    n = f.split('/')[-2] + '-' + os.path.basename(f).split('.')[0]
    Image.fromarray(m).save(f'/tmp/claude-0/cut/{n}-mask.png')
    print(n, m.mean())
