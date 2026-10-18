// 스토리 탐색(2.5D) WebGL2 렌더러.
// 한 프레임: ① 장면 버퍼에 지도 조각 → 그림자(해가 왼쪽 위라 오른쪽 아래로 눕는 실루엣 + 발밑 접촉 그림자)
//            → 캐릭터·NPC(발 y로 앞뒤 정렬, 노멀맵 햇빛·림라이트·가로등, '가림 지도'로 기둥·난간 뒤면 가려짐) → 꽃잎·빛먼지
//          ② 화면 합성: 블룸 · 위아래 흐림(틸트시프트) · 햇살 줄기 · 따뜻한 색보정 · 비네트
// 품질 '낮음'은 ②를 건너뛰고 화면에 바로 그린다(조명·그림자·가림은 그대로)
import { makeNormal } from '../battle/normals'
import type { Zone } from './zones'
import SPR from '../game/data/explore-sprites.json'

const W = 1280, H = 720
type Tex = { t: WebGLTexture; w: number; h: number }
export type Dir = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW'
export const DIRS: Dir[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] // 각도 순서(0=오른쪽, 시계 방향)
interface SpriteSet { file: string; W: number; H: number; h: number; fr: number[][]; dirs: Partial<Record<Dir, { idle: number; walk: [number, number]; fps: number }>> }
export const SPRITES = SPR as unknown as Record<string, SpriteSet>

export interface Actor { id: string; kind: string; x: number; y: number; dir: Dir; moving: boolean; run: boolean; t: number; img?: string; flash?: number; alpha?: number }

const VS = `#version 300 es
in vec2 aPos; in vec2 aUv; uniform vec3 uView; uniform vec2 uCam; out vec2 vUv; out vec2 vW;
void main(){ vUv = aUv; vW = aPos; vec2 sp = (aPos - uView.xy) * uView.z + vec2(${W / 2}.0, ${H / 2}.0) + uCam; vec2 p = sp / vec2(${W}.0, ${H}.0) * 2.0 - 1.0; gl_Position = vec4(p.x, -p.y, 0.0, 1.0); }`
const FS_MAP = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform float uDim;
void main(){ vec3 c = texture(uTex, vUv).rgb; o = vec4(c * uDim, 1.0); }`
const FS_CHAR = `#version 300 es
precision highp float; in vec2 vUv; in vec2 vW; out vec4 o;
uniform sampler2D uTex; uniform sampler2D uNrm; uniform sampler2D uOcc; uniform vec2 uMap; uniform float uFoot; uniform float uFlip;
uniform vec3 uAmb; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uShadow; uniform float uAlpha; uniform float uFlash;
uniform vec4 uL; uniform vec3 uLC; uniform vec4 uClip;
void main(){
  if (vUv.x < uClip.x || vUv.x > uClip.z || vUv.y < uClip.y || vUv.y > uClip.w) discard;
  vec4 c = texture(uTex, vUv); if (c.a < 0.02) discard;
  vec4 oc = texture(uOcc, vW / uMap);
  if (oc.a > 0.5) { float base = (floor(oc.r * 255.0 + 0.5) * 256.0 + floor(oc.g * 255.0 + 0.5)) * 2.0; if (base > uFoot + 6.0) discard; }
  if (uShadow > 0.0) { float a = c.a * uShadow; o = vec4(0.05 * a, 0.03 * a, 0.09 * a, a); return; }
  vec3 rgb = c.rgb / c.a;
  vec3 n = texture(uNrm, vUv).xyz * 2.0 - 1.0; n.x *= uFlip; n = normalize(n + vec3(0.0, 0.0, 0.001));
  vec3 L = normalize(uSunDir);
  float d = max(dot(n, L), 0.0);
  float cel = smoothstep(0.32, 0.4, d) * 0.6 + d * 0.4;   // 셀 셰이딩: 명암 경계를 또렷하게
  vec3 col = rgb * (uAmb + uSun * cel);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.2) * max(dot(normalize(n.xy + 1e-4), normalize(L.xy)), 0.0);
  col += vec3(1.0, 0.86, 0.7) * rim * 0.28;
  if (uL.w > 0.0) { vec2 dl = uL.xy - vW; float att = clamp(1.0 - length(dl) / uL.z, 0.0, 1.0); att *= att;
    col += rgb * uLC * att * uL.w * (0.35 + 0.65 * max(dot(n, normalize(vec3(dl, 120.0))), 0.0)); }
  col = mix(col, vec3(1.0), uFlash);
  o = vec4(col * c.a, c.a) * uAlpha;
}`
const FS_SHAPE = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform vec4 uC; uniform int uMode;
void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a;
  if (uMode == 0) a = smoothstep(1.0, 0.15, r);                                      // 부드러운 원(접촉 그림자·빛먼지)
  else if (uMode == 1) { a = smoothstep(1.0, 0.75, length(p * vec2(1.0, 1.9))) * (0.75 + 0.25 * p.y); } // 꽃잎
  else a = smoothstep(1.0, 0.0, r) * smoothstep(1.0, 0.4, r);
  o = vec4(uC.rgb * uC.a * a, uC.a * a); }`
