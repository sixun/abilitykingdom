"""tools/make_app_icons.py 결과를 안드로이드·iOS·웹(PWA) 프로젝트에 넣는다.
사용: python3 tools/make_app_icons.py <리온 PNG> app-icons && python3 tools/apply_native_assets.py app-icons"""
import os, sys, shutil
from PIL import Image, ImageDraw

I = sys.argv[1]
icon = Image.open(f'{I}/icon-1024.png').convert('RGB')
fg = Image.open(f'{I}/adaptive-foreground.png').convert('RGBA')
bg = Image.open(f'{I}/adaptive-background.png').convert('RGB')

def round_mask(n):
    m = Image.new('L', (n, n), 0); ImageDraw.Draw(m).ellipse((0, 0, n - 1, n - 1), fill=255); return m

def splash(w, h):
    """검정 바탕 + 가운데 작은 아이콘(둥근 모서리)"""
    s = Image.new('RGB', (w, h), (0, 0, 0))
    n = int(min(w, h) * 0.22)
    ic = icon.resize((n, n), Image.LANCZOS)
    m = Image.new('L', (n, n), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, n - 1, n - 1), radius=int(n * 0.22), fill=255)
    s.paste(ic, ((w - n) // 2, (h - n) // 2), m)
    return s

# ── Android
R = 'android/app/src/main/res'
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in DENS.items():
    n = int(48 * k); a = int(108 * k)
    icon.resize((n, n), Image.LANCZOS).save(f'{R}/mipmap-{d}/ic_launcher.png')
    r = icon.resize((n, n), Image.LANCZOS).convert('RGBA'); r.putalpha(round_mask(n)); r.save(f'{R}/mipmap-{d}/ic_launcher_round.png')
    fg.resize((a, a), Image.LANCZOS).save(f'{R}/mipmap-{d}/ic_launcher_foreground.png')
    bg.resize((a, a), Image.LANCZOS).save(f'{R}/mipmap-{d}/ic_launcher_background.png')
    for o, (w, h) in {'land': (480, 320), 'port': (320, 480)}.items():
        splash(int(w * k), int(h * k)).save(f'{R}/drawable-{o}-{d}/splash.png')
splash(480, 320).save(f'{R}/drawable/splash.png')
for name in ('ic_launcher', 'ic_launcher_round'):
    open(f'{R}/mipmap-anydpi-v26/{name}.xml', 'w').write(
        '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '</adaptive-icon>\n')

# ── iOS
A = 'ios/App/App/Assets.xcassets'
icon.save(f'{A}/AppIcon.appiconset/AppIcon-512@2x.png')
for f in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
    splash(2732, 2732).save(f'{A}/Splash.imageset/{f}')

# ── 웹(PWA·홈 화면 추가)
os.makedirs('public/icons', exist_ok=True)
for f in ('pwa-512.png', 'pwa-192.png', 'apple-touch-icon.png', 'favicon-48.png'):
    shutil.copy(f'{I}/{f}', f'public/icons/{f}')
print('ok')
