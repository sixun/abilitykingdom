"""모션 에셋 패키지(Ability-Kingdom-Motion-Assets)를 앱용 영상으로 가공한다.
- 반복 이음새: 마지막 4프레임(약 0.17초)을 처음 프레임과 섞어 끊김 없이 반복되게 한다.
- 캐릭터 알파 영상: 가장자리(외곽 5px) 마젠타 번짐 제거 + 1080×1080으로 축소, VP9 알파 WebM 재인코딩.
- 로비 영상: H.264 MP4(faststart), 포스터는 반복 첫 프레임.
사용: python3 tools/build_motion_assets.py <Ability-Kingdom-Motion-Assets 폴더>"""
import os, subprocess, sys
import numpy as np, cv2
from PIL import Image

SRC = sys.argv[1] + '/assets'
OUT = 'public/motion'
os.makedirs(OUT, exist_ok=True)
FADE = 4


def read_frames(path, w, h, alpha):
    pix = 'rgba' if alpha else 'rgb24'
    dec = ['-c:v', 'libvpx-vp9'] if alpha else []
    p = subprocess.run(['ffmpeg', '-v', 'error', *dec, '-i', path, '-f', 'rawvideo', '-pix_fmt', pix, '-'], capture_output=True, check=True)
    c = 4 if alpha else 3
    return np.frombuffer(p.stdout, np.uint8).reshape(-1, h, w, c)


def loop_blend(fr):
    """마지막 FADE 프레임을 처음 FADE 프레임과 섞고, 길이를 FADE만큼 줄인다"""
    n = len(fr)
    out = fr[:n - FADE].copy()
    for i in range(FADE):
        t = (i + 1) / (FADE + 1)
        out[i] = (fr[n - FADE + i].astype(np.float32) * (1 - t) + fr[i].astype(np.float32) * t).round().astype(np.uint8)
    return out


def despill(f):
    """외곽 띠의 마젠타 번짐(빨강·파랑이 초록보다 높은 성분)을 줄인다"""
    a = f[..., 3]
    solid = (a > 200).astype(np.uint8)
    edge = (cv2.dilate(1 - solid, np.ones((11, 11), np.uint8)) > 0) & (a > 0)
    rgb = f[..., :3].astype(np.int16)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    m = np.minimum(r, b)
    spill = np.clip(m - g, 0, 255) * edge
    rgb[..., 0] -= spill; rgb[..., 2] -= spill
    f = f.copy(); f[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    # 알파 1px 수축으로 남은 색 테두리 정리
    f[..., 3] = cv2.erode(a, np.ones((3, 3), np.uint8))
    return f


def encode(frames, path, alpha, w, h):
    if alpha:
        args = ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-crf', '31', '-b:v', '0', '-row-mt', '1', '-auto-alt-ref', '0', '-deadline', 'good', '-cpu-used', '2']
        pix = 'rgba'
    else:
        args = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'slow', '-movflags', '+faststart', '-profile:v', 'high']
        pix = 'rgb24'
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', pix, '-s', f'{w}x{h}', '-r', '24', '-i', '-', '-an', *args, path], stdin=subprocess.PIPE)
    p.stdin.write(frames.tobytes()); p.stdin.close(); p.wait()


for key in ('sofa', 'station'):
    fr = loop_blend(read_frames(f'{SRC}/{key}.mp4', 1920, 1080, False))
    encode(fr, f'{OUT}/{key}.mp4', False, 1920, 1080)
    Image.fromarray(fr[0]).save(f'{OUT}/{key}-poster.webp', quality=88)
    # 크롬·안드로이드용 VP9(H.264를 못 쓰는 브라우저 대비), 사파리·iOS는 MP4
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{OUT}/{key}.mp4', '-c:v', 'libvpx-vp9', '-crf', '33', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-an', f'{OUT}/{key}.webm'], check=True)
    print(key, len(fr), os.path.getsize(f'{OUT}/{key}.mp4'))

for key in ('detail', 'recruit'):
    fr = read_frames(f'{SRC}/{key}-alpha.webm', 1440, 1440, True)
    fr = np.stack([cv2.resize(despill(f), (1080, 1080), interpolation=cv2.INTER_AREA) for f in fr])
    fr = loop_blend(fr)
    encode(fr, f'{OUT}/{key}.webm', True, 1080, 1080)
    Image.fromarray(fr[0], 'RGBA').save(f'{OUT}/{key}-poster.webp', quality=90)
    print(key, len(fr), os.path.getsize(f'{OUT}/{key}.webm'))
