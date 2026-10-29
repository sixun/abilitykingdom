import { useEffect, useRef } from 'react'
import { useReduceMotion, useScreenActive } from '../motion'
import partsJson from '../../game/data/live-parts.json'
import { LIVE, ease, hop, type Glint, type MaskSpec, type Xf } from './specs'

// 로비 버튼: 원본 조각 그림 자체를 움직인다(버튼 상자를 통째로 흔들지 않는다).
// - 부위 윤곽(live-parts.json, tools/build_live_parts.py)으로 원본을 잘라 그 부위만 움직이고, 비는 자리는 메움색으로 칠한다
// - 빛은 원본의 밝은 선·색 영역 안에서만 지나간다(실행 중에 원본 픽셀로 마스크를 만든다. 새 그림 파일 없음)
// - 박자: 누르거나 마우스를 올리면 바로 크게 / 알림이 있으면 자주 / 평소에는 몇 초에 한 번(버튼마다 엇갈림)
// - 알림 표시는 표시 없는 원본 위에 표시 있는 원본의 그 부분만 얹고, 박자에 맞춰 톡 튄다
// 동작 줄이기·화면 비활성 때는 원본 한 장(알림이면 표시 포함).
type PartGeo = { polys: number[][][]; fill: number[] | null; box: number[] }
const GEO = partsJson as unknown as Record<string, { src: string; parts: Record<string, PartGeo> }>

const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })

function buildMask(img: HTMLImageElement, W: number, H: number, m: MaskSpec) {
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, W, H)
  const d = g.getImageData(0, 0, W, H); const p = d.data
  const [rx, ry, rw, rh] = m.rect ?? [0, 0, W, H]
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    const r = p[i], gg = p[i + 1], b = p[i + 2], a = p[i + 3]
    let k = 0
    const inside = x >= rx && x < rx + rw && y >= ry && y < ry + rh
      && !(m.notCircle && (x - m.notCircle[0]) ** 2 + (y - m.notCircle[1]) ** 2 < m.notCircle[2] ** 2)
    if (inside && a > 40) {
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0
      const lum = 0.299 * r + 0.587 * gg + 0.114 * b
      if (m.crit === 'bright') k = Math.min(1, Math.max(0, (lum - 150) / 70)) * (sat < 0.35 ? 1 : 0.3)
      else if (m.crit === 'alpha') k = 0.55 + 0.45 * (lum / 255)
      else if (m.crit === 'blue') k = b > r + 40 && b > 120 ? Math.min(1, (b - r) / 120) : 0
      else if (m.crit === 'orange') k = r > 170 && r > b + 70 && gg > 70 ? 1 : 0
      else if (m.crit === 'warm') k = r > 170 && gg > 120 && b < gg - 30 ? Math.min(1, (lum - 130) / 80) : 0
    }
    p[i] = p[i + 1] = p[i + 2] = 255; p[i + 3] = Math.round(k * (a / 255) * 255)
  }
  g.putImageData(d, 0, 0)
  return c
}

function polyPath(g: CanvasRenderingContext2D, geo: PartGeo | undefined, circle?: [number, number, number]) {
  g.beginPath()
  if (circle) { g.arc(circle[0], circle[1], circle[2], 0, Math.PI * 2); return }
  for (const poly of geo?.polys ?? []) { poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath() }
}

function apply(g: CanvasRenderingContext2D, f: Xf, big: number) {
  const ox = f.ox ?? 0, oy = f.oy ?? 0
  const sx = 1 + ((f.sx ?? 1) - 1) * big, sy = 1 + ((f.sy ?? 1) - 1) * big
  g.translate(ox + (f.dx ?? 0) * big, oy + (f.dy ?? 0) * big); g.rotate((f.rot ?? 0) * big); g.scale(sx, sy); g.translate(-ox, -oy)
}
const still = (f: Xf) => !f.dx && !f.dy && !f.rot && (f.sx ?? 1) === 1 && (f.sy ?? 1) === 1

