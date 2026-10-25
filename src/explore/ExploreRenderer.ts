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
precision highp float; in vec2 vUv; in vec2 vW; out vec4 o;
uniform sampler2D uTex; uniform sampler2D uAnim; uniform vec4 uTile; uniform vec2 uWorld; uniform float uT; uniform float uWind; uniform float uDim;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// 그림은 절대 일그러뜨리지 않는다(예전 UV 흔들기는 젤리처럼 보여 폐기).
// 물 영역에만 위에 빛 무늬(물결 반사)와 반짝임을 더한다.
void main(){
  vec2 uv = (vW - uTile.xy) / uTile.zw;
  vec3 c = texture(uTex, clamp(uv, vec2(0.0005), vec2(0.9995))).rgb;
  float wm = texture(uAnim, vW / uWorld).g;
  if (wm > 0.02) {
    vec2 p = vW * 0.03;
    float a = sin(p.x * 1.7 + p.y * 0.9 - uT * 1.3) * sin(p.y * 2.3 - p.x * 0.6 + uT * 0.9);
    float b = sin(p.x * 3.1 - p.y * 1.4 + uT * 1.9) * sin(p.y * 1.1 + uT * 0.7);
    float caust = smoothstep(0.35, 0.95, a * 0.6 + b * 0.4 + 0.25);
    c += wm * caust * vec3(0.07, 0.1, 0.12);
    float tw = h21(floor(vW / 5.0) + floor(uT * 4.0));
    c += wm * smoothstep(0.9965, 1.0, tw) * vec3(0.55, 0.6, 0.65);
  }
  o = vec4(c * uDim, 1.0);
}`
const FS_CHAR = `#version 300 es
precision highp float; in vec2 vUv; in vec2 vW; out vec4 o;
uniform sampler2D uTex; uniform sampler2D uNrm; uniform sampler2D uOcc; uniform vec2 uMap; uniform float uFoot; uniform float uFlip; uniform float uOccK;
uniform vec3 uAmb; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uShadow; uniform float uAlpha; uniform float uFlash;
uniform vec4 uL; uniform vec3 uLC; uniform vec4 uClip; uniform vec2 uPx;
vec4 tx(vec2 o){ return texture(uTex, clamp(vUv + o, uClip.xy, uClip.zw)); }
void main(){
  if (vUv.x < uClip.x || vUv.x > uClip.z || vUv.y < uClip.y || vUv.y > uClip.w) discard;
  vec4 c = texture(uTex, vUv); if (c.a < 0.02) discard;
  vec4 oc = texture(uOcc, vW / uMap);
  if (oc.b < 0.25) { float base = (floor(oc.r * 255.0 + 0.5) * 256.0 + floor(oc.g * 255.0 + 0.5)) * uOccK; if (base > uFoot + 6.0) discard; }
  if (uShadow > 0.0) { float a = c.a * uShadow; o = vec4(0.05 * a, 0.03 * a, 0.09 * a, a); return; }
  vec3 rgb = c.rgb / c.a;
  // 선명하게: 이웃 4칸 평균과의 차이를 더한다(영상에서 뽑은 그림의 뭉개짐 보정)
  vec4 n1 = tx(vec2(uPx.x, 0.0)), n2 = tx(vec2(-uPx.x, 0.0)), n3 = tx(vec2(0.0, uPx.y)), n4 = tx(vec2(0.0, -uPx.y));
  float na = n1.a + n2.a + n3.a + n4.a;
  if (na > 3.6) rgb = clamp(rgb + (rgb - (n1.rgb + n2.rgb + n3.rgb + n4.rgb) / na) * 0.55, 0.0, 1.0);
  // 셀 셰이딩 선: 실루엣 안쪽 가장자리를 짙게(일러스트처럼 또렷한 외곽선)
  float mn = min(min(tx(vec2(uPx.x * 1.8, 0.0)).a, tx(vec2(-uPx.x * 1.8, 0.0)).a), min(tx(vec2(0.0, uPx.y * 1.8)).a, tx(vec2(0.0, -uPx.y * 1.8)).a));
  float edge = smoothstep(0.55, 0.05, mn) * smoothstep(0.45, 0.9, c.a);
  vec3 n = texture(uNrm, vUv).xyz * 2.0 - 1.0; n.x *= uFlip; n = normalize(n + vec3(0.0, 0.0, 0.001));
  vec3 L = normalize(uSunDir);
  float d = max(dot(n, L), 0.0);
  float cel = smoothstep(0.32, 0.4, d) * 0.6 + d * 0.4;   // 셀 셰이딩: 명암 경계를 또렷하게
  vec3 col = rgb * (uAmb + uSun * cel);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.2) * max(dot(normalize(n.xy + 1e-4), normalize(L.xy)), 0.0);
  col += vec3(1.0, 0.86, 0.7) * rim * 0.28;
  if (uL.w > 0.0) { vec2 dl = uL.xy - vW; float att = clamp(1.0 - length(dl) / uL.z, 0.0, 1.0); att *= att;
    col += rgb * uLC * att * uL.w * (0.35 + 0.65 * max(dot(n, normalize(vec3(dl, 120.0))), 0.0)); }
  col = mix(col, col * 0.28 + vec3(0.07, 0.045, 0.09), edge * 0.85);
  col = mix(col, vec3(1.0), uFlash);
  o = vec4(col * c.a, c.a) * uAlpha;
}`
// 전경(카메라 바로 앞의 꽃·수풀·기둥): 흐리게(밉맵 치우침) + 조금 어둡게
const FS_FG = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform float uBias; uniform float uA;
void main(){ vec4 c = texture(uTex, vUv, uBias); o = vec4(c.rgb * 0.72, c.a) * uA; }`
// 분수 물줄기·폭포·물보라·파문(그림 위에 겹쳐 그린다)
const FS_WATER = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform int uMode; uniform float uT; uniform float uSeed; uniform float uA;
float h(float n){ return fract(sin(n * 91.345 + uSeed * 17.0) * 43758.5453); }
void main(){
  float a; vec3 col = vec3(0.86, 0.94, 1.0);
  if (uMode == 0) {            // 떨어지는 물줄기: 아래로 흐르는 밝은 줄무늬
    float x = vUv.x, y = vUv.y;
    float edge = smoothstep(0.0, 0.3, x) * smoothstep(1.0, 0.7, x);
    float ci = floor(x * 5.0); float r = h(ci);
    float f = fract(y * 2.4 - uT * (2.2 + r) + r * 7.0);
    float st = smoothstep(0.0, 0.12, f) * smoothstep(0.75, 0.3, f);
    a = edge * (0.22 + 0.55 * st) * smoothstep(0.0, 0.06, y);
    col = mix(col, vec3(1.0), st);
  } else if (uMode == 1) {     // 파문: 퍼져 나가는 고리
    vec2 p = vUv * 2.0 - 1.0; float d = length(p); if (d > 1.0) discard;
    a = 0.0;
    for (int k = 0; k < 3; k++) { float ph = fract(uT * 0.7 + float(k) / 3.0 + uSeed); a += smoothstep(0.07, 0.0, abs(d - ph)) * (1.0 - ph); }
    a *= 0.4;
  } else {                     // 물보라: 끓는 듯한 거품
    vec2 p = vUv * 2.0 - 1.0; float d = length(p);
    float n = 0.5 + 0.5 * sin(atan(p.y, p.x) * 7.0 + uT * 9.0 + uSeed * 10.0) * sin(uT * 13.0 + d * 18.0);
    a = smoothstep(1.0, 0.15, d) * (0.3 + 0.45 * n);
    col = vec3(1.0);
  }
  a *= uA;
  o = vec4(col * a, a);
}`
const FS_SHAPE = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform vec4 uC; uniform int uMode;
void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a;
  if (uMode == 0) a = smoothstep(1.0, 0.15, r);                                      // 부드러운 원(접촉 그림자·빛먼지)
  else if (uMode == 1) { a = smoothstep(1.0, 0.75, length(p * vec2(1.0, 1.9))) * (0.75 + 0.25 * p.y); } // 꽃잎
  else a = smoothstep(1.0, 0.0, r) * smoothstep(1.0, 0.4, r);
  o = vec4(uC.rgb * uC.a * a, uC.a * a); }`
