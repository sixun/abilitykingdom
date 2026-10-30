import { useEffect, useRef } from 'react'
import { useReduceMotion, useScreenActive } from '../motion'
import atlasJson from '../../game/data/live-atlas.json'
import { SCENES, type Stage, type Xf } from './scenes'

// 로비 버튼 '장면' 움직임: 원본을 4배로 키운 아틀라스(원본·부위 뗀 판·부위들)를 꺼내 버튼마다 짠 연기를 그린다.
// - 연기 중일 때만 매 프레임 그리고, 아니면 원본 한 장(다시 그리지 않음)
// - 누르거나 마우스를 올리면 바로 한 번(조금 더 크게) / 알림이 있으면 자주 / 평소엔 정해진 간격
// - 동작 줄이기·화면 비활성: 원본 한 장(알림 점은 그대로)
type Atlas = { src: string; w: number; h: number; s: number; frames: string[]; boxes: Record<string, number[]>; colors: Record<string, number[]> }
const ATLAS = atlasJson as unknown as Record<string, Atlas>

export function hasLiveIcon(id: string) { return !!ATLAS[id] && !!SCENES[id] }

export function LiveIcon({ id, x, y, z = 2, kick = 0, alert = false }: { id: string; x: number; y: number; z?: number; kick?: number; alert?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReduceMotion()
  const active = useScreenActive()
  const kickAt = useRef(-99)
  const t0 = useRef(performance.now())
  const alertRef = useRef(alert); alertRef.current = alert
  useEffect(() => { if (kick) kickAt.current = (performance.now() - t0.current) / 1000 }, [kick])
  const A = ATLAS[id], SC = SCENES[id]
  useEffect(() => {
    const c = ref.current; if (!c || !A || !SC) return
    const { w: W, h: H, s: S } = A
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1) * 1.25)
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr)
    const g = c.getContext('2d')!
    let raf = 0, alive = true, idleDrawn = false, lastAlert = alertRef.current
    const img = new Image()
    img.onload = () => {
      if (!alive) return
      const idx = Object.fromEntries(A.frames.map((f, i) => [f, i]))
      const draw = (name: string, f: Xf = {}) => {
        const i = idx[name]; if (i === undefined) return
        g.save()
        if (f.alpha !== undefined) g.globalAlpha *= f.alpha
        const ox = f.ox ?? W / 2, oy = f.oy ?? H / 2
        g.translate(ox + (f.dx ?? 0), oy + (f.dy ?? 0)); g.rotate(f.rot ?? 0); g.scale(f.sx ?? 1, f.sy ?? 1); g.translate(-ox, -oy)
        g.drawImage(img, 0, i * H * S, W * S, H * S, 0, 0, W, H)
        g.restore()
      }
      const stage: Stage = {
        g, W, H, draw,
        box: (n) => (A.boxes[n] ?? [0, 0, W, H]) as [number, number, number, number],
        color: (n) => (A.colors[n] ?? [200, 200, 200]) as [number, number, number],
      }
      const paint = (u: number, t: number, big: number) => {
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
        g.clearRect(0, 0, W, H)
        SC.play(stage, u, t, alertRef.current, big)
      }
      if (reduce || !active) { paint(-1, 0, 1); return }
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame)
        const t = (now - t0.current) / 1000
        const al = alertRef.current
        const since = t - kickAt.current
        const per = al && SC.alertPeriod ? SC.alertPeriod : SC.period
        const ph = per ? (t + SC.offset) % per : 99
        // 확인용: window.__LIVE_U__ 에 숫자를 넣으면 모든 버튼이 그 시각의 장면으로 멈춘다(테스트·녹화용)
        const dbg = (window as unknown as { __LIVE_U__?: number }).__LIVE_U__
        const u = typeof dbg === 'number' ? dbg : since < SC.beat ? since : ph < SC.beat ? ph : -1
        if (u < 0) {
          if (idleDrawn && lastAlert === al && dbg === undefined) return
          idleDrawn = true; lastAlert = al
          paint(-1, t, 1); return
        }
        idleDrawn = false
        paint(u, t, since < SC.beat ? 1.2 : 1)
      }
      raf = requestAnimationFrame(frame)
    }
    img.src = A.src
    return () => { alive = false; cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, active, id, (reduce || !active) && alert])
  if (!A) return null
  return <canvas ref={ref} className="live-icon" data-layer={id} aria-hidden style={{ position: 'absolute', left: x, top: y, width: A.w, height: A.h, zIndex: z, pointerEvents: 'none' }} />
}