const FS_POST = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uScene; uniform float uT; uniform float uDof; uniform float uBloom; uniform float uLetter; uniform float uFade;
void main(){
  vec2 tu = vUv;                       // 텍스처 좌표(아래가 0)
  vec2 sc = vec2(vUv.x, 1.0 - vUv.y);  // 화면 좌표(위가 0)
  vec3 c = texture(uScene, tu).rgb;
  float f = smoothstep(0.2, 0.52, abs(sc.y - 0.55)) * uDof;   // 틸트시프트: 화면 위·아래를 흐리게
  c = mix(c, textureLod(uScene, tu, 1.6).rgb * 0.5 + textureLod(uScene, tu, 2.6).rgb * 0.5, f);
  vec3 b = textureLod(uScene, tu, 3.0).rgb * 0.45 + textureLod(uScene, tu, 4.5).rgb * 0.35 + textureLod(uScene, tu, 6.0).rgb * 0.2;
  c += max(b - 0.8, 0.0) * 1.2 * uBloom;
  float v = dot(sc * vec2(1.78, 1.0), normalize(vec2(0.78, -0.62)));   // 왼쪽 위에서 비스듬히 내려오는 햇살 줄기
  float band = pow(sin(v * 9.0 + uT * 0.15) * 0.5 + 0.5, 6.0) + pow(sin(v * 23.0 - uT * 0.1 + 1.7) * 0.5 + 0.5, 10.0) * 0.6;
  float fall = clamp(1.0 - length(sc * vec2(0.85, 1.1)), 0.0, 1.0);
  c += vec3(1.0, 0.83, 0.62) * band * fall * 0.05 * uBloom;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c * vec3(0.97, 0.97, 1.03), c * vec3(1.02, 1.0, 0.97), smoothstep(0.25, 0.8, l));
  c = mix(vec3(l), c, 1.06);
  vec2 q = sc - 0.5; c *= 1.0 - dot(q, q) * 0.55;
  if (sc.y < uLetter || sc.y > 1.0 - uLetter) c = vec3(0.0);
  o = vec4(c * uFade, 1.0);
}`

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const mk = (t: number, s: string) => { const sh = gl.createShader(t)!; gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader'); return sh }
  const p = gl.createProgram()!
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs))
  gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aUv'); gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  const cache = new Map<string, WebGLUniformLocation | null>()
  return { p, u: (n: string) => { if (!cache.has(n)) cache.set(n, gl.getUniformLocation(p, n)); return cache.get(n)! } }
}
type Prog = ReturnType<typeof compile>
type Petal = { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; ph: number; c: [number, number, number] }
type Mote = { x: number; y: number; ph: number; s: number }

export class ExploreRenderer {
  gl: WebGL2RenderingContext
  ready = false
  scale = 1
  quality: 'high' | 'low' = 'high'
  view = { x: 0, y: 0, z: 0.5 }
  letter = 0
  fade = 1
  private progs: Record<'map' | 'chr' | 'shape' | 'post', Prog>
  private vbo: WebGLBuffer
  private tiles: { t: Tex; x: number; y: number; w: number; h: number }[] = []
  private occ: Tex | null = null
  private tex = new Map<string, Tex>()
  private nrm = new Map<string, Tex>()
  private fbo: { f: WebGLFramebuffer; t: WebGLTexture; w: number; h: number } | null = null
  private petals: Petal[] = []
  private motes: Mote[] = []
  zone!: Zone
  walk: { data: Uint8ClampedArray; w: number; h: number } | null = null
  lowImg: HTMLImageElement | null = null

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: false })
    if (!gl) throw new Error('webgl2')
    this.gl = gl
    this.progs = { map: compile(gl, VS, FS_MAP), chr: compile(gl, VS, FS_CHAR), shape: compile(gl, VS, FS_SHAPE), post: compile(gl, VS, FS_POST) }
    const vao = gl.createVertexArray()!; gl.bindVertexArray(vao)
    this.vbo = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bufferData(gl.ARRAY_BUFFER, 16 * 4, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
  }

  private upload(src: TexImageSource & { width: number; height: number }, o: { mip?: boolean; raw?: boolean } = {}): Tex {
    const gl = this.gl; const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !o.raw)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, o.raw ? gl.NONE : gl.BROWSER_DEFAULT_WEBGL)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const f = o.raw ? gl.NEAREST : gl.LINEAR
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f)
    if (o.mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR) } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL)
    return { t, w: src.width, h: src.height }
  }
  private img(src: string) { return new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(src)); i.src = src }) }

  /** 구역 그림·가림 지도·걷기 영역·캐릭터 묶음을 받는다. progress 0~1 */
  async load(zone: Zone, kinds: string[], npcImgs: string[], low: boolean, onProgress?: (p: number) => void) {
    this.zone = zone
    const d = zone.dir
    const tileFiles = low ? [`${d}/low.webp`] : [0, 1, 2, 3].map((i) => `${d}/t${i}.webp`)
    const files = [...tileFiles, `${d}/occ.png`, `${d}/walk.png`, ...kinds.map((k) => SPRITES[k].file), ...npcImgs]
    let done = 0
    const step = () => onProgress?.(++done / files.length)
    const imgs = await Promise.all(files.map((f) => this.img(f).then((i) => { step(); return i })))
    const hw = zone.W / 2, hh = zone.H / 2
    this.tiles = low
      ? [{ t: this.upload(imgs[0], { mip: true }), x: 0, y: 0, w: zone.W, h: zone.H }]
      : [0, 1, 2, 3].map((i) => ({ t: this.upload(imgs[i], { mip: true }), x: (i % 2) * hw, y: Math.floor(i / 2) * hh, w: hw, h: hh }))
    let k = tileFiles.length
    this.occ = this.upload(imgs[k++], { raw: true })
    const wi = imgs[k++]
    const c = document.createElement('canvas'); c.width = wi.width; c.height = wi.height
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(wi, 0, 0)
    this.walk = { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }
    for (const f of [...kinds.map((x) => SPRITES[x].file), ...npcImgs]) {
      const im = imgs[k++]
      this.tex.set(f, this.upload(im, { mip: true }))
      await new Promise((r) => setTimeout(r, 0))
      this.nrm.set(f, this.upload(makeNormal(im, 'sprite', f, 0.5, 0), { mip: true }))
    }
    this.lowImg = await this.img(`${d}/low.webp`)
    this.ready = true
  }
  /** 발 위치가 걸을 수 있는 바닥인지 */
  walkable(x: number, y: number) {
    const w = this.walk; if (!w) return false
    const k = w.w / this.zone.W
    const ix = Math.round(x * k), iy = Math.round(y * k)
    if (ix < 0 || iy < 0 || ix >= w.w || iy >= w.h) return false
    return w.data[(iy * w.w + ix) * 4] > 127
  }

  resize(cssW: number, dpr: number) {
    const k = Math.min(this.quality === 'low' ? 1 : 1.6, dpr * (cssW / W))
    const w = Math.round(W * k), h = Math.round(H * k)
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.fbo = null }
    this.scale = k
  }
  private ensureFbo() {
    const gl = this.gl, w = this.canvas.width, h = this.canvas.height
    if (this.fbo && this.fbo.w === w && this.fbo.h === h) return this.fbo
    if (this.fbo) { gl.deleteFramebuffer(this.fbo.f); gl.deleteTexture(this.fbo.t) }
    const t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t)
    const lv = Math.floor(Math.log2(Math.max(w, h))) + 1
    gl.texStorage2D(gl.TEXTURE_2D, lv, gl.RGBA8, w, h)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const f = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
    this.fbo = { f, t, w, h }
    return this.fbo
  }

  private quad(p: number[], uv: number[]) {
    const gl = this.gl; const d = new Float32Array(16)
    for (let i = 0; i < 4; i++) { d[i * 4] = p[i * 2]; d[i * 4 + 1] = p[i * 2 + 1]; d[i * 4 + 2] = uv[i * 2]; d[i * 4 + 3] = uv[i * 2 + 1] }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
  private use(p: Prog) { const gl = this.gl; gl.useProgram(p.p); gl.uniform3f(p.u('uView'), this.view.x, this.view.y, this.view.z); gl.uniform2f(p.u('uCam'), 0, 0); return p }
  private shape(mode: number, cx: number, cy: number, w: number, h: number, rot: number, c: [number, number, number, number], add = false) {
    const gl = this.gl; const p = this.use(this.progs.shape)
    gl.uniform4f(p.u('uC'), c[0], c[1], c[2], c[3]); gl.uniform1i(p.u('uMode'), mode)
    gl.blendFunc(gl.ONE, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA)
    const cs = Math.cos(rot), sn = Math.sin(rot), pts: number[] = []
    for (const [ux, uy] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) { const x = ux * w, y = uy * h; pts.push(cx + x * cs - y * sn, cy + x * sn + y * cs) }
    this.quad(pts, [0, 0, 1, 0, 0, 1, 1, 1])
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  /** 캐릭터 한 명 그릴 정보: 텍스처·사각형·uv */
  private frameOf(a: Actor): { file: string; pts: number[]; uv: number[]; flip: number; foot: number; h: number } | null {
    const z = this.zone
    if (a.img) {
      const T = this.tex.get(a.img); if (!T) return null
      const h = z.charH * (a.kind === 'npc-s' ? 0.94 : 1), w = T.w * h / T.h
      const b = a.y + h * 0.035 // 그림 아래쪽 접촉 그림자만큼 내림
      const pts = [a.x - w / 2, b - h, a.x + w / 2, b - h, a.x - w / 2, b, a.x + w / 2, b]
      return { file: a.img, pts, uv: [0, 0, 1, 0, 0, 1, 1, 1], flip: 1, foot: a.y, h }
    }
    const S = SPRITES[a.kind]; if (!S) return null
    let dir = a.dir, flip = 1
    if (!S.dirs[dir]) { // 없는 방향: 좌우 반대 방향이 있으면 뒤집어 쓰고, 없으면 가장 가까운 방향
      const mirror: Record<Dir, Dir> = { S: 'S', N: 'N', E: 'W', W: 'E', SE: 'SW', SW: 'SE', NE: 'NW', NW: 'NE' }
      if (S.dirs[mirror[dir]]) { dir = mirror[dir]; flip = -1 } else dir = (Object.keys(S.dirs)[0] as Dir)
    }
    const D = S.dirs[dir]!
    const fps = D.fps * (a.run ? 1.7 : 1)
    const idx = a.moving ? D.walk[0] + Math.floor(a.t * fps) % D.walk[1] : D.idle
    const [fx, fy, fw, fh, ax, ay] = S.fr[idx]
    const k = z.charH / S.h
    const breathe = a.moving ? 1 : 1 + Math.sin(a.t * 2.2) * 0.012
    const x0 = a.x - ax * k * flip, y0 = a.y - ay * k * breathe
    const x1 = x0 + fw * k * flip, y1 = y0 + fh * k * breathe
    const pts = [x0, y0, x1, y0, x0, y1, x1, y1]
    const uv = [fx / S.W, fy / S.H, (fx + fw) / S.W, fy / S.H, fx / S.W, (fy + fh) / S.H, (fx + fw) / S.W, (fy + fh) / S.H]
    return { file: S.file, pts, uv, flip, foot: a.y, h: fh * k }
  }

  private drawActor(a: Actor, f: NonNullable<ReturnType<ExploreRenderer['frameOf']>>, shadow: number) {
    const gl = this.gl, z = this.zone
    const T = this.tex.get(f.file)!, N = this.nrm.get(f.file)!
    const p = this.use(this.progs.chr)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.t); gl.uniform1i(p.u('uTex'), 0)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, N.t); gl.uniform1i(p.u('uNrm'), 1)
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.occ!.t); gl.uniform1i(p.u('uOcc'), 2)
    gl.uniform2f(p.u('uMap'), z.W, z.H); gl.uniform1f(p.u('uFoot'), f.foot); gl.uniform1f(p.u('uFlip'), f.flip)
    gl.uniform3f(p.u('uAmb'), ...z.light.amb); gl.uniform3f(p.u('uSun'), ...z.light.sun); gl.uniform3f(p.u('uSunDir'), ...z.light.dir)
    gl.uniform1f(p.u('uShadow'), shadow); gl.uniform1f(p.u('uAlpha'), a.alpha ?? 1); gl.uniform1f(p.u('uFlash'), a.flash ?? 0)
    const um = Math.min(f.uv[0], f.uv[2]), uM = Math.max(f.uv[0], f.uv[2])
    gl.uniform4f(p.u('uClip'), um - 0.0001, f.uv[1] - 0.0001, uM + 0.0001, f.uv[5] + 0.0001)
    const L = z.lamps.map((l) => ({ l, d: Math.hypot(l.x - a.x, l.y - a.y) })).sort((x, y) => x.d - y.d)[0]
    if (L && L.d < L.l.r) { gl.uniform4f(p.u('uL'), L.l.x, L.l.y, L.l.r, L.l.i); gl.uniform3f(p.u('uLC'), ...L.l.c) } else gl.uniform4f(p.u('uL'), 0, 0, 1, 0)
    if (shadow > 0) {
      // 해 그림자: 발 높이는 그대로, 머리 쪽은 오른쪽 아래로 눕힌다
      const [sx, sy] = z.light.shadow
      const pts = f.pts.slice()
      for (let i = 0; i < 4; i++) { const hgt = f.foot - pts[i * 2 + 1]; pts[i * 2] += hgt * sx; pts[i * 2 + 1] = f.foot + hgt * sy }
      this.quad(pts, f.uv)
    } else this.quad(f.pts, f.uv)
  }

  private tickAir(dt: number) {
    const v = this.view, hw = W / 2 / v.z, hh = H / 2 / v.z
    const want = this.quality === 'low' ? 18 : 46
    while (this.petals.length < want) {
      const pink = Math.random()
      this.petals.push({ x: v.x - hw + Math.random() * hw * 2.4, y: v.y - hh - Math.random() * hh * 2, vx: 40 + Math.random() * 50, vy: 45 + Math.random() * 40, r: Math.random() * 6, vr: (Math.random() - 0.5) * 3, s: 9 + Math.random() * 9, ph: Math.random() * 6, c: pink < 0.8 ? [1, 0.72 + pink * 0.1, 0.82] : [1, 0.93, 0.95] })
    }
    for (const p of this.petals) { p.ph += dt; p.x += (p.vx + Math.sin(p.ph * 1.7) * 35) * dt; p.y += p.vy * dt; p.r += p.vr * dt }
    this.petals = this.petals.filter((p) => p.y < v.y + hh + 40 && p.x < v.x + hw + 80)
    while (this.motes.length < (this.quality === 'low' ? 0 : 26)) this.motes.push({ x: v.x - hw + Math.random() * hw * 2, y: v.y - hh + Math.random() * hh * 2, ph: Math.random() * 9, s: 5 + Math.random() * 8 })
    for (const m of this.motes) { m.ph += dt * 0.6; m.x += Math.sin(m.ph) * 6 * dt + 4 * dt; m.y -= 3 * dt; if (Math.abs(m.x - v.x) > hw * 1.1 || Math.abs(m.y - v.y) > hh * 1.1) { m.x = v.x - hw + Math.random() * hw * 2; m.y = v.y - hh + Math.random() * hh * 2 } }
  }

  render(actors: Actor[], t: number, dt: number, shake = 0) {
    if (!this.ready) return
    const gl = this.gl
    this.tickAir(dt)
    const post = this.quality !== 'low'
    if (post) { const fb = this.ensureFbo(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb.f) } else gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const sv = { ...this.view }
    if (shake) { this.view.x += (Math.random() - 0.5) * shake * 30; this.view.y += (Math.random() - 0.5) * shake * 30 }
    // ① 지도
    const pm = this.use(this.progs.map); gl.uniform1f(pm.u('uDim'), 1)
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(pm.u('uTex'), 0)
    for (const tl of this.tiles) { gl.bindTexture(gl.TEXTURE_2D, tl.t.t); this.quad([tl.x, tl.y, tl.x + tl.w, tl.y, tl.x, tl.y + tl.h, tl.x + tl.w, tl.y + tl.h], [0, 0, 1, 0, 0, 1, 1, 1]) }
    // ② 그림자
    const frames = actors.map((a) => ({ a, f: this.frameOf(a) })).filter((x) => x.f) as { a: Actor; f: NonNullable<ReturnType<ExploreRenderer['frameOf']>> }[]
    for (const { a, f } of frames) this.shape(0, a.x + 6, a.y - 4, f.h * 0.42, f.h * 0.11, 0, [0.06, 0.03, 0.1, 0.42 * (a.alpha ?? 1)])
    for (const { a, f } of frames) this.drawActor(a, f, 0.26 * (a.alpha ?? 1))
    // ③ 캐릭터(뒤 → 앞)
    frames.sort((p, q) => p.a.y - q.a.y)
    for (const { a, f } of frames) this.drawActor(a, f, 0)
    // ④ 꽃잎·빛먼지
    for (const p of this.petals) this.shape(1, p.x, p.y, p.s, p.s * 0.62, p.r, [p.c[0], p.c[1], p.c[2], 0.9])
    for (const m of this.motes) this.shape(0, m.x, m.y, m.s, m.s, 0, [1, 0.85, 0.6, 0.18 + Math.sin(m.ph * 2) * 0.1], true)
    this.view.x = sv.x; this.view.y = sv.y
    // ⑤ 합성
    if (post) {
      const fb = this.fbo!
      gl.bindTexture(gl.TEXTURE_2D, fb.t); gl.generateMipmap(gl.TEXTURE_2D)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height)
      gl.disable(gl.BLEND)
      const pp = this.progs.post; gl.useProgram(pp.p)
      gl.uniform3f(pp.u('uView'), W / 2, H / 2, 1); gl.uniform2f(pp.u('uCam'), 0, 0)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fb.t); gl.uniform1i(pp.u('uScene'), 0)
      gl.uniform1f(pp.u('uT'), t); gl.uniform1f(pp.u('uDof'), 1); gl.uniform1f(pp.u('uBloom'), 1); gl.uniform1f(pp.u('uLetter'), this.letter); gl.uniform1f(pp.u('uFade'), this.fade)
      this.quad([0, 0, W, 0, 0, H, W, H], [0, 1, 1, 1, 0, 0, 1, 0])
    }
  }
  dispose() { const gl = this.gl; for (const x of [...this.tex.values(), ...this.nrm.values()]) gl.deleteTexture(x.t); for (const x of this.tiles) gl.deleteTexture(x.t.t); if (this.occ) gl.deleteTexture(this.occ.t) }
}