const FS_POST = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uScene; uniform float uT; uniform float uDof; uniform float uBloom; uniform float uLetter; uniform float uFade; uniform float uRush; uniform float uFlash;
void main(){
  vec2 tu = vUv;                       // 텍스처 좌표(아래가 0)
  vec2 sc = vec2(vUv.x, 1.0 - vUv.y);  // 화면 좌표(위가 0)
  vec3 c;
  if (uRush > 0.002) {                 // 카메라 돌진: 화면 가운데로 빨려 드는 방사형 흐림(드론 FPV 느낌)
    vec2 ctr = vec2(0.5, 0.47); vec3 acc = vec3(0.0); float wsum = 0.0;
    for (int i = 0; i < 12; i++) { float k = float(i) / 11.0; float wi = 1.0 - k * 0.55; acc += texture(uScene, ctr + (tu - ctr) * (1.0 - k * uRush * 0.24)).rgb * wi; wsum += wi; }
    c = acc / wsum;
  } else c = texture(uScene, tu).rgb;
  float f = smoothstep(0.32, 0.56, abs(sc.y - 0.55)) * uDof;   // 틸트시프트: 화면 위·아래를 흐리게
  // 선명도: 그림 원본이 부드러워 언샤프 마스크를 약하게(화면 가운데일수록)
  { vec3 blur = textureLod(uScene, tu, 1.2).rgb;
  c = c + (c - blur) * 0.55 * (1.0 - f); }
  c = mix(c, textureLod(uScene, tu, 1.6).rgb * 0.5 + textureLod(uScene, tu, 2.6).rgb * 0.5, f);
  vec3 b = textureLod(uScene, tu, 3.0).rgb * 0.45 + textureLod(uScene, tu, 4.5).rgb * 0.35 + textureLod(uScene, tu, 6.0).rgb * 0.2;
  c += max(b - 0.86, 0.0) * 1.0 * uBloom;
  float v = dot(sc * vec2(1.78, 1.0), normalize(vec2(0.78, -0.62)));   // 왼쪽 위에서 비스듬히 내려오는 햇살 줄기
  float band = pow(sin(v * 9.0 + uT * 0.15) * 0.5 + 0.5, 6.0) + pow(sin(v * 23.0 - uT * 0.1 + 1.7) * 0.5 + 0.5, 10.0) * 0.6;
  float fall = clamp(1.0 - length(sc * vec2(0.85, 1.1)), 0.0, 1.0);
  c += vec3(1.0, 0.83, 0.62) * band * fall * 0.035 * uBloom;
  // 색 보정: 노을빛 대비(그림자는 차갑고 깊게, 밝은 곳은 따뜻하게) · 분홍 안개 걷기
  c *= 0.97;
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.42);                          // S자 대비
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c * vec3(0.9, 0.93, 1.05), c * vec3(1.06, 1.0, 0.9), smoothstep(0.2, 0.75, l));
  c = mix(vec3(l), c, 1.16);                                          // 채도
  vec2 q = sc - 0.5; c *= 1.0 - dot(q, q) * 0.85;
  if (sc.y < uLetter || sc.y > 1.0 - uLetter) c = vec3(0.0);
  c = mix(c, vec3(1.0), uFlash);
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
  /** 카메라 돌진 흐림 0~1, 번쩍임 0~1(연출용) */
  rush = 0
  flash = 0
  private progs: Record<'map' | 'chr' | 'shape' | 'fg' | 'water' | 'post', Prog>
  private vbo: WebGLBuffer
  private tiles = new Map<string, { t: Tex; x: number; y: number; w: number; h: number; used: number }>()
  private tileJobs = new Map<string, Promise<void>>()
  private aux: Tex | null = null
  private anim: Tex | null = null
  private fgTex: Tex | null = null
  private fgA = new Map<number, number>()
  private lowQ = false
  wind = 1
  private tex = new Map<string, Tex>()
  private nrm = new Map<string, Tex>()
  private fbo: { f: WebGLFramebuffer; t: WebGLTexture; w: number; h: number } | null = null
  private petals: Petal[] = []
  private motes: Mote[] = []
  zone!: Zone
  walk: { data: Uint8ClampedArray; w: number; h: number } | null = null

  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: false })
    if (!gl) throw new Error('webgl2')
    this.gl = gl
    this.progs = { map: compile(gl, VS, FS_MAP), chr: compile(gl, VS, FS_CHAR), shape: compile(gl, VS, FS_SHAPE), fg: compile(gl, VS, FS_FG), water: compile(gl, VS, FS_WATER), post: compile(gl, VS, FS_POST) }
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

  /** 가림·걷기 지도, 움직임 지도, 캐릭터 묶음, 시작 위치 근처 지도 조각을 받는다. progress 0~1 */
  async load(zone: Zone, kinds: string[], npcImgs: string[], low: boolean, onProgress?: (p: number) => void, focus: { x: number; y: number }[] = []) {
    this.zone = zone; this.lowQ = low
    const d = zone.dir
    const first = new Set<string>()
    for (const f of focus) for (const k of this.tilesNear(f.x, f.y, 1400, 800)) first.add(k)
    const files = [`${d}/aux.png`, `${d}/anim.webp`, ...kinds.map((k) => SPRITES[k].file), ...npcImgs]
    if (zone.fg?.length && !low) this.img(zone.fgAtlas.file).then((i) => { this.fgTex = this.upload(i, { mip: true }) }).catch(() => {})
    let done = 0
    const total = files.length + first.size
    const step = () => onProgress?.(++done / total)
    const imgs = await Promise.all(files.map((f) => this.img(f).then((i) => { step(); return i })))
    let k = 0
    const ai = imgs[k++]
    this.aux = this.upload(ai, { raw: true })
    const c = document.createElement('canvas'); c.width = ai.width; c.height = ai.height
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(ai, 0, 0)
    this.walk = { data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }
    this.anim = this.upload(imgs[k++])
    for (const f of [...kinds.map((x) => SPRITES[x].file), ...npcImgs]) {
      const im = imgs[k++]
      this.tex.set(f, this.upload(im, { mip: true }))
      await new Promise((r) => setTimeout(r, 0))
      this.nrm.set(f, this.upload(makeNormal(im, 'sprite', f, 0.5, 0), { mip: true }))
    }
    await Promise.all([...first].map((key) => this.loadTile(key).then(step)))
    this.ready = true
  }
  /** 지도 조각 이름(열_행) 중 (x,y) 주변 rx×ry 안에 걸치는 것 */
  private tilesNear(x: number, y: number, rx: number, ry: number) {
    const z = this.zone, T = z.tile, out: string[] = []
    const c0 = Math.max(0, Math.floor((x - rx) / T)), c1 = Math.min(z.cols - 1, Math.floor((x + rx) / T))
    const r0 = Math.max(0, Math.floor((y - ry) / T)), r1 = Math.min(z.rows - 1, Math.floor((y + ry) / T))
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(`${c}_${r}`)
    return out
  }
  private loadTile(key: string): Promise<void> {
    const have = this.tiles.get(key); if (have) { have.used = performance.now(); return Promise.resolve() }
    let p = this.tileJobs.get(key)
    if (p) return p
    const [c, r] = key.split('_').map(Number), z = this.zone, T = z.tile
    p = this.img(`${z.dir}/w_${key}.webp`).then((im) => {
      this.tiles.set(key, { t: this.upload(im, { mip: true }), x: c * T, y: r * T, w: im.width, h: im.height, used: performance.now() })
    }).catch(() => { /* 다음 프레임에 다시 */ }).finally(() => { this.tileJobs.delete(key) })
    this.tileJobs.set(key, p)
    return p
  }
  /** 카메라 근처 조각은 받고, 멀어진 조각은 GPU 메모리에서 내린다(끊김 없는 넓은 맵) */
  private stream() {
    const v = this.view, hw = W / 2 / v.z, hh = H / 2 / v.z
    for (const k of this.tilesNear(v.x, v.y, hw + 900, hh + 700)) this.loadTile(k)
    const keep = new Set(this.tilesNear(v.x, v.y, hw + 2200, hh + 1600))
    const MAX = this.lowQ ? 6 : 9
    if (this.tiles.size > MAX) {
      const old = [...this.tiles.entries()].filter(([k]) => !keep.has(k)).sort((a, b) => a[1].used - b[1].used)
      for (const [k, t] of old.slice(0, this.tiles.size - MAX)) { this.gl.deleteTexture(t.t.t); this.tiles.delete(k) }
    }
  }
  /** 발 위치가 걸을 수 있는 바닥인지 */
  walkable(x: number, y: number) {
    const w = this.walk; if (!w) return false
    const k = w.w / this.zone.W
    const ix = Math.round(x * k), iy = Math.round(y * k)
    if (ix < 0 || iy < 0 || ix >= w.w || iy >= w.h) return false
    return w.data[(iy * w.w + ix) * 4 + 2] > 200
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
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.aux!.t); gl.uniform1i(p.u('uOcc'), 2); gl.uniform1f(p.u('uOccK'), this.zone.W / this.aux!.w)
    gl.uniform2f(p.u('uMap'), z.W, z.H); gl.uniform1f(p.u('uFoot'), f.foot); gl.uniform1f(p.u('uFlip'), f.flip)
    gl.uniform3f(p.u('uAmb'), ...z.light.amb); gl.uniform3f(p.u('uSun'), ...z.light.sun); gl.uniform3f(p.u('uSunDir'), ...z.light.dir)
    gl.uniform1f(p.u('uShadow'), shadow); gl.uniform1f(p.u('uAlpha'), a.alpha ?? 1); gl.uniform1f(p.u('uFlash'), a.flash ?? 0)
    const um = Math.min(f.uv[0], f.uv[2]), uM = Math.max(f.uv[0], f.uv[2])
    gl.uniform4f(p.u('uClip'), um - 0.0001, f.uv[1] - 0.0001, uM + 0.0001, f.uv[5] + 0.0001)
    gl.uniform2f(p.u('uPx'), 1.25 / T.w, 1.25 / T.h)
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
    this.stream()
    const pm = this.use(this.progs.map); gl.uniform1f(pm.u('uDim'), 1)
    gl.uniform2f(pm.u('uWorld'), this.zone.W, this.zone.H); gl.uniform1f(pm.u('uT'), t); gl.uniform1f(pm.u('uWind'), this.wind)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.anim!.t); gl.uniform1i(pm.u('uAnim'), 1)
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(pm.u('uTex'), 0)
    const vx0 = this.view.x - W / 2 / this.view.z - 64, vx1 = this.view.x + W / 2 / this.view.z + 64, vy0 = this.view.y - H / 2 / this.view.z - 64, vy1 = this.view.y + H / 2 / this.view.z + 64
    for (const tl of this.tiles.values()) {
      if (tl.x > vx1 || tl.x + tl.w < vx0 || tl.y > vy1 || tl.y + tl.h < vy0) continue
      tl.used = performance.now()
      gl.uniform4f(pm.u('uTile'), tl.x, tl.y, tl.w, tl.h)
      gl.bindTexture(gl.TEXTURE_2D, tl.t.t); this.quad([tl.x, tl.y, tl.x + tl.w, tl.y, tl.x, tl.y + tl.h, tl.x + tl.w, tl.y + tl.h], [0, 0, 1, 0, 0, 1, 1, 1])
    }
    // 가로등 불빛: 은은하게 일렁이는 빛무리
    for (const l of this.zone.lamps) { const f = 0.85 + Math.sin(t * 7.3 + l.x) * 0.06 + Math.sin(t * 13.1) * 0.04
      this.shape(0, l.x, l.y, 260 * f, 260 * f, 0, [1, 0.72, 0.42, 0.32 * f], true); this.shape(0, l.x, l.y, 70, 70, 0, [1, 0.9, 0.7, 0.55 * f], true) }
    // ①-2 분수·폭포(그림 위, 인물 아래)
    this.drawWater(t, dt)
    // ② 그림자
    const frames = actors.map((a) => ({ a, f: this.frameOf(a) })).filter((x) => x.f) as { a: Actor; f: NonNullable<ReturnType<ExploreRenderer['frameOf']>> }[]
    for (const { a, f } of frames) this.shape(0, a.x + 6, a.y - 4, f.h * 0.42, f.h * 0.11, 0, [0.06, 0.03, 0.1, 0.42 * (a.alpha ?? 1)])
    for (const { a, f } of frames) this.drawActor(a, f, 0.26 * (a.alpha ?? 1))
    // ③ 캐릭터(뒤 → 앞)
    frames.sort((p, q) => p.a.y - q.a.y)
    for (const { a, f } of frames) this.drawActor(a, f, 0)
    // ③-2 전경: 카메라에 가까운 물체는 더 크게·더 빨리 움직인다(시차). 대원과 겹치면 옅어진다
    this.drawFg(actors[0], dt)
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
      gl.uniform1f(pp.u('uT'), t); gl.uniform1f(pp.u('uDof'), 0.35); gl.uniform1f(pp.u('uBloom'), 1); gl.uniform1f(pp.u('uLetter'), this.letter); gl.uniform1f(pp.u('uFade'), this.fade); gl.uniform1f(pp.u('uRush'), this.rush); gl.uniform1f(pp.u('uFlash'), this.flash)
      this.quad([0, 0, W, 0, 0, H, W, H], [0, 1, 1, 1, 0, 0, 1, 0])
    }
  }
  private drops: { x: number; y: number; vx: number; vy: number; floor: number; life: number }[] = []
  private drawWater(t: number, dt: number) {
    const z = this.zone, W2 = z.water
    if (!W2) return
    const gl = this.gl
    const p = this.use(this.progs.water)
    gl.uniform1f(p.u('uT'), t)
    const q = (x0: number, y0: number, x1: number, y1: number, mode: number, seed: number, a = 1) => {
      gl.uniform1i(p.u('uMode'), mode); gl.uniform1f(p.u('uSeed'), seed); gl.uniform1f(p.u('uA'), a)
      this.quad([x0, y0, x1, y0, x0, y1, x1, y1], [0, 0, 1, 0, 0, 1, 1, 1])
    }
    let seed = 0
    for (const f of W2.fountains) {
      for (const tier of f.tiers) for (const x of tier.xs) {
        seed += 1.37
        q(x - 7, tier.y0, x + 7, tier.y1, 0, seed, 0.9)                      // 물줄기
        q(x - 18, tier.y1 - 7, x + 18, tier.y1 + 7, 2, seed, 0.75)           // 떨어진 곳 물보라
        q(x - 34, tier.y1 - 9, x + 34, tier.y1 + 9, 1, seed, 0.8)            // 파문
      }
    }
    for (const f of W2.falls) {
      seed += 2.1
      q(f.x, f.y, f.x + f.w, f.y + f.h, 0, seed, 0.85)
      q(f.x - 10, f.y + f.h - 16, f.x + f.w + 10, f.y + f.h + 18, 2, seed, 0.9)
      q(f.x - 40, f.y + f.h - 10, f.x + f.w + 40, f.y + f.h + 30, 1, seed, 0.7)
    }
    // 꼭대기에서 솟는 물방울(가볍게 솟았다가 맨 위 그릇으로 떨어진다)
    if (!this.lowQ) for (const f of W2.fountains) {
      for (let k = 0; k < 2; k++) if (Math.random() < dt * 30) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6
        const sp = 70 + Math.random() * 60
        this.drops.push({ x: f.spout[0] + (Math.random() - 0.5) * 6, y: f.spout[1], vx: Math.cos(ang) * sp * 0.6, vy: Math.sin(ang) * sp, floor: f.tiers[0].y0, life: 2 })
      }
    }
    this.drops = this.drops.filter((d) => { d.vy += 420 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; return d.y < d.floor && d.life > 0 })
    for (const d of this.drops) this.shape(0, d.x, d.y, 5, 6, 0, [0.92, 0.97, 1, 0.85])
  }
  private drawFg(me: Actor | undefined, dt: number) {
    const z = this.zone, T = this.fgTex
    if (!T || !z.fg?.length) return
    const gl = this.gl, p = this.use(this.progs.fg), v = this.view, K = 1.32
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.t); gl.uniform1i(p.u('uTex'), 0); gl.uniform1f(p.u('uBias'), 3.2)
    const hw = W / 2 / v.z, hh = H / 2 / v.z
    z.fg.forEach((f, i) => {
      const r = z.fgAtlas.rects[f.k]; if (!r) return
      const w = f.w * K, h = (f.w * r[3] / r[2]) * K
      const cx = v.x + (f.x - v.x) * K, by = v.y + (f.y - v.y) * K + hh * 0.18 // 화면 아래쪽으로 조금 더 내려 앞에 있는 느낌
      if (cx + w / 2 < v.x - hw || cx - w / 2 > v.x + hw || by - h > v.y + hh || by < v.y - hh) return
      const x0 = cx - w / 2, y0 = by - h, x1 = cx + w / 2
      const over = me && me.x > x0 && me.x < x1 && me.y - z.charH < by && me.y > y0
      const a = (this.fgA.get(i) ?? 1) + ((over ? 0.3 : 0.95) - (this.fgA.get(i) ?? 1)) * Math.min(1, dt * 6); this.fgA.set(i, a)
      gl.uniform1f(p.u('uA'), a)
      const u0 = r[0] / T.w, v0 = r[1] / T.h, u1 = (r[0] + r[2]) / T.w, v1 = (r[1] + r[3]) / T.h
      const fl = f.flip ? -1 : 1
      this.quad([x0, y0, x1, y0, x0, by, x1, by], fl > 0 ? [u0, v0, u1, v0, u0, v1, u1, v1] : [u1, v0, u0, v0, u1, v1, u0, v1])
    })
  }
  dispose() { const gl = this.gl; for (const x of [...this.tex.values(), ...this.nrm.values()]) gl.deleteTexture(x.t); for (const x of this.tiles.values()) gl.deleteTexture(x.t.t); this.tiles.clear(); if (this.aux) gl.deleteTexture(this.aux.t); if (this.anim) gl.deleteTexture(this.anim.t); if (this.fgTex) gl.deleteTexture(this.fgTex.t) }
}