export function LiveRef({ id, src, badgeSrc, alert = false, x, y, w, h, z = 2, kick = 0 }: {
  id: string; src: string; badgeSrc?: string; alert?: boolean; x: number; y: number; w: number; h: number; z?: number; kick?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReduceMotion()
  const active = useScreenActive()
  const kickAt = useRef(-99)
  const t0 = useRef(performance.now())
  const alertRef = useRef(alert); alertRef.current = alert
  useEffect(() => { if (kick) kickAt.current = (performance.now() - t0.current) / 1000 }, [kick])
  const S = LIVE[id]
  useEffect(() => {
    const c = ref.current; if (!c || !S) return
    const W = w, H = h
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr)
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const tc = document.createElement('canvas'); tc.width = c.width; tc.height = c.height
    const tmp = tc.getContext('2d')!; tmp.setTransform(dpr, 0, 0, dpr, 0, 0)
    const geo = GEO[id]?.parts ?? {}
    let raf = 0, alive = true, lastKey = ''
    Promise.all([load(src), badgeSrc ? load(badgeSrc).catch(() => null) : Promise.resolve(null)]).then(([base, badge]) => {
      if (!alive) return
      const masks = (S.glints ?? []).map((gl) => buildMask(base, W, H, gl.mask))
      const drawBadge = (b: number) => {
        if (!badge || !S.badge || !alertRef.current) return
        const [cx, cy, r] = S.badge
        g.save(); apply(g, { sx: 1 + 0.18 * hop(b), sy: 1 + 0.18 * hop(b), ox: cx, oy: cy }, 1)
        g.beginPath(); g.arc(cx, cy, r + 1.5, 0, Math.PI * 2); g.clip(); g.drawImage(badge, 0, 0, W, H); g.restore()
      }
      if (reduce || !active) { g.clearRect(0, 0, W, H); g.drawImage(base, 0, 0, W, H); drawBadge(-1); return }

      const glintAmt = (gl: Glint, b: number, t: number): [number, number] => {
        if (gl.when === 'cycle') {
          const k = ((t + (gl.phase ?? 0)) % gl.cycle!) / (gl.dur ?? gl.cycle!)
          return k <= 1 ? [ease(k), hop(k)] : [0, 0]
        }
        return b >= 0 ? [ease(b), hop(b)] : [0, 0]
      }
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame)
        const t = (now - t0.current) / 1000
        const al = alertRef.current
        const sinceKick = t - kickAt.current
        const per = al && S.alertPeriod ? S.alertPeriod : S.period
        const idle = per ? ((t + S.offset) % per) / S.beat : 9
        const b = sinceKick < S.beat ? sinceKick / S.beat : idle < 1 ? idle : -1
        const big = sinceKick < S.beat ? 1.35 : 1
        const xf: Record<string, Xf> = {}
        for (const [name, p] of Object.entries(S.parts ?? {})) xf[name] = p.at(b, t, al)
        const gls = (S.glints ?? []).map((gl) => glintAmt(gl, b, t))
        const key = `${al}|${b >= 0 ? b.toFixed(3) : '-'}|${JSON.stringify(xf)}|${gls.map((q) => q[1].toFixed(3)).join(',')}`
        if (key === lastKey) return
        lastKey = key
        g.globalCompositeOperation = 'source-over'
        g.clearRect(0, 0, W, H)
        g.drawImage(base, 0, 0, W, H)
        // 부위: 빈자리 메움 → 원본에서 그 부위만 잘라 옮겨 그린다(부모 부위가 있으면 함께 움직인다)
        const chain = (name: string): Xf[] => { const par = S.parent?.[name]; return par ? [...chain(par), xf[par]] : [] }
        for (const [name, p] of Object.entries(S.parts ?? {})) {
          const pg0 = geo[name]
          const f0 = xf[name]
          const f = pg0 && (f0.ox === undefined || f0.oy === undefined)
            ? { ...f0, ox: f0.ox ?? pg0.box[0] + pg0.box[2] / 2, oy: f0.oy ?? (p.pivot === 'bottom' ? pg0.box[1] + pg0.box[3] : p.pivot === 'top' ? pg0.box[1] : pg0.box[1] + pg0.box[3] / 2) }
            : f0
          const parents = chain(name)
          if (still(f) && parents.every(still)) continue
          const pg = pg0
          const fill = p.fill !== undefined ? p.fill : pg?.fill
          g.save()
          parents.forEach((q) => apply(g, q, big)) // 부모는 exact 부위가 아님
          polyPath(g, pg, p.circle)
          if (fill === null || fill === undefined) { g.globalCompositeOperation = 'destination-out'; g.fill(); g.globalCompositeOperation = 'source-over' }
          else { g.fillStyle = `rgb(${fill.join(',')})`; g.fill() }
          apply(g, f, p.exact ? 1 : big)
          polyPath(g, pg, p.circle); g.clip()
          g.drawImage(base, 0, 0, W, H)
          g.restore()
        }
        // 빛: 원본의 선·색 영역 안에서만
        ;(S.glints ?? []).forEach((gl, i) => {
          const [pos, amt] = gls[i]
          if (amt < 0.02) return
          tmp.globalCompositeOperation = 'source-over'; tmp.clearRect(0, 0, W, H)
          const col = gl.color ?? '235,246,255', a = (gl.strength ?? 0.85) * amt
          if (gl.mode === 'pulse') {
            tmp.fillStyle = `rgba(${col},${a})`
          } else if (gl.mode === 'orbit' && 'createConicGradient' in tmp) {
            const cg = tmp.createConicGradient(-Math.PI / 2 + pos * Math.PI * 2, gl.cx ?? W / 2, gl.cy ?? H / 2)
            cg.addColorStop(0, `rgba(${col},0)`); cg.addColorStop(0.9, `rgba(${col},0)`); cg.addColorStop(0.985, `rgba(${col},${a})`); cg.addColorStop(1, `rgba(${col},0)`)
            tmp.fillStyle = cg
          } else {
            const bw = gl.width ?? 22, k = gl.mode === 'down' ? 0 : 0.5
            if (gl.mode === 'down') {
              const yc = -bw + pos * (H + bw * 2)
              const lg = tmp.createLinearGradient(0, yc - bw, 0, yc + bw)
              lg.addColorStop(0, `rgba(${col},0)`); lg.addColorStop(0.5, `rgba(${col},${a})`); lg.addColorStop(1, `rgba(${col},0)`); tmp.fillStyle = lg
            } else {
              const xc = -bw - H * k + pos * (W + bw * 2 + H * k * 2)
              const lg = tmp.createLinearGradient(xc - bw, H / 2 - bw * k, xc + bw, H / 2 + bw * k)
              lg.addColorStop(0, `rgba(${col},0)`); lg.addColorStop(0.5, `rgba(${col},${a})`); lg.addColorStop(1, `rgba(${col},0)`); tmp.fillStyle = lg
            }
          }
          tmp.fillRect(0, 0, W, H)
          tmp.globalCompositeOperation = 'destination-in'; tmp.drawImage(masks[i], 0, 0, W, H)
          // 흰 선 위에서는 더하기 빛이 안 보이므로 번짐(글로우)을 함께 그린다
          g.save(); g.globalCompositeOperation = 'lighter'
          g.shadowColor = `rgba(${gl.glowColor ?? col},${Math.min(1, a * 1.1)})`; g.shadowBlur = (gl.glow ?? 7) * dpr
          g.drawImage(tc, 0, 0, W, H); g.restore()
        })
        drawBadge(b)
      }
      raf = requestAnimationFrame(frame)
    }).catch(() => {})
    return () => { alive = false; cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, active, id, src, badgeSrc, w, h, (reduce || !active) && alert])
  return <canvas ref={ref} className="live-ref" data-layer={id} aria-hidden style={{ position: 'absolute', left: x, top: y, width: w, height: h, zIndex: z, pointerEvents: 'none' }} />
}
