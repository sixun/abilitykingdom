import { useEffect, useRef } from 'react'
import { useReduceMotion, useScreenActive } from '../motion'

// 하단 메뉴 아이콘: 원본 그림(AI로 선명하게 키운 것, public/ui/nav/<종류>.webp)을 부위별로 잘라 그 그림 자체를 움직인다.
// 원본 tools/navicons/. 좌표는 모두 원본 조각(1배) 기준.
// - 평소: 몇 초에 한 번 짧게 '한 박자' 움직이고(아이콘마다 시작 시각을 엇갈림), 영입은 펜이 계속 사각거린다
// - 누르거나(손가락을 대는 순간) 마우스를 올리면 바로 크게 한 번 움직인다
// - 선 마스크(<종류>-lines.webp) 안에서만 빛이 훑고 지나간다
// 동작 줄이기·화면 비활성 때는 원본 그대로 한 장면.
type Kind = 'characters' | 'formation' | 'bag' | 'recruitment'
type Xf = { dx?: number; dy?: number; rot?: number; sx?: number; sy?: number; ox?: number; oy?: number }
type Part = { at: (b: number, t: number) => Xf } // b = 박자 진행 0~1(없으면 -1). 그림은 <종류>-p<번호>.webp(0 = 글자, 고정)

// 0→1→0 한 번 튀는 곡선
const hop = (b: number, s = 0, e = 1) => (b < s || b > e ? 0 : Math.sin(((b - s) / (e - s)) * Math.PI))
const ease = (b: number, s = 0, e = 1) => (b <= s ? 0 : b >= e ? 1 : (1 - Math.cos(((b - s) / (e - s)) * Math.PI)) / 2)

const DEF: Record<Kind, { w: number; h: number; beat: number; offset: number; parts: Part[] }> = {
  // 세 사람이 왼쪽→가운데→오른쪽 차례로 폴짝(팀원이 모이는 느낌)
  characters: {
    w: 93, h: 118, beat: 0.9, offset: 0.6,
    parts: [
      { at: (b) => ({ dy: -5 * hop(b, 0, 0.45) }) },
      { at: (b) => ({ dy: -6 * hop(b, 0.2, 0.65) }) },
      { at: (b) => ({ dy: -5 * hop(b, 0.4, 0.85) }) },
    ],
  },
  // 편성 교체: 옆의 꺾인 화살표가 바깥으로 튕겼다 돌아오고, 마름모 카드가 살짝 기운다
  formation: {
    w: 91, h: 119, beat: 0.8, offset: 2.4,
    parts: [
      { at: (b) => ({ rot: -0.12 * hop(b, 0, 0.7), ox: 33, oy: 42 }) },
      { at: (b) => ({ dx: 5 * hop(b, 0.1, 0.8), dy: -4 * hop(b, 0.1, 0.8) }) },
    ],
  },
  // 가방(전술 조끼): 들썩 메는 느낌으로 위로 들렸다 내려앉는다
  bag: {
    w: 76, h: 117, beat: 0.7, offset: 4.1,
    parts: [{ at: (b) => ({ dy: -5 * hop(b, 0, 0.55) + 1.5 * hop(b, 0.55, 1), sy: 1 + 0.05 * hop(b, 0.55, 1) - 0.03 * hop(b, 0, 0.3), oy: 72, ox: 38 }) }],
  },
  // 영입: 펜이 글씨를 쓰듯 사각거리고(항상), 누르면 크게 한 획 긋는다
  recruitment: {
    w: 85, h: 120, beat: 0.8, offset: 1.2,
    parts: [
      { at: () => ({}) }, // 클립보드
      { at: (b, t) => ({ dx: 0.9 * Math.sin(t * 9) - 5 * hop(b, 0, 0.6), dy: 0.6 * Math.sin(t * 13) + 2 * hop(b, 0, 0.6), rot: 0.05 * Math.sin(t * 9) - 0.14 * hop(b, 0, 0.6), ox: 44, oy: 54 }) },
    ],
  },
}
const PERIOD = 7.5 // 평소 '한 박자' 간격(초)

