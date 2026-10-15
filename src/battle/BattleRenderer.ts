// 전투 화면 WebGL2 렌더러: 2D 그림 + 노멀맵 조명 + 물웅덩이 반사.
// 한 프레임 순서: ① 반사 버퍼(캐릭터·이펙트를 발 기준으로 뒤집어 그림) → ② 배경(조명 + 물 영역에 반사 합성)
// → ③ 바닥 예고·물결·그림자 → ④ 소품·유닛(앞뒤 정렬, 조명·실루엣) → ⑤ 이펙트·입자(가산) → ⑥ 예고 윤곽(맨 위)
import { LOOKS, PROPS, BGS, RION_IDLE, ACCENT, depthScale, type Look, type BgLook } from './look'
import { makeNormal } from './normals'
import { headOf, type Sim, type Unit, type Fx } from '../game/combat/sim'

const W = 1280, H = 720, MAXL = 12
type Tex = { t: WebGLTexture; w: number; h: number }
type Light = { x: number; y: number; z: number; r: number; c: [number, number, number]; i: number }
type Part = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; tex: string; c: [number, number, number]; g: number; rot: number; vr: number; add: boolean; ground?: number }
type Ripple = { x: number; y: number; t: number; dur: number; r: number; a: number }

const VS = `#version 300 es
in vec2 aPos; in vec2 aUv; uniform vec2 uCam; uniform vec3 uView; out vec2 vUv; out vec2 vW;
void main(){ vUv = aUv; vW = aPos; vec2 sp = (aPos - uView.xy) * uView.z + vec2(${W / 2}.0, ${H / 2}.0) + uCam; vec2 p = sp / vec2(${W}.0, ${H}.0) * 2.0 - 1.0; gl_Position = vec4(p.x, -p.y, 0.0, 1.0); }`
const LIGHT_FN = `
uniform vec4 uL[${MAXL}]; uniform vec4 uLC[${MAXL}]; uniform int uNL;
vec3 pointLights(vec3 n, vec2 w, float wrap){ vec3 acc = vec3(0.0);
  for (int i = 0; i < ${MAXL}; i++) { if (i >= uNL) break; vec3 L = vec3(uL[i].xy - w, uL[i].z); float d = length(L.xy);
    float att = clamp(1.0 - d / uL[i].w, 0.0, 1.0); att *= att; acc += uLC[i].rgb * uLC[i].a * att * (wrap + (1.0 - wrap) * max(dot(n, normalize(L)), 0.0)); }
  return acc; }`
const FS_SPRITE = `#version 300 es
precision highp float; in vec2 vUv; in vec2 vW; out vec4 o;
uniform sampler2D uTex; uniform sampler2D uNrm; uniform float uFlip; uniform vec3 uAmb; uniform vec3 uKey; uniform vec3 uKeyDir;
uniform vec3 uTint; uniform vec4 uFlash; uniform float uAlpha; uniform vec4 uOutline; uniform vec2 uTexel; uniform float uRefl; uniform vec2 uV; uniform float uSat; uniform vec4 uClip; uniform float uShadow; uniform vec3 uBoost;
${LIGHT_FN}
void main(){
  if (vUv.x < uClip.x || vUv.x > uClip.z || vUv.y < uClip.y || vUv.y > uClip.w) discard;
  vec4 c = texture(uTex, vUv); float a = c.a; float ol = 0.0;
  if (uShadow > 0.0) { if (a < 0.05) discard; float sa = a * uShadow; o = vec4(0.0, 0.0, 0.02 * sa, sa); return; }
  if (uOutline.a > 0.0 && uRefl < 0.5) { float m = 0.0;
    for (int i = 0; i < 8; i++) { float an = float(i) * 0.785398; vec2 q = vUv + vec2(cos(an), sin(an)) * uTexel * 2.6;
      if (q.x > uClip.x && q.x < uClip.z && q.y > uClip.y && q.y < uClip.w) m = max(m, texture(uTex, q).a); }
    ol = clamp(m - a, 0.0, 1.0); }
  if (a < 0.02 && ol < 0.02) discard;
  vec3 rgb = a > 0.0 ? c.rgb / a : vec3(0.0);
  vec3 col;
  float alpha;
  if (uRefl > 0.5) {
    float fy = clamp((vUv.y - uV.x) / (uV.y - uV.x), 0.0, 1.0);
    col = rgb * uTint * vec3(0.86, 0.9, 1.0); alpha = a * uAlpha * pow(fy, 1.15) * 0.95;
  } else {
    vec3 n = texture(uNrm, vUv).xyz * 2.0 - 1.0; n.x *= uFlip; n = normalize(n);
    vec3 K = normalize(uKeyDir);
    float kd = max(dot(n, K), 0.0);
    vec3 pl = pointLights(n, vW, 0.0) * 1.9; pl = pl / (1.0 + pl * 0.45);
    vec3 lit = uAmb + uBoost + uKey * kd * 1.05 + pl;
    // 역광 테두리: 빛이 뒤·옆에서 올 때 가장자리가 빛난다
    float edge = pow(1.0 - clamp(n.z, 0.0, 1.0), 1.6);
    float back = max(dot(normalize(vec3(n.xy, 0.0001)), normalize(vec3(K.xy, 0.0001))), 0.0);
    col = rgb * uTint * lit + edge * back * uKey * 0.55;
    col = col * (1.0 + col / 2.6) / (1.0 + col); col *= 1.25; // 하이라이트가 하얗게 날아가지 않게(톤 매핑)
    float g = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(g), col, uSat);
    col = mix(col, uFlash.rgb, uFlash.a);
    alpha = a * uAlpha;
    col = mix(uOutline.rgb, col, a > 0.0 ? 1.0 : 0.0);
    alpha = max(alpha, ol * uOutline.a * uAlpha);
  }
  o = vec4(col * alpha, alpha);
}`
const FS_BG = `#version 300 es
precision highp float; in vec2 vUv; in vec2 vW; out vec4 o;
uniform sampler2D uBg; uniform sampler2D uBgN; uniform sampler2D uRefl; uniform sampler2D uMask; uniform float uTime; uniform vec3 uAmb; uniform float uRip; uniform vec3 uView; uniform vec2 uCam; uniform vec3 uBoost;
${LIGHT_FN}
void main(){
  vec2 uv = vW / vec2(${W}.0, ${H}.0);
  vec3 base = texture(uBg, uv).rgb; vec3 n = normalize(texture(uBgN, uv).xyz * 2.0 - 1.0);
  vec3 bl = pointLights(n, vW, 0.15) * 1.7; bl = bl / (1.0 + bl * 0.35);
  vec3 col = base * (uAmb + uBoost) + base * bl;
  float m = texture(uMask, uv).r;
  if (m > 0.01) {
    vec2 rip = vec2(sin(vW.y * 0.11 + uTime * 2.3 + sin(vW.x * 0.023 + uTime) * 2.0), cos(vW.x * 0.045 - uTime * 1.6 + vW.y * 0.03)) * 2.4 * uRip;
    vec2 sp = (vW + rip - uView.xy) * uView.z + vec2(${W / 2}.0, ${H / 2}.0) + uCam;
    vec2 ruv = sp / vec2(${W}.0, ${H}.0); ruv.y = 1.0 - ruv.y;
    vec4 r = texture(uRefl, ruv);
    col = col * (1.0 - r.a * min(1.0, m * 1.2) * 0.8) + r.rgb * min(1.0, m * 1.2) * 0.92;
    col += pointLights(vec3(0.0, 0.0, 1.0), vW, 1.0) * m * 0.45;
  }
  o = vec4(col, 1.0);
}`
const FS_SHAPE = `#version 300 es
precision highp float; in vec2 vUv; in vec2 vW; out vec4 o;
uniform int uMode; uniform vec4 uC; uniform vec4 uP;
void main(){
  vec2 q = vUv * 2.0 - 1.0; float d = length(q); float a = 0.0;
  if (uMode == 0) { a = smoothstep(1.0, 0.15, d); }
  else if (uMode == 1) { if (d > 1.0) discard; float rim = smoothstep(0.86, 0.97, d) * (1.0 - smoothstep(0.97, 1.0, d));
    float fill = d < uP.x ? 0.5 : 0.16; float edge = smoothstep(0.035, 0.0, abs(d - uP.x)) * 0.9; a = fill + rim * 0.95 + edge; }
  else if (uMode == 2) { float x = vUv.x; float y = abs(q.y); if (y > 1.0) discard;
    float rim = smoothstep(0.78, 0.95, y); float fill = x < uP.x ? 0.5 : 0.15; float edge = smoothstep(0.02, 0.0, abs(x - uP.x)) * 0.9;
    float tip = smoothstep(0.9, 1.0, x) * 0.3; a = (fill + rim * 0.9 + edge + tip) * (1.0 - smoothstep(0.985, 1.0, x)); }
  else if (uMode == 3) { a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2); }
  else if (uMode == 4) { a = smoothstep(0.1, 0.0, abs(d - 0.9)) * (d < 1.0 ? 1.0 : 0.0); }
  else if (uMode == 5) { if (d > 1.0) discard; float rim = smoothstep(0.86, 0.97, d) * (1.0 - smoothstep(0.97, 1.0, d)); a = rim; }
  else if (uMode == 6) { float y = abs(q.y); float x = vUv.x; a = smoothstep(0.78, 0.95, y) * (1.0 - smoothstep(0.985, 1.0, x)) * step(y, 1.0); }
  a *= uC.a; o = vec4(uC.rgb * a, a);
}`
const FS_FX = `#version 300 es
precision highp float; in vec2 vUv; in vec2 vW; out vec4 o; uniform sampler2D uTex; uniform vec4 uC; uniform float uRefl; uniform vec2 uV;
void main(){ vec4 c = texture(uTex, vUv); float k = 1.0; if (uRefl > 0.5) k = 0.6 * pow(clamp((vUv.y - uV.x) / (uV.y - uV.x), 0.0, 1.0), 1.4); o = c * uC * k; }`

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const mk = (t: number, src: string) => { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader'); return s }
  const p = gl.createProgram()!; gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs))
  gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aUv'); gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  const u = new Map<string, WebGLUniformLocation | null>()
  return { p, u: (n: string) => { if (!u.has(n)) u.set(n, gl.getUniformLocation(p, n)); return u.get(n)! } }
}
type Prog = ReturnType<typeof compile>

