// 2D 그림에서 노멀맵을 만든다(브라우저에서 한 번 계산해 캐시).
// - 캐릭터: 알파를 흐리게 해 '둥근 베개' 높이를 만들고 밝기 디테일을 얹는다 → 가장자리가 둥글게 빛을 받음
// - 배경: 밝기를 높이로 써서 벽돌·보도블록 요철을 만든다
// 결과 좌표계: 화면 기준(x 오른쪽, y 아래, z 화면 밖). rgb = n * 0.5 + 0.5, a = 원본 알파

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), d = 2 * r + 1
  for (let y = 0; y < h; y++) {
    let acc = 0; const row = y * w
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) { tmp[row + x] = acc / d; acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)] }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) { out[y * w + x] = acc / d; acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x] }
  }
  return out
}

const cache = new Map<string, HTMLCanvasElement>()

export function makeNormal(img: HTMLImageElement, mode: 'sprite' | 'bg', key: string, scale = 0.5, cellH = 0): HTMLCanvasElement {
  const hit = cache.get(key); if (hit) return hit
  const w = Math.max(2, Math.round(img.naturalWidth * scale)), h = Math.max(2, Math.round(img.naturalHeight * scale))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, w, h)
  const px = g.getImageData(0, 0, w, h)
  const d = px.data, n = w * h
  const alpha = new Float32Array(n), lum = new Float32Array(n)
  for (let i = 0; i < n; i++) { alpha[i] = d[i * 4 + 3] / 255; lum[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255 }
  let height: Float32Array
  let k: number
  if (mode === 'sprite') {
    // 한 칸 높이에 맞춘 둥글기(칸이 작으면 반경도 작게)
    const base = (cellH ? cellH * scale : Math.min(w, h)) * 0.06
    const r1 = Math.max(2, Math.round(base)), r2 = Math.max(1, Math.round(base * 0.5))
    const pillow = boxBlur(boxBlur(alpha, w, h, r1), w, h, r2)
    const det = boxBlur(lum, w, h, 1)
    height = new Float32Array(n)
    for (let i = 0; i < n; i++) height[i] = Math.sqrt(pillow[i]) * 0.7 + det[i] * alpha[i] * 0.3
    k = 7 / Math.max(1, base) * 3.6
  } else {
    height = boxBlur(lum, w, h, 1)
    k = 4.5
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    const hl = height[i - (x > 0 ? 1 : 0)], hr = height[i + (x < w - 1 ? 1 : 0)]
    const hu = height[i - (y > 0 ? w : 0)], hd = height[i + (y < h - 1 ? w : 0)]
    let nx = -(hr - hl) * k, ny = -(hd - hu) * k, nz = 1
    const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L
    d[i * 4] = (nx * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; d[i * 4 + 2] = (nz * 0.5 + 0.5) * 255
    d[i * 4 + 3] = 255 // 알파는 원본 그림 것을 쓴다(캔버스가 투명 픽셀의 색을 지우지 않게 255)
  }
  g.putImageData(px, 0, 0)
  cache.set(key, c)
  return c
}
