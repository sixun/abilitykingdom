import { useEffect, useRef } from 'react'
import { useReduceMotion, useScreenActive } from '../motion'

// 하단 메뉴 '홈' 아이콘을 그림 대신 코드로 다시 그린다(그림 자체가 움직이는 아이콘).
// - 역삼각형 안의 와이어 구체가 실제 3D로 천천히 돈다(앞쪽 선은 밝게, 뒤쪽 선은 흐리게)
// - 삼각형 테두리를 따라 빛 한 줄기가 몇 초마다 한 바퀴 흐른다
// - 위쪽 '선택됨' 막대는 은은하게 숨 쉰다
// 크기·위치는 원본 조각(112×134)과 같다. 동작 줄이기·화면 비활성 때는 멈춘 한 장면만 그린다.
const W = 112, H = 134

type V3 = [number, number, number]
// 정이십면체를 한 번 쪼갠 측지 구(꼭짓점 42, 선 120): 원본의 그물 구체 느낌
function geodesic(): { v: V3[]; e: [number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2
  const v: V3[] = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
  let f: [number, number, number][] = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]
  const norm = (p: V3): V3 => { const l = Math.hypot(...p); return [p[0] / l, p[1] / l, p[2] / l] }
  for (let i = 0; i < v.length; i++) v[i] = norm(v[i])
  const mid = new Map<string, number>()
  const m = (a: number, b: number) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`
    if (!mid.has(k)) { v.push(norm([(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2])); mid.set(k, v.length - 1) }
    return mid.get(k)!
  }
  const nf: typeof f = []
  for (const [a, b, c] of f) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]) }
  f = nf
  const es = new Set<string>(); const e: [number, number][] = []
  for (const [a, b, c] of f) for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = x < y ? `${x}_${y}` : `${y}_${x}`; if (!es.has(k)) { es.add(k); e.push([x, y]) } }
  return { v, e }
}
const G = geodesic()
// 원본 그림 기준 좌표
const TRI: [number, number][] = [[20, 22], [95, 22], [57.5, 88]]
const SC = { x: 57.5, y: 39, r: 28 }

function draw(g: CanvasRenderingContext2D, t: number) {
  g.clearRect(0, 0, W, H)
  // 선택됨 막대
  const pulse = 0.75 + 0.25 * Math.sin(t * 1.6)
  g.save(); g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = 6 * pulse
  g.fillStyle = `rgba(255,255,255,${0.85 * pulse + 0.1})`; g.fillRect(14, 4.5, 86, 2.2); g.restore()

  // 역삼각형: 어두운 유리 채움
  const tri = () => { g.beginPath(); g.moveTo(...TRI[0]); g.lineTo(...TRI[1]); g.lineTo(...TRI[2]); g.closePath() }
  const fill = g.createLinearGradient(0, 22, 0, 88); fill.addColorStop(0, 'rgba(90,92,100,0.92)'); fill.addColorStop(1, 'rgba(14,15,20,0.95)')
  tri(); g.fillStyle = fill; g.fill()

  // 구체: 기울어진 축으로 회전
  const a = t * 0.42, tilt = 0.42
  const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(tilt), st = Math.sin(tilt)
  const P = G.v.map(([x, y, z]) => {
    const x1 = x * ca + z * sa, z1 = -x * sa + z * ca
    const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct
    return [SC.x + x1 * SC.r, SC.y + y2 * SC.r, z2] as V3
  })
  // 구체 안쪽 어둠(뒤쪽 선이 비쳐 보이는 깊이감)
  const rg = g.createRadialGradient(SC.x - 8, SC.y - 10, 4, SC.x, SC.y, SC.r)
  rg.addColorStop(0, 'rgba(120,124,135,0.35)'); rg.addColorStop(1, 'rgba(10,10,14,0.55)')
  g.beginPath(); g.arc(SC.x, SC.y, SC.r, 0, Math.PI * 2); g.fillStyle = rg; g.fill()

  const edges = G.e.map(([i, j]) => ({ i, j, z: (P[i][2] + P[j][2]) / 2 })).sort((p, q) => p.z - q.z)
  g.lineCap = 'round'
  for (const { i, j, z } of edges) {
    const front = (z + 1) / 2 // 0 = 맨 뒤, 1 = 맨 앞
    g.strokeStyle = `rgba(255,255,255,${0.06 + front * front * 0.72})`
    g.lineWidth = 0.45 + front * 0.75
    if (front > 0.7) { g.shadowColor = 'rgba(220,235,255,0.9)'; g.shadowBlur = 3 } else g.shadowBlur = 0
    g.beginPath(); g.moveTo(P[i][0], P[i][1]); g.lineTo(P[j][0], P[j][1]); g.stroke()
  }
  g.shadowBlur = 0

  // 삼각형 테두리 + 따라 흐르는 빛
  tri(); g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.6; g.stroke()
  const per = 75 + 2 * Math.hypot(37.5, 66) // 둘레
  const cyc = 3.6, k = (t % cyc) / cyc
  if (k < 0.55) {
    const head = (k / 0.55) * per
    g.save(); tri(); g.setLineDash([16, per]); g.lineDashOffset = -head
    g.strokeStyle = 'rgba(200,230,255,1)'; g.lineWidth = 2.6; g.shadowColor = 'rgba(160,210,255,1)'; g.shadowBlur = 8; g.stroke(); g.restore()
  }

  // 글자
  g.font = '900 19px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif'
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'
  g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 4
  g.fillText('홈', 57.5, 110); g.shadowBlur = 0
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
    if (reduce || !active) { draw(g, 1.2); return }
    let raf = 0; const t0 = performance.now()
    const f = (now: number) => { draw(g, (now - t0) / 1000); raf = requestAnimationFrame(f) }
    raf = requestAnimationFrame(f)
    document.fonts?.ready.then(() => draw(g, (performance.now() - t0) / 1000)).catch(() => {})
    return () => cancelAnimationFrame(raf)
  }, [reduce, active])
  return <canvas ref={ref} className="nav-live-icon" aria-hidden style={{ position: 'absolute', left: x, top: y, width: W, height: H, zIndex: z, pointerEvents: 'none' }} />
}
