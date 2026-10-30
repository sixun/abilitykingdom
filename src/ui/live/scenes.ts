// 로비 버튼 '장면' 움직임(버튼마다 직접 짠 짧은 연기).
// 그림은 원본을 4배로 키운 아틀라스(public/ui/live/<키>.webp, tools/build_live_atlas.py)에서 부위별로 꺼내 쓴다.
// 공통 원칙: 예비 동작(움츠림·젖힘) → 큰 동작 → 넘침 → 따라오는 동작 → 안착. 광택(빛 훑기)은 쓰지 않는다.
// 좌표는 화면 1배(원본 조각) 기준.

export type Xf = { dx?: number; dy?: number; rot?: number; sx?: number; sy?: number; ox?: number; oy?: number; alpha?: number }
export type Stage = {
  g: CanvasRenderingContext2D
  W: number; H: number
  /** 아틀라스 프레임 그리기('base' | 'plate' | 부위 이름) */
  draw: (name: string, xf?: Xf) => void
  box: (name: string) => [number, number, number, number]
  color: (name: string) => [number, number, number]
}
export type Scene = {
  beat: number // 연기 한 번 길이(초)
  offset: number // 버튼마다 엇갈리는 시작
  period?: number // 평소 반복 간격(없으면 평소엔 가만히)
  alertPeriod?: number // 알림 있을 때 반복 간격
  /** u: 연기 시작 후 초(연기 밖이면 -1), t: 전체 초, alert, big: 눌렀을 때 1.2 */
  play: (s: Stage, u: number, t: number, alert: boolean, big: number) => void
}

// ── 시간 곡선 ──
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const E = {
  lin: (x: number) => x,
  outCubic: (x: number) => 1 - (1 - x) ** 3,
  inCubic: (x: number) => x ** 3,
  inOut: (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  outBack: (x: number) => { const c = 1.9; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2 },
  outQuad: (x: number) => 1 - (1 - x) ** 2,
  inQuad: (x: number) => x * x,
}
type Key = [number, number, ((x: number) => number)?] // [시각(초), 값, 이 구간으로 들어올 때 곡선]
/** 키프레임 보간: 각 키의 곡선은 '이전 키 → 이 키' 구간에 쓴다 */
export function kf(u: number, keys: Key[]) {
  if (u <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e = E.inOut] = keys[i]
    const [t0, v0] = keys[i - 1]
    if (u <= t1) return v0 + (v1 - v0) * e(clamp((u - t0) / (t1 - t0 || 1)))
  }
  return keys[keys.length - 1][1]
}
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

// ── 알림 점(원본과 같은 색: 흰 테두리 + 주황빨강) ──
function badge(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, s: number) {
  g.save(); g.translate(cx, cy); g.scale(s, s)
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 2; g.shadowOffsetY = 0.6
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = '#f4f2ef'; g.fill()
  g.shadowColor = 'transparent'
  g.beginPath(); g.arc(0, 0, r * 0.78, 0, Math.PI * 2); g.fillStyle = '#fb6330'; g.fill()
  g.restore()
}