/** 이펙트용 그림(캔버스로 그림) */
function fxCanvas(kind: string): HTMLCanvasElement {
  const c = document.createElement('canvas'); const S = 128; c.width = S; c.height = S; const g = c.getContext('2d')!
  g.translate(S / 2, S / 2)
  if (kind === 'glow') { const gr = g.createRadialGradient(0, 0, 0, 0, 0, S / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-S / 2, -S / 2, S, S) }
  else if (kind === 'ring') { for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,255,255,${[0.25, 0.6, 1][i]})`; g.lineWidth = [14, 7, 3][i]; g.beginPath(); g.arc(0, 0, S * 0.38, 0, Math.PI * 2); g.stroke() } }
  else if (kind === 'slash') { g.rotate(-0.5); for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,255,255,${[0.2, 0.55, 1][i]})`; g.lineWidth = [16, 8, 3][i]; g.lineCap = 'round'; g.beginPath(); g.arc(-S * 0.18, 0, S * 0.42, -1.1, 1.1); g.stroke() } }
  else if (kind === 'spark') { g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : S * 0.46; const a = i * Math.PI / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r) } g.fill(); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-30, -30, 60, 60) }
  else if (kind === 'cube') {
    const s = 34; g.lineJoin = 'round'
    const face = (pts: number[][], col: string) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.5; g.stroke() }
    face([[0, -s], [s, -s / 2], [0, 0], [-s, -s / 2]], 'rgba(255,190,210,.95)')
    face([[-s, -s / 2], [0, 0], [0, s], [-s, s / 2]], 'rgba(255,90,120,.95)')
    face([[s, -s / 2], [0, 0], [0, s], [s, s / 2]], 'rgba(255,140,90,.95)')
  }
  else if (kind === 'shard') { g.fillStyle = 'rgba(200,140,255,1)'; g.beginPath(); g.moveTo(0, -S * 0.42); g.lineTo(S * 0.14, 0); g.lineTo(0, S * 0.42); g.lineTo(-S * 0.14, 0); g.fill(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(0, -S * 0.42); g.lineTo(S * 0.05, 0); g.lineTo(0, S * 0.2); g.fill() }
  else if (kind === 'beam') { g.setTransform(1, 0, 0, 1, 0, 0); const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S) }
  else if (kind === 'wave') { g.rotate(0); for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,255,255,${[0.25, 0.6, 1][i]})`; g.lineWidth = [18, 8, 3][i]; g.beginPath(); g.ellipse(-S * 0.2, 0, S * 0.3, S * 0.46, 0, -1.25, 1.25); g.stroke() } }
  return c
}

export class BattleRenderer {
  gl: WebGL2RenderingContext
  progs: Record<'spr' | 'bg' | 'shape' | 'fx', Prog>
  vbo: WebGLBuffer; vao: WebGLVertexArrayObject
  tex = new Map<string, Tex>(); nrm = new Map<string, Tex>()
  fxTex = new Map<string, Tex>()
  maskTex: Tex | null = null; maskData: Uint8ClampedArray | null = null
  refl: { fb: WebGLFramebuffer; tex: WebGLTexture } | null = null
  bg!: BgLook
  parts: Part[] = []; ripples: Ripple[] = []
  seen = new Set<number>(); trail = new Map<string, { x: number; y: number }[]>(); stepT = new Map<string, number>()
  ready = false; reduce = false
  scale = 1
  constructor(public canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: true, alpha: false })
    if (!gl) throw new Error('webgl2')
    this.gl = gl
    this.progs = { spr: compile(gl, VS, FS_SPRITE), bg: compile(gl, VS, FS_BG), shape: compile(gl, VS, FS_SHAPE), fx: compile(gl, VS, FS_FX) }
    this.vao = gl.createVertexArray()!; gl.bindVertexArray(this.vao)
    this.vbo = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bufferData(gl.ARRAY_BUFFER, 16 * 4, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
    for (const k of ['glow', 'ring', 'slash', 'spark', 'cube', 'shard', 'beam', 'wave']) this.fxTex.set(k, this.upload(fxCanvas(k)))
  }

  private upload(src: TexImageSource & { width: number; height: number }, mip = true): Tex {
    const gl = this.gl; const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR) } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    return { t, w: src.width, h: src.height }
  }
  private loadImg(src: string) { return new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(src)); i.src = src }) }

  /** 그림 불러오기 + 노멀맵 계산. progress: 0~1 */
  async load(bgKey: keyof typeof BGS, kinds: string[], onProgress?: (p: number) => void) {
    this.bg = BGS[bgKey]
    const looks: { key: string; l: Look }[] = [...new Set(kinds)].map((k) => ({ key: k, l: (LOOKS as Record<string, Look>)[k] ?? (PROPS as Record<string, Look>)[k] })).filter((x) => x.l)
    const jobs = [{ key: 'bg', file: this.bg.file, mode: 'bg' as const, cell: 0 }, ...looks.map((x) => ({ key: x.key, file: x.l.file, mode: 'sprite' as const, cell: x.l.ch }))]
    let done = 0
    for (const j of jobs) {
      if (this.tex.has(j.file)) { done++; continue }
      const img = await this.loadImg(j.file)
      this.tex.set(j.file, this.upload(img))
      await new Promise((r) => setTimeout(r, 0))
      this.nrm.set(j.file, this.upload(makeNormal(img, j.mode, j.file, j.mode === 'bg' ? 0.5 : 0.5, j.cell)))
      onProgress?.(++done / jobs.length)
    }
    this.buildMask()
    this.ready = true
  }
  private buildMask() {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d', { willReadFrequently: true })!
    g.fillStyle = '#000'; g.fillRect(0, 0, 320, 180)
    const k = 0.25
    if (this.bg.wet > 0) { const gr = g.createLinearGradient(0, this.bg.wetFrom * k - 10, 0, this.bg.wetFrom * k + 25); const v = Math.round(this.bg.wet * 255); gr.addColorStop(0, 'rgb(0,0,0)'); gr.addColorStop(1, `rgb(${v},${v},${v})`); g.fillStyle = gr; g.fillRect(0, 0, 320, 180) }
    g.globalCompositeOperation = 'lighten'
    for (const [cx, cy, rx, ry, s] of this.bg.puddles) {
      g.save(); g.translate(cx * k, cy * k); g.scale(1, ry / rx)
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx * k); const v = Math.round(s * 255)
      gr.addColorStop(0, `rgb(${v},${v},${v})`); gr.addColorStop(0.72, `rgb(${v},${v},${v})`); gr.addColorStop(1, 'rgb(0,0,0)')
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx * k, 0, Math.PI * 2); g.fill(); g.restore()
    }
    this.maskData = g.getImageData(0, 0, 320, 180).data
    if (this.maskTex) this.gl.deleteTexture(this.maskTex.t)
    this.maskTex = this.upload(c, false)
  }
  private wetAt(x: number, y: number) { if (!this.maskData) return 0; const i = (Math.min(179, Math.max(0, Math.round(y / 4))) * 320 + Math.min(319, Math.max(0, Math.round(x / 4)))) * 4; return this.maskData[i] / 255 }

  resize(cssW: number, cssH: number, dpr: number, cap = 1.5) {
    const k = Math.min(cap, dpr * (cssW / W))
    const w = Math.round(W * k), h = Math.round(H * k)
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; this.refl = null }
    void cssH
    this.scale = k
  }
  private ensureRefl() {
    if (this.refl) return this.refl
    const gl = this.gl; const tex = gl.createTexture()!
    const w = Math.round(this.canvas.width / 2), h = Math.round(this.canvas.height / 2)
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fb = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    this.refl = { fb, tex }; return this.refl
  }

  // ───────── 그리기 도구 ─────────
  private cam: [number, number] = [0, 0]
  private quad(p: number[], uv: number[]) {
    const gl = this.gl
    const d = new Float32Array(16)
    for (let i = 0; i < 4; i++) { d[i * 4] = p[i * 2]; d[i * 4 + 1] = p[i * 2 + 1]; d[i * 4 + 2] = uv[i * 2]; d[i * 4 + 3] = uv[i * 2 + 1] }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
  }
  /** 중심·크기·회전으로 사각형 꼭짓점 */
  private box(cx: number, cy: number, w: number, h: number, rot = 0, ox = 0.5, oy = 0.5) {
    const c = Math.cos(rot), s = Math.sin(rot); const pts: number[] = []
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const x = (u - ox) * w, y = (v - oy) * h; pts.push(cx + x * c - y * s, cy + x * s + y * c) }
    return pts
  }
  view = { x: W / 2, y: H / 2, z: 1 }
  boost: [number, number, number] = [0, 0, 0]
  private use(p: Prog) { const gl = this.gl; gl.useProgram(p.p); gl.uniform2f(p.u('uCam'), this.cam[0], this.cam[1]); gl.uniform3f(p.u('uView'), this.view.x, this.view.y, this.view.z); return p }
  private setLights(p: Prog, lights: Light[]) {
    const gl = this.gl; const n = Math.min(MAXL, lights.length)
    const a = new Float32Array(MAXL * 4), b = new Float32Array(MAXL * 4)
    for (let i = 0; i < n; i++) { const l = lights[i]; a.set([l.x, l.y, l.z, l.r], i * 4); b.set([l.c[0], l.c[1], l.c[2], l.i], i * 4) }
    gl.uniform4fv(p.u('uL'), a); gl.uniform4fv(p.u('uLC'), b); gl.uniform1i(p.u('uNL'), n)
  }
  private shape(mode: number, pts: number[], c: [number, number, number, number], prog = 0, add = false) {
    const gl = this.gl; const p = this.use(this.progs.shape)
    gl.blendFunc(gl.ONE, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA)
    gl.uniform1i(p.u('uMode'), mode); gl.uniform4f(p.u('uC'), c[0], c[1], c[2], c[3]); gl.uniform4f(p.u('uP'), prog, 0, 0, 0)
    this.quad(pts, [0, 0, 1, 0, 1, 1, 0, 1])
  }
  private fxQuad(tex: string, cx: number, cy: number, w: number, h: number, rot: number, c: [number, number, number, number], refl = false, footY = 0) {
    const gl = this.gl; const p = this.use(this.progs.fx); const T = this.fxTex.get(tex)!
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.t); gl.uniform1i(p.u('uTex'), 0)
    gl.uniform4f(p.u('uC'), c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]); gl.uniform1f(p.u('uRefl'), refl ? 1 : 0); gl.uniform2f(p.u('uV'), 0, 1)
    gl.blendFunc(gl.ONE, gl.ONE)
    let pts = this.box(cx, cy, w, h, rot)
    if (refl) { pts = pts.map((v, i) => (i % 2 ? 2 * footY - v : v)) }
    this.quad(pts, [0, 0, 1, 0, 1, 1, 0, 1])
  }

  // ───────── 유닛 모습 ─────────
  private pose(u: Unit, t: number, focus: string | null) {
    const L = (LOOKS as Record<string, Look>)[u.kind]
    const a = u.act; const k = a ? Math.min(1, a.t / a.dur) : 0
    let frame = 0
    if (L.n > 1) {
      if (u.kind === 'rion') frame = a && (a.k === 'atk' || a.k === 'skill' || a.k === 'buff') ? Math.min(32, 6 + Math.floor(a.t * 24)) : RION_IDLE[Math.floor(t * 12) % RION_IDLE.length]
      else frame = (Math.floor(t * 12) + u.id.length * 7 + Math.floor(u.hy)) % L.n
    }
    const face = u.face
    let dx = 0, dy = 0, sx = 1, sy = 1, rot = 0
    const breathe = Math.sin(t * 2.4 + u.hy * 0.05) * 0.012
    if (L.n === 1) { sy = 1 + breathe; sx = 1 - breathe * 0.6 }
    // 이동: 속도만큼 통통 튀며 진행 방향으로 기울어진다(달리기)
    const spd = Math.hypot(u.vx, u.vy) + (u.entering || u.task ? 300 : 0)
    if (spd > 40 && !u.dead) { const k2 = Math.min(1, spd / 380); const ph = t * (9 + k2 * 6) + u.hy; dy -= Math.abs(Math.sin(ph)) * 10 * k2; rot = face * 0.09 * k2 + Math.sin(ph) * 0.03 * k2; sy *= 1 - Math.abs(Math.cos(ph)) * 0.04 * k2 }
    dy -= u.hop
    if (a?.k === 'atk' && u.kind !== 'rion') { const p = Math.sin(k * Math.PI); dx = face * p * (u.kind === 'ian' ? 30 : u.kind === 'seren' ? 34 : 18); rot = face * p * (u.kind === 'seren' ? 0.16 : 0.07); sx *= 1 + p * 0.05 }
    if (a?.k === 'skill' || a?.k === 'buff') { const p = Math.sin(k * Math.PI); sx *= 1 + p * 0.07; sy *= 1 + p * 0.07 }
    if (a?.k === 'hit') { dx = -face * 12 * (1 - k); rot = -face * 0.08 * (1 - k) }
    if (a?.k === 'stagger') { rot = Math.sin(t * 30) * 0.05 - face * 0.08; dx = Math.sin(t * 40) * 3 }
    if (a?.k === 'roar') { const p = Math.sin(k * Math.PI); sx *= 1 + p * 0.06; sy *= 1 + p * 0.08; dx = Math.sin(t * 50) * 4 * p }
    if (a?.k === 'use') { dy = Math.sin(k * Math.PI * 3) * 4 }
    if (u.stun > 0) rot = Math.sin(t * 6) * 0.06
    const tele = u.tele
    let flash: [number, number, number, number] = [1, 1, 1, 0]
    if (a?.k === 'hit') flash = [1, 1, 1, (1 - k) * (u.side === 'ally' ? 0.28 : 0.6)]
    if (tele) { const p = 0.25 + 0.25 * Math.sin(t * 18); flash = [1, 0.15, 0.25, p]; if (tele.k === 'charge' || tele.k === 'slam') { dx -= face * 8 * Math.min(1, tele.t / tele.dur); sy *= 1 - 0.04 * Math.min(1, tele.t / tele.dur) } }
    if (u.vuln > 0) flash = [0.9, 0.95, 1, 0.15 + 0.1 * Math.sin(t * 10)]
    const float = L.float ? L.float + Math.sin(t * 2.4 + u.hx) * 8 : 0
    let alpha = 1, sat = 1, sink = 0
    if (u.dead) { const d = Math.min(1, u.dead / 1.2); alpha = 1 - d; sat = 1 - d * 0.8; sink = d * 14; flash = [0.8, 0.6, 1, d * 0.4] }
    if (u.entering && u.side === 'enemy') alpha = Math.min(1, alpha, (1360 - u.x) / 120 + 0.2)
    let outline: [number, number, number, number] = u.side === 'ally' ? [0.55, 0.92, 1, 0.55] : [0.78, 0.35, 1, 0.5]
    if (focus === u.id) outline = [1, 0.86, 0.2, 0.95]
    if (tele) outline = [1, 0.25, 0.3, 0.8]
    if (u.side === 'ally' && u.buffs.some((b) => b.src === u.kind)) { const ac = ACCENT[u.kind]; if (ac) outline = [ac[0], ac[1], ac[2], 0.75 + 0.2 * Math.sin(t * 6)] }
    if (L.n > 1 && focus !== u.id && !tele) outline = [outline[0], outline[1], outline[2], 0] // 프레임 시트는 칸 경계가 번져 윤곽을 끈다
    return { L, frame, dx, dy: dy - float + sink, sx, sy, rot, flash, alpha, sat, outline, face }
  }
  private drawUnitSprite(u: Unit, t: number, focus: string | null, lights: Light[], refl: boolean, shadow?: { dx: number; dy: number; a: number }) {
    const P = this.pose(u, t, focus)
    const L = P.L; const T = this.tex.get(L.file); const N = this.nrm.get(L.file); if (!T || !N) return
    const ds = depthScale(u.y) * L.s
    const col = P.frame % L.cols, row = Math.floor(P.frame / L.cols)
    const u0 = (col * L.cw) / T.w, v0 = (row * L.ch) / T.h, u1 = ((col + 1) * L.cw) / T.w, v1 = ((row + 1) * L.ch) / T.h
    const flip = (P.face === 1) !== L.faceRight
    // 발 기준 사각형: 칸 크기 × 배율, 발(ax, ay)이 유닛 위치
    const w = L.cw * ds * P.sx, h = L.ch * ds * P.sy
    const ox = (flip ? L.cw - L.ax : L.ax) / L.cw, oy = L.ay / L.ch
    const fx = u.x + P.dx, fy = u.y + P.dy
    let pts = this.box(fx, fy, w, h, shadow ? 0 : P.rot, ox, oy)
    const uvs = flip ? [u1, v0, u0, v0, u0, v1, u1, v1] : [u0, v0, u1, v0, u1, v1, u0, v1]
    if (refl) pts = pts.map((v, i) => (i % 2 ? 2 * u.y - v + 2 : v))
    if (shadow) {
      // 땅에 눕힌 그림자: 높이(발에서 위로 떨어진 만큼)를 빛 반대쪽으로 늘인다
      const gy = u.y
      pts = pts.map((v, i, arr) => { if (i % 2 === 0) { const hgt = gy - arr[i + 1]; return v + shadow.dx * hgt } const hgt = gy - v; return gy + shadow.dy * hgt })
    }
    this.sprite(T, N, pts, uvs, { flip: flip ? -1 : 1, flash: P.flash, alpha: P.alpha, sat: P.sat, outline: P.outline, refl, v: [v0, v1], clip: [Math.min(u0, u1) + 0.0005, v0 + 0.0005, Math.max(u0, u1) - 0.0005, v1 - 0.0005], lights, shadow: shadow ? shadow.a * P.alpha : 0 })
  }
  private sprite(T: Tex, N: Tex, pts: number[], uvs: number[], o: { flip: number; flash: number[]; alpha: number; sat: number; outline: number[]; refl: boolean; v: number[]; clip: number[]; lights: Light[]; tint?: number[]; shadow?: number }) {
    const gl = this.gl; const p = this.use(this.progs.spr)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.t); gl.uniform1i(p.u('uTex'), 0)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, N.t); gl.uniform1i(p.u('uNrm'), 1)
    const bg = this.bg
    gl.uniform1f(p.u('uFlip'), o.flip); gl.uniform3fv(p.u('uAmb'), this.flat ? [1, 1, 1] : bg.sprAmb); gl.uniform3fv(p.u('uKey'), this.flat ? [0, 0, 0] : bg.key); gl.uniform3fv(p.u('uKeyDir'), bg.keyDir)
    gl.uniform3fv(p.u('uTint'), o.tint ?? [1, 1, 1]); gl.uniform4fv(p.u('uFlash'), o.flash); gl.uniform1f(p.u('uAlpha'), o.alpha)
    gl.uniform4fv(p.u('uOutline'), o.outline); gl.uniform2f(p.u('uTexel'), 1 / T.w, 1 / T.h); gl.uniform1f(p.u('uRefl'), o.refl ? 1 : 0)
    gl.uniform2fv(p.u('uV'), o.v); gl.uniform1f(p.u('uSat'), o.sat); gl.uniform4fv(p.u('uClip'), o.clip)
    gl.uniform1f(p.u('uShadow'), o.shadow ?? 0); gl.uniform3fv(p.u('uBoost'), this.boost)
    this.setLights(p, this.flat ? [] : o.lights)
    this.quad(pts, uvs)
  }
  private drawProp(kind: 'relay' | 'shutter', x: number, y: number, lights: Light[], refl: boolean, flash = 0, outline: number[] = [0.55, 0.92, 1, 0.4]) {
    const L = PROPS[kind]; const T = this.tex.get(L.file); const N = this.nrm.get(L.file); if (!T || !N) return
    const ds = depthScale(y) * L.s
    let pts = this.box(x, y, L.cw * ds, L.ch * ds, 0, L.ax / L.cw, L.ay / L.ch)
    if (refl) pts = pts.map((v, i) => (i % 2 ? 2 * y - v + 2 : v))
    this.sprite(T, N, pts, [0, 0, 1, 0, 1, 1, 0, 1], { flip: 1, flash: [1, 0.3, 0.3, flash], alpha: 1, sat: 1, outline, refl, v: [0, 1], clip: [0, 0, 1, 1], lights })
  }

  // ───────── 빛 모으기 ─────────
  private collectLights(s: Sim, t: number): Light[] {
    const out: Light[] = []
    for (const l of this.bg.lights) out.push({ ...l, i: l.i * (l.flicker ? 1 - l.flicker * (Math.sin(t * 13 + l.x) > 0.6 ? 1 : 0) : 1) })
    const dyn: Light[] = []
    const C = (h: string): [number, number, number] => h === 'lime' ? [0.75, 1, 0.25] : h === 'ice' ? [0.6, 0.78, 1] : h === 'pink' ? [1, 0.4, 0.45] : h === 'violet' ? [0.75, 0.35, 1] : h === 'orange' ? [1, 0.55, 0.2] : h === 'green' ? [0.45, 1, 0.55] : [1, 1, 1]
    for (const p of s.proj) dyn.push({ x: p.x, y: p.y, z: 50, r: p.k === 'wave' ? 520 : 250, c: C(p.k === 'ring' || p.k === 'wave' ? 'lime' : p.k === 'slash' ? 'ice' : p.k === 'cube' ? 'pink' : 'violet'), i: p.k === 'wave' ? 2.0 : 1.1 })
    for (const f of s.fx) {
      const k = 1 - f.t / f.dur
      if (f.k === 'slashBig') dyn.push({ x: f.x, y: f.y, z: 60, r: 460, c: C('ice'), i: 2.4 * k })
      else if (f.k === 'dieE') dyn.push({ x: f.x, y: f.y + 20, z: 50, r: f.who === 'boss' ? 1200 : 480, c: [0.85, 0.4, 1], i: 3.0 * k * k })
      else if (f.k === 'hitE' && f.crit) dyn.push({ x: f.x, y: f.y, z: 50, r: 280, c: [1, 0.9, 0.6], i: 1.6 * k })
      else if (f.k === 'slashHit' || f.k === 'bash') dyn.push({ x: f.x, y: f.y, z: 50, r: 260, c: f.k === 'bash' ? C('orange') : C('ice'), i: 1.4 * k })
      else if (f.k === 'ringHit') dyn.push({ x: f.x, y: f.y, z: 50, r: 280, c: C('lime'), i: 1.6 * k })
      else if (f.k === 'cubeDrop') dyn.push({ x: f.x, y: f.y, z: 70, r: 360, c: C('pink'), i: 2.0 * k })
      else if (f.k === 'slam') dyn.push({ x: f.x, y: f.y, z: 40, r: (f.r ?? 120) * 3, c: C('violet'), i: 3.0 * k })
      else if (f.k === 'break') dyn.push({ x: f.x, y: f.y, z: 80, r: 520, c: [1, 1, 1], i: 2.6 * k })
      else if (f.k === 'beam') dyn.push({ x: (f.x + (f.x2 ?? f.x)) / 2, y: (f.y + (f.y2 ?? f.y)) / 2, z: 60, r: 380, c: C('violet'), i: 1.3 * k })
      else if (f.k === 'wall' || f.k === 'shieldOn') dyn.push({ x: f.x, y: f.y, z: 60, r: 260, c: C('orange'), i: 0.9 * k })
      else if (f.k === 'heal') dyn.push({ x: f.x, y: f.y, z: 50, r: 160, c: C('green'), i: 0.5 * k })
      else if (f.k === 'buffOn') { const a = ACCENT[f.who ?? ''] ?? [1, 1, 1]; dyn.push({ x: f.x, y: f.y, z: 80, r: 340, c: a, i: 1.3 * k }) }
      else if (f.k === 'noise') dyn.push({ x: 640, y: 360, z: 200, r: 1400, c: C('violet'), i: 1.6 * k })
      else if (f.k === 'hitE' && f.crit) dyn.push({ x: f.x, y: f.y, z: 60, r: 180, c: [1, 0.9, 0.6], i: 0.8 * k })
      else if (f.k === 'chargeHit') dyn.push({ x: f.x2 ?? f.x, y: f.y2 ?? f.y, z: 40, r: 260, c: C('violet'), i: 1.1 * k })
    }
    for (const u of s.units) {
      if (u.dead) continue
      if (u.kind === 'boss') dyn.push({ x: u.x - 20, y: u.y - 150, z: 120, r: 420, c: [1, 0.3, 0.85], i: 0.7 + 0.2 * Math.sin(t * 4) })
      if (u.kind === 'pylon' || u.kind === 'caller') dyn.push({ x: u.x, y: u.y - 110, z: 80, r: 300, c: C('violet'), i: 0.8 + 0.3 * Math.sin(t * 5 + u.x) })
      if (u.kind === 'orb') dyn.push({ x: u.x, y: u.y - 100, z: 60, r: 180, c: C('violet'), i: 0.5 })
      if (u.tele?.k === 'slam') dyn.push({ x: u.tele.x, y: u.tele.y, z: 30, r: u.tele.r * 1.8, c: [1, 0.2, 0.25], i: 0.6 * (u.tele.t / u.tele.dur) })
      if (u.tele?.k === 'noise') dyn.push({ x: u.x, y: u.y - 120, z: 160, r: 900, c: C('violet'), i: 0.6 + 0.6 * (u.tele.t / u.tele.dur) })
      if (u.buffs.some((b) => b.src === u.kind)) { const a = ACCENT[u.kind]; if (a) dyn.push({ x: u.x, y: u.y - 60, z: 50, r: 200, c: a, i: 0.5 }) }
    }
    for (const d of s.devices) if (d.k === 'relay' && d.hp > 0) dyn.push({ x: d.x + 6, y: d.y - 90, z: 60, r: 220, c: [0.3, 1, 0.95], i: 0.55 + 0.25 * Math.sin(t * 6) })
    dyn.sort((a, b) => b.i * b.r - a.i * a.r)
    this.dyn = dyn.slice(0, 8)
    // 정적 빛은 4개까지만 두고 나머지 자리를 기술 빛에 준다
    return [...out.slice(0, Math.max(3, MAXL - dyn.length)), ...dyn].slice(0, MAXL)
  }

  dyn: Light[] = []
  /** 비교용: 켜면 조명·그림자 없이 원본 그림 그대로(개발 확인용) */
  flat = false
  private flash(c: [number, number, number], k: number) { if (this.reduce) k *= 0.4; this.boost = [Math.min(0.8, this.boost[0] + c[0] * k), Math.min(0.8, this.boost[1] + c[1] * k), Math.min(0.8, this.boost[2] + c[2] * k)] }
  // ───────── 입자·물결(화면 쪽 상태) ─────────
  private emit(f: Fx) {
    const R = Math.random; const n = this.reduce ? 0.4 : 1
    const burst = (cnt: number, o: Partial<Part> & { sp: number; c: [number, number, number] }) => { for (let i = 0; i < Math.round(cnt * n); i++) { const a = R() * Math.PI * 2, v = o.sp * (0.4 + R() * 0.8); this.parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - o.sp * 0.3, life: 0, max: (o.max ?? 0.5) * (0.7 + R() * 0.6), size: (o.size ?? 14) * (0.6 + R() * 0.8), tex: o.tex ?? 'spark', c: o.c, g: o.g ?? 600, rot: R() * 6, vr: (R() - 0.5) * 10, add: o.add ?? true, ground: o.ground }) } }
    if (f.k === 'hitE') burst(f.crit ? 10 : 5, { sp: 260, c: [0.85, 0.6, 1], size: 12, max: 0.35, g: 300 })
    else if (f.k === 'hitA') burst(5, { sp: 220, c: [1, 0.55, 0.5], size: 10, max: 0.3, g: 300 })
    else if (f.k === 'dieE') { this.flash([0.5, 0.25, 0.7], f.who === 'boss' ? 0.9 : 0.35); burst(26, { sp: 520, c: [1, 0.75, 1], size: 26, max: 0.45, g: 100 }); burst(16, { sp: 360, c: [0.8, 0.5, 1], tex: 'shard', size: 22, max: 0.9, g: 900, add: false, ground: f.y + 60 }); burst(10, { sp: 160, c: [0.8, 0.4, 1], tex: 'glow', size: 40, max: 0.6, g: -60 }) }
    else if (f.k === 'break') this.flash([0.5, 0.5, 0.55], 0.5), burst(22, { sp: 520, c: [1, 1, 1], size: 18, max: 0.5, g: 200 })
    else if (f.k === 'heal') burst(5, { sp: 60, c: [0.45, 1, 0.55], tex: 'glow', size: 18, max: 0.9, g: -140 })
    else if (f.k === 'noise') this.flash([0.7, 0.3, 1], 0.9)
    else if (f.k === 'slashBig') this.flash([0.4, 0.5, 0.7], 0.25)
    else if (f.k === 'buffOn') { const a = ACCENT[f.who ?? ''] ?? [1, 1, 1]; this.flash(a, 0.25); burst(16, { sp: 120, c: a, tex: 'glow', size: 22, max: 1.0, g: -220 }) }
    else if (f.k === 'slam') { this.flash([0.6, 0.3, 0.8], 0.45); burst(18, { sp: 300, c: [0.75, 0.6, 0.9], tex: 'glow', size: 34, max: 0.6, g: -40 }); this.ripple(f.x, f.y, (f.r ?? 120) * 1.4, 0.9, 0.9) }
    else if (f.k === 'cubePop') burst(6, { sp: 200, c: [1, 0.5, 0.55], size: 12, max: 0.35 })
    else if (f.k === 'chargeHit') this.ripple(f.x2 ?? f.x, f.y2 ?? f.y, 120, 0.6, 0.7)
    else if (f.k === 'dieA') burst(10, { sp: 160, c: [0.6, 0.9, 1], tex: 'glow', size: 26, max: 0.8, g: -80 })
  }
  private ripple(x: number, y: number, r: number, dur: number, a: number) { if (this.wetAt(x, y) > 0.15) this.ripples.push({ x, y, t: 0, dur, r, a: a * Math.min(1, this.wetAt(x, y) * 1.5) }) }

  // ───────── 한 프레임 ─────────
  render(s: Sim, t: number, dt: number, shakeOn: boolean) {
    if (!this.ready) return
    const gl = this.gl
    for (const f of s.fx) if (!this.seen.has(f.id)) { this.seen.add(f.id); this.emit(f) }
    if (this.seen.size > 4000) this.seen = new Set([...this.seen].slice(-1000))
    for (const p of this.parts) { p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.ground && p.y > p.ground) { p.y = p.ground; p.vy *= -0.3; p.vx *= 0.6 } }
    this.parts = this.parts.filter((p) => p.life < p.max)
    for (const r of this.ripples) r.t += dt
    this.ripples = this.ripples.filter((r) => r.t < r.dur)
    // 물웅덩이를 밟는 발걸음 물결
    for (const u of s.units) {
      if (u.dead) continue
      const last = this.stepT.get(u.id) ?? 0
      const moving = u.entering || !!u.task || u.act?.k === 'dash' || (u.side === 'enemy' && !u.statik)
      if (moving && t - last > (u.kind === 'boss' ? 0.5 : 0.32)) { this.stepT.set(u.id, t); this.ripple(u.x, u.y, u.kind === 'boss' ? 110 : 46, 0.9, u.kind === 'boss' ? 0.8 : 0.55) }
      const tr = this.trail.get(u.id) ?? []; tr.unshift({ x: u.x, y: u.y }); this.trail.set(u.id, tr.slice(0, 10))
    }
    const shake = shakeOn ? s.shake : 0
    this.cam = [(Math.random() - 0.5) * 16 * shake, (Math.random() - 0.5) * 12 * shake]
    const fade = Math.exp(-dt * 7); this.boost = [this.boost[0] * fade, this.boost[1] * fade, this.boost[2] * fade]
    // 카메라: 전투가 벌어지는 곳을 살짝 따라가고, 스킬 순간엔 시전자 쪽으로 당겨 준다
    if (!this.reduce) {
      const live = s.units.filter((u) => !u.dead && u.x < 1300)
      let cx = W / 2, cy = H / 2, z = 1.06
      if (live.length) { cx = live.reduce((a, u) => a + u.x, 0) / live.length; cy = live.reduce((a, u) => a + u.y, 0) / live.length - 70 }
      if (s.cutin && s.cutin.t < 0.55) { const c = s.units.find((u) => u.id === s.cutin!.kind); if (c) { cx = c.x + 120; cy = c.y - 90; z = 1.14 } }
      const k = Math.min(1, dt * (s.cutin ? 5 : 1.6))
      this.view.z += (z - this.view.z) * k; this.view.x += (cx - this.view.x) * k; this.view.y += (cy - this.view.y) * k
      const hw = W / 2 / this.view.z, hh = H / 2 / this.view.z
      this.view.x = Math.max(hw, Math.min(W - hw, this.view.x)); this.view.y = Math.max(hh, Math.min(H - hh, this.view.y))
    } else this.view = { x: W / 2, y: H / 2, z: 1 }
    const lights = this.collectLights(s, t)
    const units = [...s.units].sort((a, b) => a.y - b.y)
    gl.enable(gl.BLEND)

    // ① 반사 버퍼
    const R = this.ensureRefl()
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.fb); gl.viewport(0, 0, Math.round(this.canvas.width / 2), Math.round(this.canvas.height / 2))
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    for (const d of s.devices) if (d.k === 'relay' || d.k === 'shutter') this.drawProp(d.k, d.x, d.y, lights, true)
    for (const u of units) this.drawUnitSprite(u, t, s.focus, lights, true)
    this.drawFx(s, t, true)

    // ② 배경
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.disable(gl.BLEND)
    const pb = this.use(this.progs.bg)
    const BG = this.tex.get(this.bg.file)!, BN = this.nrm.get(this.bg.file)!
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, BG.t); gl.uniform1i(pb.u('uBg'), 0)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, BN.t); gl.uniform1i(pb.u('uBgN'), 1)
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, R.tex); gl.uniform1i(pb.u('uRefl'), 2)
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.maskTex!.t); gl.uniform1i(pb.u('uMask'), 3)
    gl.uniform1f(pb.u('uTime'), t); gl.uniform3fv(pb.u('uAmb'), this.flat ? [1, 1, 1] : this.bg.amb); gl.uniform3fv(pb.u('uBoost'), this.flat ? [0, 0, 0] : this.boost); gl.uniform1f(pb.u('uRip'), this.bg.ripple * (this.reduce ? 0.3 : 1))
    this.setLights(pb, this.flat ? [] : lights)
    const m = 24 // 흔들림 여백
    this.quad([-m, -m, W + m, -m, W + m, H + m, -m, H + m], [0, 0, 1, 0, 1, 1, 0, 1])
    gl.enable(gl.BLEND)

    // ③ 바닥: 물결 · 예고 · 그림자 · 장치 보호막
    for (const r of this.ripples) { const k = r.t / r.dur; this.shape(4, this.box(r.x, r.y, r.r * 2 * (0.3 + k), r.r * 0.62 * (0.3 + k)), [0.85, 0.92, 1, r.a * (1 - k) * 0.5], 0, true) }
    for (const u of s.units) if (u.tele && !u.dead) this.drawTele(u, t, false)
    // 바닥에 떨어지는 빛 웅덩이(기술·폭발 빛이 땅을 물들임)
    if (!this.flat) for (const l of this.dyn) { if (l.i < 0.4) continue; const gy = Math.max(320, l.y + (l.z > 40 ? 80 : 20)); this.shape(3, this.box(l.x, gy, l.r * 1.2, l.r * 0.42), [l.c[0], l.c[1], l.c[2], Math.min(0.55, l.i * 0.16)], 0, true) }
    // 그림자: 주광(노을·달빛) 반대쪽으로 길게 + 가까운 강한 빛(폭발·스킬)이 있으면 그 반대쪽으로 한 장 더
    const kd = this.bg.keyDir
    for (const u of units) {
      if (u.dead > 0.8 || (u.side === 'enemy' && u.entering && u.x > 1250)) continue
      const L = (LOOKS as Record<string, Look>)[u.kind]; const ds = depthScale(u.y)
      const w = (u.kind === 'boss' ? 260 : u.kind === 'golem' ? 150 : u.kind === 'pylon' || u.kind === 'caller' ? 120 : u.kind === 'mite' ? 70 : 92) * ds
      this.shape(0, this.box(u.x, u.y + 2, w, w * 0.3), [0, 0, 0.02, (L.float ? 0.25 : 0.5) * (1 - u.dead)])
      if (L.float || this.flat) continue
      this.drawUnitSprite(u, t, null, lights, false, { dx: -kd[0] * 1.15, dy: 0.28, a: 0.38 })
      let best: Light | null = null, bi = 0
      for (const l of this.dyn) { const d = Math.hypot(l.x - u.x, (l.y - u.y) * 0.8); if (d > l.r || d < 20) continue; const I = l.i * (1 - d / l.r) ** 2; if (I > bi) { bi = I; best = l } }
      if (best && bi > 0.12) { const dx = u.x - best.x, dy = (u.y - best.y), L2 = Math.hypot(dx, dy) || 1; this.drawUnitSprite(u, t, null, lights, false, { dx: dx / L2 * 1.1, dy: Math.max(0.1, dy / L2 * 0.5 + 0.15), a: Math.min(0.5, bi * 0.5) }) }
    }
    for (const d of s.devices) { const w = (d.k === 'relay' ? 110 : 80) * depthScale(d.y); this.shape(0, this.box(d.x, d.y + 2, w, w * 0.3), [0, 0, 0.02, 0.45]) }
    if (s.focus) { const f = s.units.find((u) => u.id === s.focus); if (f && !f.dead) { const w = 120 * depthScale(f.y) * (f.kind === 'boss' ? 2.2 : 1); this.shape(5, this.box(f.x, f.y, w, w * 0.34), [1, 0.85, 0.2, 0.8], 0, true) } }

    // ④ 소품·유닛
    const drawList: { y: number; f: () => void }[] = []
    for (const d of s.devices) drawList.push({ y: d.y, f: () => this.drawProp(d.k, d.x, d.y, lights, false, d.k === 'relay' && d.hp < d.max * 0.3 ? 0.2 + 0.2 * Math.sin(t * 12) : 0, d.k === 'shutter' && (d.closed > 0 || d.cool > 0) ? [1, 0.6, 0.2, 0.0] : [0.55, 0.92, 1, 0.45]) })
    for (const u of units) {
      drawList.push({
        y: u.y, f: () => {
          // 돌진 잔상
          if (u.act?.k === 'dash' && !this.reduce) { const tr = this.trail.get(u.id) ?? []; const ac = ACCENT[u.kind] ?? [0.8, 0.4, 1]; tr.slice(2, 8).forEach((p, i) => { if (i % 2) return; const L = (LOOKS as Record<string, Look>)[u.kind]; this.fxQuad('glow', p.x, p.y - L.head * 0.45, 90, 140, 0, [ac[0], ac[1], ac[2], 0.18 * (1 - i / 6)]) }) }
          this.drawUnitSprite(u, t, s.focus, lights, false)
        },
      })
    }
    drawList.sort((a, b) => a.y - b.y).forEach((d) => d.f())

    // ⑤ 이펙트
    this.drawFx(s, t, false)
    for (const d of s.devices) if (d.guard > 0) { const k = 0.5 + 0.15 * Math.sin(t * 5); this.shape(3, this.box(d.x, d.y - 60, 220, 220), [1, 0.55, 0.2, 0.28 * k], 0, true); this.shape(5, this.box(d.x, d.y - 60, 200, 200), [1, 0.65, 0.3, 0.7], 0, true) }
    for (const u of s.units) if (!u.dead && u.buffs.some((b) => b.id === 'ian-b' && b.mods.dmgRed)) this.shape(5, this.box(u.x, u.y - 70, 150, 170), [1, 0.65, 0.3, 0.7], 0, true)
    for (const u of s.units) if (!u.dead && u.shield > 0) this.shape(3, this.box(u.x, u.y - 60, 140, 170), [1, 0.6, 0.25, 0.16], 0, true)
    for (const p of this.parts) { const k = p.life / p.max; if (p.add) this.fxQuad(p.tex, p.x, p.y, p.size * (1 - k * 0.4), p.size * (1 - k * 0.4), p.rot, [p.c[0], p.c[1], p.c[2], (1 - k)]); else this.fxQuad(p.tex, p.x, p.y, p.size, p.size, p.rot, [p.c[0], p.c[1], p.c[2], (1 - k) * 0.9]) }
    // ⑥ 예고 윤곽(이펙트에 가려지지 않게 맨 위에 한 번 더)
    for (const u of s.units) if (u.tele && !u.dead) this.drawTele(u, t, true)
  }

  private drawTele(u: Unit, t: number, top: boolean) {
    const tl = u.tele!; const k = Math.min(1, tl.t / tl.dur)
    const pulse = 0.85 + 0.15 * Math.sin(t * 16)
    if (tl.k === 'slam') {
      const w = tl.r * 2, h = tl.r * 2 / 1.6
      if (top) this.shape(5, this.box(tl.x, tl.y, w, h), [1, 0.3, 0.35, 0.45 * pulse], 0, true)
      else this.shape(1, this.box(tl.x, tl.y, w, h), [1, 0.12, 0.2, 0.55 * pulse], k)
    } else if (tl.k === 'charge') {
      const dx = tl.x2 - tl.x, dy = tl.y2 - tl.y; const L = Math.hypot(dx, dy); const ang = Math.atan2(dy, dx)
      const pts = this.box(tl.x, tl.y, L, tl.w, ang, 0, 0.5)
      if (top) this.shape(6, pts, [1, 0.3, 0.35, 0.45 * pulse], 0, true)
      else this.shape(2, pts, [1, 0.12, 0.2, 0.55 * pulse], k)
    } else if (!top && (tl.k === 'cast' || tl.k === 'noise' || tl.k === 'call')) {
      const c: [number, number, number, number] = tl.k === 'call' ? [1, 0.85, 0.2, 0.25] : [0.75, 0.35, 1, 0.3]
      this.shape(1, this.box(u.x, u.y, 200 * (tl.k === 'noise' ? 2.4 : 1), 70 * (tl.k === 'noise' ? 2.4 : 1)), c, k)
    }
  }

  private drawFx(s: Sim, t: number, refl: boolean) {
    const gy = (y: number) => y + 95 // 공중 이펙트의 반사 기준(대략 발밑)
    for (const p of s.proj) {
      const fy = gy(p.y)
      if (p.k === 'ring') { this.fxQuad('ring', p.x, p.y, 54, 62, 0, [0.85, 1, 0.35, 1], refl, fy); this.fxQuad('ring', p.x - 18, p.y, 40, 48, 0, [0.85, 1, 0.35, 0.55], refl, fy); this.fxQuad('glow', p.x, p.y, 64, 64, 0, [0.6, 1, 0.2, 0.35], refl, fy) }
      else if (p.k === 'wave') { for (let i = 0; i < 3; i++) this.fxQuad('wave', p.x - i * 26, p.y + 40, 150 - i * 20, 560 - i * 60, 0, [0.78, 1, 0.3, 0.9 - i * 0.25], refl, fy + 200) }
      else if (p.k === 'slash') { this.fxQuad('slash', p.x, p.y, 120, 120, 0.2, [0.7, 0.85, 1, 1], refl, fy); this.fxQuad('glow', p.x, p.y, 90, 60, 0, [0.5, 0.7, 1, 0.5], refl, fy) }
      else if (p.k === 'cube') { const g = this.gl; void g; this.fxQuad('glow', p.x, p.y, 90, 90, 0, [1, 0.4, 0.45, 0.6], refl, fy); this.fxQuad('cube', p.x, p.y, 54, 54, t * 8 + p.id, [1, 1, 1, 0.95], refl, fy) }
      else if (p.k === 'bolt') { this.fxQuad('glow', p.x, p.y, 70, 70, 0, [0.8, 0.4, 1, 0.9], refl, fy); this.fxQuad('spark', p.x, p.y, 40, 40, t * 6, [1, 0.8, 1, 0.9], refl, fy) }
    }
    for (const f of s.fx) {
      const k = f.t / f.dur; const fy = gy(f.y)
      if (f.k === 'slashBig') { this.fxQuad('slash', f.x, f.y, 260 * (0.8 + k * 0.4), 260 * (0.8 + k * 0.4), (f.v ?? 0) * 1.2 - 0.6, [0.75, 0.9, 1, 1 - k], refl, fy) }
      else if (f.k === 'slashHit') this.fxQuad('spark', f.x, f.y, 70 * (1 + k), 70 * (1 + k), k * 2, [0.8, 0.9, 1, 1 - k], refl, fy)
      else if (f.k === 'ringHit') this.fxQuad('ring', f.x, f.y, 60 + k * 90, 60 + k * 90, 0, [0.78, 1, 0.3, 1 - k], refl, fy)
      else if (f.k === 'cubeDrop') { const y = f.y - 220 * (1 - Math.min(1, k * 1.6)); this.fxQuad('cube', f.x, y, 90, 90, k * 3, [1, 1, 1, k < 0.65 ? 1 : (1 - k) * 3], refl, fy); if (k > 0.55) this.fxQuad('ring', f.x, f.y + 30, 140 * (k - 0.4) * 3, 60 * (k - 0.4) * 3, 0, [1, 0.45, 0.5, (1 - k) * 2], refl, fy) }
      else if (f.k === 'bash') this.fxQuad('spark', f.x, f.y, 90, 90, k, [1, 0.7, 0.35, 1 - k], refl, fy)
      else if (f.k === 'wall') { this.fxQuad('glow', f.x, f.y, 140, 260, 0, [1, 0.55, 0.2, (1 - k) * 0.8], refl, fy + 40); this.fxQuad('ring', f.x, f.y, 120 + k * 80, 220 + k * 120, 0, [1, 0.65, 0.3, (1 - k)], refl, fy + 40) }
      else if (f.k === 'shieldOn') this.fxQuad('ring', f.x, f.y, 110 + k * 30, 140 + k * 30, 0, [1, 0.65, 0.3, (1 - k) * 0.9], refl, fy)
      else if (f.k === 'break') { this.fxQuad('ring', f.x, f.y, 80 + k * 300, 80 + k * 300, 0, [1, 1, 1, 1 - k], refl, fy); this.fxQuad('spark', f.x, f.y, 220 * (1 - k), 220 * (1 - k), k * 3, [1, 1, 1, 1 - k], refl, fy) }
      else if (f.k === 'beam') {
        const x2 = f.x2 ?? f.x, y2 = f.y2 ?? f.y; const L = Math.hypot(x2 - f.x, y2 - f.y); const ang = Math.atan2(y2 - f.y, x2 - f.x)
        const pts = this.box(f.x, f.y, L, 44 * (1 - k * 0.6), ang, 0, 0.5)
        const p = this.use(this.progs.fx); const T = this.fxTex.get('beam')!; const gl = this.gl
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.t); gl.uniform1i(p.u('uTex'), 0); gl.uniform4f(p.u('uC'), 0.85 * (1 - k), 0.5 * (1 - k), 1 * (1 - k), 1 - k); gl.uniform1f(p.u('uRefl'), 0); gl.blendFunc(gl.ONE, gl.ONE)
        if (!refl) this.quad(pts, [0, 0, 1, 0, 1, 1, 0, 1])
      }
      else if (f.k === 'noise' && !refl) this.shape(3, this.box(640, 360, 1800, 1100), [0.6, 0.3, 1, 0.5 * (1 - k)], 0, true)
      else if (f.k === 'summon') this.fxQuad('ring', f.x, f.y, 100 + k * 160, 100 + k * 160, 0, [1, 0.85, 0.3, 1 - k], refl, fy)
      else if (f.k === 'shutter' && !refl) this.fxQuad('glow', 1240, f.y - 40, 160, 260, 0, [1, 0.55, 0.2, (1 - k) * 0.9])
      else if (f.k === 'chargeHit') this.fxQuad('glow', f.x2 ?? f.x, (f.y2 ?? f.y) - 40, 260 * (1 - k), 140 * (1 - k), 0, [0.8, 0.4, 1, 1 - k], refl, gy(f.y2 ?? f.y))
      else if (f.k === 'hitD') this.fxQuad('spark', f.x, f.y, 70, 70, k * 3, [0.4, 1, 0.95, 1 - k], refl, fy)
    }
  }

  dispose() { const gl = this.gl; for (const x of [...this.tex.values(), ...this.nrm.values(), ...this.fxTex.values()]) gl.deleteTexture(x.t); this.tex.clear(); this.nrm.clear() }
}

export function headY(u: Unit) { const L = (LOOKS as Record<string, Look>)[u.kind]; return u.y - (L?.head ?? headOf(u)) * depthScale(u.y) - (L?.float ?? 0) }