const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })

export function LiveNavIcon({ kind, x, y, z = 2, kick = 0 }: { kind: Kind; x: number; y: number; z?: number; kick?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReduceMotion()
  const active = useScreenActive()
  const kickAt = useRef(-99)
  const t0 = useRef(performance.now())
  useEffect(() => { if (kick) kickAt.current = (performance.now() - t0.current) / 1000 }, [kick])
  const D = DEF[kind]
  useEffect(() => {
    const c = ref.current; if (!c) return
    const { w: W, h: H } = D
    const dpr = Math.min(3, (window.devicePixelRatio || 1) * 1.5)
    c.width = W * dpr; c.height = H * dpr
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const tc = document.createElement('canvas'); tc.width = W * dpr; tc.height = H * dpr
    const tmp = tc.getContext('2d')!; tmp.setTransform(dpr, 0, 0, dpr, 0, 0)
    let raf = 0, alive = true
    Promise.all([load(`ui/nav/${kind}.webp`), load(`ui/nav/${kind}-lines.webp`), ...Array.from({ length: D.parts.length + 1 }, (_, i) => load(`ui/nav/${kind}-p${i}.webp`))]).then(([base, lines, text, ...parts]) => {
      if (!alive) return
      const still = () => { g.clearRect(0, 0, W, H); g.drawImage(base, 0, 0, W, H) }
      if (reduce || !active) { still(); return }
      const frame = (now: number) => {
        const t = (now - t0.current) / 1000
        // 박자 진행: 누른 직후가 우선, 아니면 주기적으로
        const sinceKick = t - kickAt.current
        const idle = ((t + D.offset) % PERIOD) / D.beat
        const b = sinceKick < D.beat ? sinceKick / D.beat : idle < 1 ? idle : -1
        const big = sinceKick < D.beat ? 1.3 : 1
        g.clearRect(0, 0, W, H)
        g.drawImage(text, 0, 0, W, H) // 글자는 그대로
        D.parts.forEach((p, i) => {
          const f = p.at(b, t)
          const ox = f.ox ?? W / 2, oy = f.oy ?? 40
          g.save()
          g.translate(ox + (f.dx ?? 0) * big, oy + (f.dy ?? 0) * big); g.rotate((f.rot ?? 0) * big); g.scale(f.sx ?? 1, f.sy ?? 1); g.translate(-ox, -oy)
          g.drawImage(parts[i], 0, 0, W, H)
          g.restore()
        })
        // 선 위로 지나가는 빛(박자 동안만, 평소엔 아주 은은하게)
        const glow = b >= 0 ? hop(b) : 0
        if (glow > 0.02) {
          tmp.globalCompositeOperation = 'source-over'; tmp.clearRect(0, 0, W, H)
          const xc = -20 + ease(b) * (W + 40)
          const band = tmp.createLinearGradient(xc - 18, 0, xc + 18, 0)
          band.addColorStop(0, 'rgba(200,230,255,0)'); band.addColorStop(0.5, `rgba(230,245,255,${0.85 * glow})`); band.addColorStop(1, 'rgba(200,230,255,0)')
          tmp.fillStyle = band; tmp.fillRect(0, 0, W, 76)
          tmp.globalCompositeOperation = 'destination-in'; tmp.drawImage(lines, 0, 0, W, H)
          g.globalCompositeOperation = 'lighter'; g.drawImage(tc, 0, 0, W, H); g.globalCompositeOperation = 'source-over'
        }
        raf = requestAnimationFrame(frame)
      }
      raf = requestAnimationFrame(frame)
    }).catch(() => {})
    return () => { alive = false; cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, active, kind])
  return <canvas ref={ref} className="nav-live-icon" aria-hidden style={{ position: 'absolute', left: x, top: y, width: D.w, height: D.h, zIndex: z, pointerEvents: 'none' }} />
}