export const SCENES: Record<string, Scene> = {
  // ─ 공지: 종이 뒤로 젖혔다(예비) 크게 흔들리고, 추는 한 박자 늦게 더 크게 따라 흔들리며, 양옆으로 소리 물결이 퍼진다.
  //   알림이 있을 때만 3.6초마다(누르면 언제든). 알림 점은 첫 흔들림에 톡 튀었다 돌아온다.
  notice: {
    beat: 1.7, offset: 0, alertPeriod: 3.6,
    play(s, u, _t, alert, big) {
      const { g } = s
      const OX = 37.7, OY = 14.2
      const swing = (x: number) => (x < 0 ? 0 : Math.sin(x * Math.PI * 2 * 2.6) * 0.46 * Math.exp(-x * 2.4))
      const lean = kf(u, [[0, 0], [0.14, -0.16, E.outQuad], [0.2, 0, E.inQuad]])
      const bell = (lean + swing(u - 0.2)) * big
      const clap = (lean * 0.6 + swing(u - 0.27) * 1.45) * big
      if (u < 0) { s.draw('base') } else {
        s.draw('plate')
        // 추는 종 안쪽 뒤에 있으니 먼저
        s.draw('clapper', { rot: clap, ox: OX, oy: OY })
        s.draw('bell', { rot: bell, ox: OX, oy: OY })
        // 소리 물결: 흔들림 꼭짓점마다 그쪽으로 두 겹 호가 퍼진다
        const col = s.color('bell')
        for (const [t0, side] of [[0.3, 1], [0.49, -1], [0.68, 1], [0.87, -1]] as const) {
          const k = (u - t0) / 0.55
          if (k < 0 || k > 1) continue
          for (let j = 0; j < 2; j++) {
            const kk = clamp(k - j * 0.18)
            if (kk <= 0) continue
            const r = 15 + E.outCubic(kk) * 12 + j * 1
            g.beginPath(); g.arc(OX, 31, r, side > 0 ? -0.55 : Math.PI - 0.55, side > 0 ? 0.55 : Math.PI + 0.55)
            g.strokeStyle = rgba(col, (1 - kk) * 0.9 * (j ? 0.6 : 1)); g.lineWidth = 2.1 - kk * 1.1; g.lineCap = 'round'; g.stroke()
          }
        }
      }
      if (alert) badge(g, 51, 19.3, 9.2, 1 + kf(u, [[0.18, 0], [0.32, 0.32, E.outCubic], [0.62, 0, E.outBack]]))
    },
  },

  // ─ 우편: 봉투가 움츠렸다 튀어 오르고, 공중에서 뚜껑이 젖혀지며 편지가 쏙 올라왔다 들어간 뒤 뚜껑이 닫히고 내려앉는다.
  mail: {
    beat: 1.9, offset: 1.1, alertPeriod: 4.2,
    play(s, u, _t, _alert, big) {
      if (u < 0) { s.draw('base'); return }
      const { g } = s
      const [bx, by, bw, bh] = s.box('env')
      const cx = bx + bw / 2, bottom = by + bh
      const dy = kf(u, [[0.12, 0], [0.36, -7.5, E.outCubic], [1.3, -7.5], [1.52, 0, E.inCubic], [1.64, 1.2, E.outQuad], [1.8, 0, E.outBack]]) * big
      const sy = kf(u, [[0, 1], [0.12, 0.88, E.outQuad], [0.24, 1.07, E.outCubic], [0.42, 1], [1.5, 1.05], [1.58, 0.86, E.outQuad], [1.8, 1, E.outBack]])
      const sx = 2 - sy
      const flap = kf(u, [[0.34, 1], [0.6, -1, E.inOut], [1.2, -1], [1.42, 1, E.inOut]]) // 1 닫힘 → -1 활짝
      const letter = kf(u, [[0.48, 0], [0.8, 1, E.outBack], [1.08, 1], [1.28, 0, E.inCubic]])
      const hingeY = by + 2.4
      s.draw('plate')
      g.save()
      g.translate(cx, bottom + dy); g.scale(sx, sy); g.translate(-cx, -bottom)
      const inner: [number, number][] = [[bx + 2.6, hingeY + 0.4], [bx + bw - 2.6, hingeY + 0.4], [cx, by + 19.6]]
      // 열린 뚜껑(뒤집혀 봉투 위로 젖혀진 쪽)은 편지보다 뒤
      if (flap < 0) {
        g.save(); g.translate(0, hingeY); g.scale(1, flap); g.translate(0, -hingeY); s.draw('flap'); g.restore()
      }
      // 봉투 몸통
      s.draw('env')
      if (flap < 1) {
        // 뚜껑이 들린 만큼 안쪽(어두운 속) 보이기
        const col = s.color('env')
        g.save(); g.beginPath(); inner.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath()
        g.fillStyle = rgba(col.map((v) => v * 0.52), clamp((1 - flap) * 0.9)); g.fill(); g.restore()
      }
      if (letter > 0.001) {
        // 편지: 봉투 속(안쪽 삼각형)과 봉투 위쪽에서만 보이게 잘라서
        g.save(); g.beginPath()
        g.moveTo(bx - 4, -10); g.lineTo(bx + bw + 4, -10); g.lineTo(bx + bw + 4, hingeY + 0.4); inner.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.lineTo(x, y))); g.lineTo(bx - 4, hingeY + 0.4); g.closePath(); g.clip()
        const lw = 24, lh = 19, ly = by + 15 - letter * 15.5
        g.translate(cx, ly + lh / 2); g.rotate(kf(u, [[0.8, 0], [0.9, -0.06, E.outQuad], [1.0, 0.04], [1.08, 0]])); g.translate(-cx, -(ly + lh / 2))
        g.beginPath(); g.roundRect(cx - lw / 2, ly, lw, lh, 1.6)
        g.fillStyle = '#f5f6f8'; g.fill(); g.strokeStyle = 'rgba(18,20,26,.9)'; g.lineWidth = 1.3; g.stroke()
        g.strokeStyle = '#a3a9b4'; g.lineWidth = 1.4; g.lineCap = 'round'
        for (const [x0, x1, yy] of [[-8, 6, 5], [-8, 8, 9], [-8, 3, 13]]) { g.beginPath(); g.moveTo(cx + x0, ly + yy); g.lineTo(cx + x1, ly + yy); g.stroke() }
        g.restore()
      }
      // 닫혀 있는(또는 닫히는 중) 뚜껑은 맨 앞
      if (flap >= 0) { g.save(); g.translate(0, hingeY); g.scale(1, Math.max(0.02, flap)); g.translate(0, -hingeY); s.draw('flap'); g.restore() }
      g.restore()
    },
  },

  // ─ 도시 탐색(늘 움직이는 핵심): 핀이 움츠렸다 높이 떠오르고(그림자 작아짐) 잠깐 머문 뒤 떨어져 납작해지고,
  //   지도에 파문이 두 겹 번지며 네 귀퉁이 표시가 안으로 조였다 풀린다(위치 고정).
  exploration: {
    beat: 1.55, offset: 0.4, period: 3.8,
    play(s, u, _t, _alert, big) {
      if (u < 0) { s.draw('base'); return }
      const { g } = s
      const TX = 69.6, TY = 111 // 핀 끝(지도에 닿는 점)
      const h = kf(u, [[0.14, 0], [0.5, -17, E.outCubic], [0.66, -17.6], [0.86, 0, E.inCubic], [1.0, -3.4, E.outQuad], [1.14, 0, E.inQuad], [1.24, -0.8, E.outQuad], [1.32, 0, E.inQuad]]) * big
      const sy = kf(u, [[0, 1], [0.14, 0.84, E.outQuad], [0.3, 1.1, E.outCubic], [0.55, 1], [0.8, 1.08], [0.88, 0.78, E.outQuad], [1.02, 1.04, E.outCubic], [1.18, 1, E.inOut]])
      const sx = 1 + (1 - sy) * 0.85
      const wob = kf(u, [[0.5, 0], [0.58, 0.07], [0.66, -0.05], [0.74, 0]])
      s.draw('plate')
      // 그림자: 높이 뜰수록 작고 옅게
      const lift = clamp(-h / 17)
      g.save(); g.beginPath(); g.ellipse(TX - 1, TY - 0.5, 8.5 * (1 - lift * 0.55) * sx, 2.6 * (1 - lift * 0.55), 0, 0, Math.PI * 2)
      g.fillStyle = `rgba(30,33,40,${0.32 * (1 - lift * 0.6)})`; g.fill(); g.restore()
      // 파문: 땅에 닿는 순간부터 두 겹
      for (const t0 of [0.86, 1.0]) {
        const k = (u - t0) / 0.6
        if (k < 0 || k > 1) continue
        const r = 5 + E.outCubic(k) * 30
        g.beginPath(); g.ellipse(TX - 1, TY - 1, r, r * 0.46, 0, 0, Math.PI * 2)
        g.strokeStyle = `rgba(40,43,50,${(1 - k) * 0.75})`; g.lineWidth = 2 - k * 1.2; g.stroke()
      }
      // 귀퉁이 표시: 착지 때 안으로 조였다 넘쳐 돌아옴
      const lock = kf(u, [[0.86, 0], [0.98, 1, E.outCubic], [1.3, 0, E.outBack]])
      const C = [70, 93]
      for (const c of ['c0', 'c1', 'c2', 'c3']) {
        const [x, y, w, hh] = s.box(c); const mx = x + w / 2, my = y + hh / 2
        const d = Math.hypot(C[0] - mx, C[1] - my)
        s.draw(c, { dx: ((C[0] - mx) / d) * 4 * lock, dy: ((C[1] - my) / d) * 4 * lock })
      }
      s.draw('pin', { dy: h, sx, sy, rot: wob, ox: TX, oy: TY })
    },
  },

  // ─ 현상수배: 조준경이 이리저리 표적을 찾다가 가운데에 탁 걸리며(넘침) 45°씩 돌아 잠기고,
  //   잠기는 순간 바깥 원이 퍼지고 가운데 점이 번쩍인다.
  wanted: {
    beat: 1.75, offset: 3.7, period: 7.5,
    play(s, u, _t, _alert, big) {
      if (u < 0) { s.draw('base'); return }
      const { g } = s
      const CX = 39.6, CY = 47.6
      const amp = kf(u, [[0, 0], [0.12, 1, E.outQuad], [0.5, 1], [0.62, 0, E.inQuad]])
      const dx = (Math.sin(u * 13.5) * 4.2 + Math.sin(u * 6.1) * 1.6) * amp * big
      const dy = (Math.sin(u * 9.3 + 1.2) * 3.0) * amp * big
      const snap = kf(u, [[0.58, 0], [0.72, 1, E.outBack]]) // 걸림
      const rot = kf(u, [[0.6, 0], [0.86, Math.PI / 4, E.outBack], [1.2, Math.PI / 4], [1.45, Math.PI / 2, E.inOut]])
      const punch = 1 + kf(u, [[0.6, 0], [0.7, -0.14, E.outQuad], [0.9, 0.06, E.outCubic], [1.1, 0, E.inOut]])
      s.draw('plate')
      s.draw('scope', { dx: dx * (1 - snap), dy: dy * (1 - snap), rot, sx: punch, sy: punch, ox: CX, oy: CY })
      const col = s.color('scope')
      const k = (u - 0.7) / 0.5
      if (k > 0 && k < 1) {
        for (let j = 0; j < 2; j++) {
          const kk = clamp(k - j * 0.2)
          if (kk <= 0) continue
          g.beginPath(); g.arc(CX, CY, 21 + E.outCubic(kk) * 13, 0, Math.PI * 2)
          g.strokeStyle = rgba(col, (1 - kk) * (j ? 0.45 : 0.85)); g.lineWidth = 2.6 * (1 - kk) + 0.4; g.stroke()
        }
      }
      const fl = kf(u, [[0.68, 0], [0.74, 1, E.outQuad], [1.0, 0, E.inQuad]])
      if (fl > 0.01) {
        const rg = g.createRadialGradient(CX, CY, 0, CX, CY, 9)
        rg.addColorStop(0, `rgba(255,255,255,${fl})`); rg.addColorStop(0.35, rgba(col, fl * 0.8)); rg.addColorStop(1, rgba(col, 0))
        g.fillStyle = rg; g.beginPath(); g.arc(CX, CY, 9, 0, Math.PI * 2); g.fill()
      }
    },
  },
}
