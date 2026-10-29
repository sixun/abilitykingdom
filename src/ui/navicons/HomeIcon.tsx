import { useEffect, useRef } from 'react'
import { useReduceMotion, useScreenActive } from '../motion'

// 하단 메뉴 '홈' 아이콘: 원본 그림을 그대로 쓰고 그 그림 자체가 움직인다.
// 원본 조각(112×134)을 AI로 4배 선명하게 키운 뒤 3배 크기로 둔 것(public/ui/nav/home.webp, 원본 tools/navicons/)
// - 보석 그물 선을 따라 빛 물결이 위에서 아래로 훑고 지나간다(선 마스크 home-lines.webp 안에서만 빛남)
// - 몇 초마다 삼각형 테두리를 따라 빛 한 줄기가 한 바퀴 돈다
// - 보석 선 전체가 숨 쉬듯 은은하게 밝아졌다 어두워지고, 위쪽 '선택됨' 막대도 같이 숨 쉰다
// 동작 줄이기·화면 비활성 때는 원본 그대로 한 장면만 그린다.
const W = 112, H = 134
const TRI: [number, number][] = [[20, 23], [94.7, 23], [56.7, 88]] // 원본에서 잰 삼각형 꼭짓점
const BASE = 'ui/nav/home.webp', LINES = 'ui/nav/home-lines.webp'

const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })

function draw(g: CanvasRenderingContext2D, tmp: CanvasRenderingContext2D, base: HTMLImageElement, lines: HTMLImageElement, t: number) {
  g.clearRect(0, 0, W, H)
  g.globalCompositeOperation = 'source-over'
  g.drawImage(base, 0, 0, W, H)

  // 빛 물결: 임시 캔버스에 띠를 그리고 선 마스크로 잘라 원본 위에 더한다
  const cyc = 3.2, k = (t % cyc) / cyc
  const breathe = 0.18 + 0.12 * Math.sin(t * 1.7)
  tmp.globalCompositeOperation = 'source-over'
  tmp.clearRect(0, 0, W, H)
  tmp.fillStyle = `rgba(200,225,255,${breathe})`; tmp.fillRect(0, 0, W, H)
  const yc = -20 + k * 130
  const band = tmp.createLinearGradient(0, yc - 16, 0, yc + 16)
  band.addColorStop(0, 'rgba(190,225,255,0)'); band.addColorStop(0.5, 'rgba(225,240,255,0.95)'); band.addColorStop(1, 'rgba(190,225,255,0)')
  tmp.fillStyle = band; tmp.fillRect(0, yc - 16, W, 32)
  tmp.globalCompositeOperation = 'destination-in'
  tmp.drawImage(lines, 0, 0, W, H)
  g.globalCompositeOperation = 'lighter'
  g.drawImage(tmp.canvas, 0, 0, W, H)

  // 선택됨 막대 숨쉬기(원본 막대 위에 빛을 더한다)
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.7)
  g.fillStyle = `rgba(255,255,255,${0.25 * pulse})`; g.fillRect(12, 3.5, 90, 4)
  g.globalCompositeOperation = 'source-over'

  // 삼각형 테두리를 따라 도는 빛
  const per = Math.hypot(TRI[1][0] - TRI[0][0], TRI[1][1] - TRI[0][1]) + Math.hypot(TRI[2][0] - TRI[1][0], TRI[2][1] - TRI[1][1]) + Math.hypot(TRI[0][0] - TRI[2][0], TRI[0][1] - TRI[2][1])
  const cyc2 = 4.2, k2 = (t % cyc2) / cyc2
  if (k2 < 0.5) {
    g.save()
    g.beginPath(); g.moveTo(...TRI[0]); g.lineTo(...TRI[1]); g.lineTo(...TRI[2]); g.closePath()
    g.setLineDash([14, per]); g.lineDashOffset = -(k2 / 0.5) * per
    g.strokeStyle = 'rgba(205,232,255,1)'; g.lineWidth = 2.4; g.lineCap = 'round'
    g.shadowColor = 'rgba(150,205,255,1)'; g.shadowBlur = 8
    g.globalCompositeOperation = 'lighter'; g.stroke(); g.restore()
  }
}

export function HomeIcon({ x, y, z = 2 }: { x: number; y: number; z?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReduceMotion()
  const active = useScreenActive()
  useEffect(() => {
    const c = ref.current; if (!c) return
    const dpr = Math.min(3, (window.devicePixelRatio || 1) * 1.5)
    c.width = W * dpr; c.height = H * dpr
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const tc = document.createElement('canvas'); tc.width = W * dpr; tc.height = H * dpr
    const tmp = tc.getContext('2d')!; tmp.setTransform(dpr, 0, 0, dpr, 0, 0)
    let raf = 0, alive = true
    Promise.all([load(BASE), load(LINES)]).then(([base, lines]) => {
      if (!alive) return
      if (reduce || !active) { g.drawImage(base, 0, 0, W, H); return }
      const t0 = performance.now()
      const f = (now: number) => { draw(g, tmp, base, lines, (now - t0) / 1000); raf = requestAnimationFrame(f) }
      raf = requestAnimationFrame(f)
    }).catch(() => {})
    return () => { alive = false; cancelAnimationFrame(raf) }
  }, [reduce, active])
  return <canvas ref={ref} className="nav-live-icon" aria-hidden style={{ position: 'absolute', left: x, top: y, width: W, height: H, zIndex: z, pointerEvents: 'none' }} />
}
