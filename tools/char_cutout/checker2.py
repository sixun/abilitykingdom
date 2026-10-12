import numpy as np, cv2
def fit2(img, m, rng=np.arange(18.5, 22.01, 0.02)):
    c = img.astype(np.float32) / 255
    H, W = c.shape[:2]
    L = c.mean(axis=2)
    bg = m < 3
    def best1d(vals, coords):
        best = None
        for P in rng:
            b = np.floor((coords % P) / P * 20).astype(int)
            s = np.bincount(b, vals, 20); n = np.bincount(b, None, 20)
            t = s / np.maximum(n, 1)
            e = np.abs(vals - t[b]).mean()
            if best is None or e < best[0]: best = (e, P)
        return best[1]
    # x 주기: 배경이 많은 행들, y 주기: 배경이 많은 열들
    rows = [y for y in range(0, H, 7) if bg[y].mean() > 0.8][:20]
    cols = [x for x in range(0, W, 7) if bg[:, x].mean() > 0.8][:20]
    Px = np.median([best1d(L[y][bg[y]], np.nonzero(bg[y])[0].astype(float)) for y in rows])
    Py = np.median([best1d(L[:, x][bg[:, x]], np.nonzero(bg[:, x])[0].astype(float)) for x in cols])
    yy, xx = np.mgrid[0:H, 0:W]
    key = np.floor((yy % Py) / Py * 20).astype(int) * 20 + np.floor((xx % Px) / Px * 20).astype(int)
    sums = np.zeros((400, 3)); cnt = np.zeros(400)
    np.add.at(sums, key[bg], c[bg]); np.add.at(cnt, key[bg], 1)
    tpl = (sums / np.maximum(cnt, 1)[:, None])[key]
    err = np.abs(c[bg] - tpl[bg]).mean()
    print('Px', round(Px, 3), 'Py', round(Py, 3), 'err', round(float(err), 4))
    return tpl
