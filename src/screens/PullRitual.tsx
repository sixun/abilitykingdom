import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPE, type ReactNode } from 'react'
import '../styles/pull.css'
import { audio } from '../app/audio'
import type { RecruitmentTransaction, RecruitResultEntry } from '../game/types'
import { CHAR_BY_ID } from '../game/data/characters'
import { RefStage } from '../ui/ref'
import { useReduceMotion } from '../ui/motion'
import { Stars } from '../ui/components'
import propsJson from '../game/data/pull-props.json'

// 직접 조작하는 영입 연출(스토리보드 4종). 영입 결과는 이미 확정·저장된 뒤에 시작한다 —
// 연출 중 닫거나 건너뛰어도 결과·재화는 바뀌지 않는다. 좌표는 1672×941 캔버스.
//  - pack(주파수 너머): 절취선 당기기 → 카드 위로 꺼내기 → 옆으로 넘겨 뒤집기
//  - capsule(SERENITY): 손잡이 한 바퀴 돌리기 → 캡슐 윗부분 밀어 열기 → 접힌 카드 펼치기
//  - lottery(NIGHT SHIFT): 핸들 두 바퀴 돌리기(놓으면 관성으로 돌다 멈춤) → 공 배출 → 공 눌러 결과
//  - kuji(ONE MORE PLAY?): 상자에서 한 장 고르기 → 모서리 잡고 종이 벗기기 → 눌러 공개
export type RitualKind = 'pack' | 'capsule' | 'lottery' | 'kuji'
type P = { file: string; w: number; h: number }
const PR = propsJson as unknown as {
  pack: { body: string; strip: string; w: number; h: number; tearY: number }
  capsule: P & { knob: { file: string; c: number[]; r: number }; chute: number[] }
  lottery: { drum: string; stand: string; crank: string; w: number; h: number; axle: number[]; exit: number[]; tray: number[] }
  kujibox: P & { open: number[] }
  ticket: P
}
const CW = 1672, CH = 941
const TIER_LABEL: Record<number, string> = { 3: '일반 영입', 4: '희귀 영입', 5: '최고 등급' }
const TIER_COLOR: Record<number, string> = { 3: '#e3e9f4', 4: '#8fb0ff', 5: '#ffd36a' }
const STEPS: Record<RitualKind, { t: string; h: string }[]> = {
  pack: [{ t: '개봉 시작', h: '' }, { t: '절취선 당기기', h: '절취선을 오른쪽에서 왼쪽으로 쭉 당기세요' }, { t: '카드 꺼내기', h: '카드를 위로 끌어 꺼내세요' }, { t: '카드 뒤집기', h: '카드를 옆으로 넘겨 뒤집으세요' }],
  capsule: [{ t: '뽑기 시작', h: '' }, { t: '손잡이 회전', h: '손잡이를 잡고 시계 방향으로 한 바퀴 돌리세요' }, { t: '캡슐 개봉', h: '캡슐 윗부분을 위로 밀어 여세요' }, { t: '결과 펼치기', h: '접힌 카드를 위로 펼치세요' }],
  lottery: [{ t: '추첨 시작', h: '' }, { t: '핸들 회전', h: '핸들을 잡고 시계 방향으로 두 바퀴 돌리세요' }, { t: '회전 후 감속', h: '' }, { t: '공 배출', h: '나온 공을 눌러 확인하세요' }],
  kuji: [{ t: '추첨함으로', h: '' }, { t: '한 장 뽑기', h: '상자에서 쿠지 한 장을 고르세요' }, { t: '종이 벗기기', h: '오른쪽 아래 모서리를 잡고 종이를 벗기세요' }, { t: '결과 확인', h: '눌러서 결과를 공개하세요' }],
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const ease = (k: number) => 1 - Math.pow(1 - k, 3)
/** rAF 보간. 반환값으로 취소 */
function tween(from: number, to: number, ms: number, on: (v: number) => void, done?: () => void, e = ease) {
  let raf = 0; const t0 = performance.now()
  const f = (t: number) => { const k = Math.min(1, (t - t0) / ms); on(from + (to - from) * e(k)); if (k < 1) raf = requestAnimationFrame(f); else done?.() }
  raf = requestAnimationFrame(f)
  return () => cancelAnimationFrame(raf)
}
/** 화면 좌표 → 캔버스 좌표 */
function useCanvasPoint() {
  const ref = useRef<HTMLDivElement>(null)
  const pt = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect(); const s = r.width / CW
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }
  }
  return { ref, pt }
}
type Ctx = { tier: number; front: ReactNode; setStep: (n: number) => void; reveal: () => void; pt: (e: { clientX: number; clientY: number }) => { x: number; y: number }; reduce: boolean }

/** 결과 카드 앞면(캐릭터 그림) */
export function CardFront({ r }: { r: RecruitResultEntry }) {
  const c = CHAR_BY_ID[r.characterId]
  return (
    <div className={`pr-front t${Math.min(5, Math.max(3, r.rarity))}`} style={{ '--a': c.accent } as CSSProperties}>
      <div className="art"><img src={c.assets.stand} alt="" draggable={false} /></div>
      <div className="cap"><Stars n={r.rarity} /><b>{c.name}</b></div>
      {r.isNew && <span className="new">NEW</span>}
    </div>
  )
}
function CardBack() {
  return (
    <div className="pr-back"><svg viewBox="0 0 64 48" aria-hidden><path d="M6 40 2 10l16 13L32 4l14 19 16-13-4 30Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" /><rect x="8" y="42" width="48" height="4" rx="1" fill="currentColor" /></svg></div>
  )
}
/** 손짓 안내(점선 화살표). 조작을 시작하면 사라진다 */
function Hint({ d, x, y, w = 200, h = 120, show }: { d: string; x: number; y: number; w?: number; h?: number; show: boolean }) {
  return show ? <svg className="pr-hint" viewBox={`0 0 ${w} ${h}`} style={{ left: x, top: y, width: w, height: h }} aria-hidden><path d={d} /><circle r="9" className="dot"><animateMotion dur="1.6s" repeatCount="indefinite" path={d} /></circle></svg> : null
}

/* ───────────── 카드팩 ───────────── */
function PackRitual({ tier, front, setStep, reveal, pt, reduce }: Ctx) {
  const P = PR.pack; const H = 640; const s = H / P.h; const W = P.w * s; const X = CW / 2 - W / 2, Y = 170
  const tearY = P.tearY * s
  const cw = W * 0.8, ch = cw * 1.4
  const [phase, setPhase] = useState<'enter' | 'tear' | 'draw' | 'flip'>('enter')
  const [t, setT] = useState(0), [dy, setDy] = useState(0), [ang, setAng] = useState(0)
  const [fly, setFly] = useState(false), [touched, setTouched] = useState(false), [peek, setPeek] = useState(false)
  const g = useRef({ x: 0, y: 0, v: 0, moved: false, flipped: false })
  useEffect(() => { const id = setTimeout(() => { setPhase('tear'); setStep(1) }, reduce ? 50 : 950); return () => clearTimeout(id) }, [])
  const finishTear = () => {
    tween(t, 1, 260, setT, () => { setFly(true); audio.sfx('slash'); setTimeout(() => { setPhase('draw'); setStep(2); setTouched(false); setTimeout(() => setPeek(true), 60) }, 520) })
  }
  const down = (e: RPE) => { (e.target as Element).setPointerCapture(e.pointerId); const p = pt(e); g.current = { ...g.current, x: p.x, y: p.y, v: phase === 'tear' ? t : phase === 'draw' ? dy : ang, moved: false }; setTouched(true) }
  const move = (e: RPE) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const p = pt(e); const dx = p.x - g.current.x, dyy = p.y - g.current.y
    if (Math.abs(dx) + Math.abs(dyy) > 6) g.current.moved = true
    if (phase === 'tear') { const v = clamp(g.current.v + -dx / (W * 0.9), 0, 1); if (Math.floor(v * 8) !== Math.floor(t * 8)) audio.sfx('tap'); setT(v) }
    if (phase === 'draw') setDy(clamp(g.current.v - dyy, 0, ch * 1.05))
    if (phase === 'flip') { const a = clamp(g.current.v + dx * 0.55, -180, 180); if (!g.current.flipped && Math.abs(a) > 90) { g.current.flipped = true; audio.sfx(tier >= 5 ? 'reveal5' : 'reveal') } setAng(a) }
  }
  const up = () => {
    const tap = !g.current.moved
    if (phase === 'tear') { if (t > 0.55 || tap) finishTear(); else tween(t, 0, 300, setT) }
    if (phase === 'draw') {
      if (dy > ch * 0.38 || tap) { audio.sfx('whoosh'); tween(dy, ch + 60, 380, setDy, () => { setPhase('flip'); setStep(3); setTouched(false) }) }
      else tween(dy, 0, 320, setDy)
    }
    if (phase === 'flip') {
      if (Math.abs(ang) > 70 || tap) {
        const to = ang < 0 ? -180 : 180
        if (!g.current.flipped) { g.current.flipped = true; audio.sfx(tier >= 5 ? 'reveal5' : 'reveal') }
        tween(ang, to, 420, setAng, () => setTimeout(reveal, 650))
      } else tween(ang, 0, 320, setAng)
    }
  }
  const Xt = W * (1 - t)
  const flip = phase === 'flip'
  return (
    <div className={`pk ${phase}`} style={{ '--tier': TIER_COLOR[tier] } as CSSProperties}>
      <div className="pk-pack" style={{ left: X, top: Y, width: W, height: H }}>
        {/* 카드: 팩 몸통 뒤에서 위로 나온다 */}
        {!flip && (phase === 'draw') && (
          <div className={`pk-card-in ${peek ? 'peek' : ''}`} style={{ left: (W - cw) / 2, top: tearY - (peek ? 54 : 0) - dy, width: cw, height: ch }}><CardBack /></div>
        )}
        <i className="pk-light" style={{ left: W * 0.08, width: W * 0.84, top: tearY - 30, opacity: phase === 'draw' ? 0.55 + (dy / ch) * 0.45 : t * 0.7 }} />
        <img className="pk-body" src={P.body} alt="" draggable={false} />
        {!fly && <>
          <img className="pk-strip" src={P.strip} alt="" draggable={false} style={{ clipPath: `inset(0 ${W - Xt}px 0 0)` }} />
          <img className="pk-strip torn" src={P.strip} alt="" draggable={false} style={{ clipPath: `inset(0 0 0 ${Xt}px)`, transformOrigin: `${Xt}px ${tearY}px`, transform: `rotate(${-t * 30}deg) translateY(${-t * 14}px)` }} />
          {t > 0.02 && t < 1 && <i className="pk-tearpt" style={{ left: Xt, top: tearY }} />}
        </>}
        {fly && <img className="pk-strip fly" src={P.strip} alt="" draggable={false} />}
      </div>
      {phase === 'tear' && <button type="button" className="pr-zone" aria-label="절취선 당기기" style={{ left: X - 40, top: Y - 30, width: W + 80, height: tearY + 140 }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finishTear() } }} />}
      {phase === 'draw' && <button type="button" className="pr-zone" aria-label="카드 꺼내기" style={{ left: X, top: Y - ch, width: W, height: ch + H * 0.6 }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onKeyDown={(e) => { if (e.key === 'Enter') { g.current.moved = false; up() } }} />}
      <Hint show={phase === 'tear' && !touched} d="M190 40 C140 40 60 40 10 40" x={X + W - 170} y={Y + tearY - 70} />
      <Hint show={phase === 'draw' && !touched} d="M60 150 C60 110 60 60 60 10" x={X + W + 10} y={Y - 30} w={120} h={170} />
      {/* 뒤집기: 화면 가운데에서 크게 */}
      {flip && (
        <div className="pk-flipwrap" style={{ left: CW / 2 - (cw * 1.3) / 2, top: 200, width: cw * 1.3, height: ch * 1.3 }}>
          <div className="pr-flip" style={{ transform: `perspective(1600px) rotateY(${ang}deg)` }}>
            <div className="face back"><CardBack /></div>
            <div className="face front">{front}</div>
          </div>
          <button type="button" className="pr-zone" aria-label="카드 뒤집기" style={{ left: -120, top: 0, width: cw * 1.3 + 240, height: ch * 1.3 }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onKeyDown={(e) => { if (e.key === 'Enter') { g.current.moved = false; up() } }} />
          <Hint show={!touched} d="M20 60 C70 10 130 10 180 60" x={(cw * 1.3) / 2 - 100} y={ch * 1.3 + 14} />
        </div>
      )}
    </div>
  )
}

/* ───────────── 캡슐 가차 ───────────── */
function CapsuleRitual({ tier, front, setStep, reveal, pt, reduce }: Ctx) {
  const P = PR.capsule; const H = 660; const s = H / P.h; const W = P.w * s; const X = CW / 2 - W / 2, Y = 175
  const kc = { x: X + P.knob.c[0] * s, y: Y + P.knob.c[1] * s }, kr = P.knob.r * s
  const chute = { x: X + ((P.chute[0] + P.chute[2]) / 2) * s, y: Y + P.chute[3] * s }
  const [phase, setPhase] = useState<'enter' | 'turn' | 'drop' | 'open' | 'unfold'>('enter')
  const [acc, setAcc] = useState(0), [lift, setLift] = useState(0), [fold, setFold] = useState(180)
  const [touched, setTouched] = useState(false), [topOff, setTopOff] = useState(false)
  const g = useRef({ a: 0, x: 0, y: 0, v: 0, moved: false, q: 0 })
  useEffect(() => { const id = setTimeout(() => { setPhase('turn'); setStep(1) }, reduce ? 50 : 950); return () => clearTimeout(id) }, [])
  const dropped = () => { setPhase('drop'); audio.sfx('open'); setStep(2); setTimeout(() => { setPhase('open'); setTouched(false) }, reduce ? 50 : 1500) }
  const down = (e: RPE) => {
    (e.target as Element).setPointerCapture(e.pointerId); const p = pt(e)
    g.current = { ...g.current, a: Math.atan2(p.y - kc.y, p.x - kc.x), x: p.x, y: p.y, v: phase === 'open' ? lift : fold, moved: false }; setTouched(true)
  }
  const move = (e: RPE) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const p = pt(e)
    if (Math.abs(p.x - g.current.x) + Math.abs(p.y - g.current.y) > 6) g.current.moved = true
    if (phase === 'turn') {
      const a = Math.atan2(p.y - kc.y, p.x - kc.x); let d = ((a - g.current.a) * 180) / Math.PI; g.current.a = a
      if (d > 180) d -= 360; if (d < -180) d += 360
      if (d <= 0) return
      const n = Math.min(360, acc + d)
      if (Math.floor(n / 90) > g.current.q) { g.current.q = Math.floor(n / 90); audio.sfx('tap') }
      setAcc(n)
      if (n >= 360) { (e.target as Element).releasePointerCapture(e.pointerId); dropped() }
    }
    if (phase === 'open') setLift(clamp(g.current.v + (g.current.y - p.y), 0, 220))
    if (phase === 'unfold') setFold(clamp(g.current.v - (g.current.y - p.y) * 1.3, 0, 180))
  }
  const up = () => {
    const tap = !g.current.moved
    if (phase === 'turn' && tap && acc < 360) tween(acc, 360, 900, (v) => { if (Math.floor(v / 90) > g.current.q) { g.current.q = Math.floor(v / 90); audio.sfx('tap') } setAcc(v) }, dropped)
    if (phase === 'open') {
      if (lift > 70 || tap) { audio.sfx('open'); setTopOff(true); setTimeout(() => { setPhase('unfold'); setStep(3); setTouched(false) }, reduce ? 50 : 900) }
      else tween(lift, 0, 280, setLift)
    }
    if (phase === 'unfold') {
      if (fold < 100 || tap) { audio.sfx(tier >= 5 ? 'reveal5' : 'reveal'); tween(fold, 0, 360, setFold, () => setTimeout(reveal, 450)) }
      else tween(fold, 180, 300, setFold)
    }
  }
  const capD = 280
  const fw = 300, fh = 420
  return (
    <div className={`cp ${phase}`} style={{ '--tier': TIER_COLOR[tier] } as CSSProperties}>
      <div className="cp-machine" style={{ left: X, top: Y, width: W, height: H }}>
        <img src={P.file} alt="" draggable={false} className="body" />
        <span className="cp-knob" style={{ left: kc.x - X - kr, top: kc.y - Y - kr, width: kr * 2, height: kr * 2, transform: `rotate(${acc}deg)` }}><img src={P.knob.file} alt="" draggable={false} /></span>
        <svg className="cp-ring" viewBox="0 0 100 100" style={{ left: kc.x - X - kr - 22, top: kc.y - Y - kr - 22, width: kr * 2 + 44, height: kr * 2 + 44 }} aria-hidden>
          <circle cx="50" cy="50" r="47" className="track" /><circle cx="50" cy="50" r="47" className="fill" style={{ strokeDasharray: `${(acc / 360) * 295.3} 400` }} />
        </svg>
      </div>
      {phase === 'turn' && <button type="button" className="pr-zone round" aria-label="손잡이 돌리기" style={{ left: kc.x - kr - 60, top: kc.y - kr - 60, width: kr * 2 + 120, height: kr * 2 + 120 }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); g.current.moved = false; up() } }} />}
      <Hint show={phase === 'turn' && !touched} d="M30 100 A80 80 0 0 1 170 100" x={kc.x - 100} y={kc.y - kr - 120} w={200} h={110} />
      {(phase === 'drop' || phase === 'open') && (
        <div className={`cp-capsule ${phase} ${topOff ? 'opened' : ''}`} style={{ '--sx': `${chute.x - CW / 2}px`, '--sy': `${chute.y - 470}px`, left: CW / 2 - capD / 2, top: 470 - capD / 2, width: capD, height: capD } as CSSProperties}>
          <i className="glow" />
          <i className="bot" />
          <i className="top" style={{ transform: topOff ? undefined : `translateY(${-lift}px) rotate(${-lift * 0.1}deg)` }} />
          {phase === 'open' && <button type="button" className="pr-zone" aria-label="캡슐 열기" style={{ left: -60, top: -80, width: capD + 120, height: capD + 140 }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onKeyDown={(e) => { if (e.key === 'Enter') { g.current.moved = false; up() } }} />}
          <Hint show={phase === 'open' && !touched && !topOff} d="M50 150 C50 110 50 60 50 10" x={capD + 10} y={-20} w={100} h={170} />
        </div>
      )}
      {phase === 'unfold' && (
        <div className="cp-fold" style={{ left: CW / 2 - fw / 2, top: 470 - fh / 2, width: fw, height: fh }}>
          <div className="half bottom">{front}</div>
          <div className="flap" style={{ transform: `perspective(1200px) rotateX(${-fold}deg)` }}>
            <div className="face">{front}</div>
            <div className="face rear"><CardBack /></div>
          </div>
          <button type="button" className="pr-zone" aria-label="카드 펼치기" style={{ left: -80, top: -60, width: fw + 160, height: fh + 120 }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onKeyDown={(e) => { if (e.key === 'Enter') { g.current.moved = false; up() } }} />
          <Hint show={!touched} d="M50 160 C50 120 50 60 50 10" x={fw + 16} y={20} w={100} h={170} />
        </div>
      )}
    </div>
  )
}

/* ───────────── 회전추첨기 ───────────── */
function LotteryRitual({ tier, setStep, reveal, pt, reduce }: Ctx) {
  const P = PR.lottery; const H = 640; const s = H / P.h; const W = P.w * s; const X = CW / 2 - W / 2, Y = 180
  const ax = { x: X + P.axle[0] * s, y: Y + P.axle[1] * s }
  const ex = { x: X + P.exit[0] * s, y: Y + P.exit[1] * s }
  const trayY = Y + (P.tray[1] + 18) * s
  const [phase, setPhase] = useState<'enter' | 'crank' | 'spin' | 'drop' | 'ball'>('enter')
  const [rot, setRot] = useState(0), [touched, setTouched] = useState(false), [bloom, setBloom] = useState(false), [speed, setSpeed] = useState(0)
  const g = useRef({ a: 0, acc: 0, vel: 0, t: 0, moved: false, tick: 0 })
  const GOAL = 720
  useEffect(() => { const id = setTimeout(() => { setPhase('crank'); setStep(1) }, reduce ? 50 : 950); return () => clearTimeout(id) }, [])
  const spinOut = (v0: number) => {
    setPhase('spin'); setStep(2)
    let v = Math.max(0.55, Math.abs(v0)); let r = rot; let last = performance.now()
    const f = (t: number) => {
      const dt = Math.min(40, t - last); last = t; r += v * dt; v *= Math.pow(0.9965, dt)
      if (Math.floor(r / 45) !== g.current.tick) { g.current.tick = Math.floor(r / 45); audio.sfx('tap') }
      setRot(r); setSpeed(v)
      if (v > 0.035) requestAnimationFrame(f)
      else { setSpeed(0); setPhase('drop'); audio.sfx('coin'); setTimeout(() => { setPhase('ball'); setStep(3); setTouched(false) }, reduce ? 50 : 1500) }
    }
    requestAnimationFrame(f)
  }
  const down = (e: RPE) => { (e.target as Element).setPointerCapture(e.pointerId); const p = pt(e); g.current = { ...g.current, a: Math.atan2(p.y - ax.y, p.x - ax.x), t: performance.now(), moved: false }; setTouched(true) }
  const move = (e: RPE) => {
    if (phase !== 'crank' || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    const p = pt(e); const a = Math.atan2(p.y - ax.y, p.x - ax.x)
    let d = ((a - g.current.a) * 180) / Math.PI; g.current.a = a
    if (d > 180) d -= 360; if (d < -180) d += 360
    if (Math.abs(d) > 1) g.current.moved = true
    if (d <= 0) return
    const now = performance.now(); const dt = Math.max(1, now - g.current.t); g.current.t = now
    g.current.vel = g.current.vel * 0.7 + (d / dt) * 0.3
    g.current.acc += d
    if (Math.floor((rot + d) / 45) !== g.current.tick) { g.current.tick = Math.floor((rot + d) / 45); audio.sfx('tap') }
    setRot((r) => r + d)
    if (g.current.acc >= GOAL) { (e.target as Element).releasePointerCapture(e.pointerId); spinOut(g.current.vel) }
  }
  const up = () => {
    if (phase !== 'crank') return
    if (!g.current.moved) { spinOut(1.1); return } // 눌러만 해도 돌아감(보조)
    if (g.current.acc >= GOAL * 0.5) spinOut(Math.max(g.current.vel, 0.6)) // 반 이상 돌렸으면 놓아도 관성으로 돈다
  }
  const prog = Math.min(1, g.current.acc / GOAL)
  const ballColor = tier >= 5 ? 'gold' : tier >= 4 ? 'blue' : 'white'
  const zoom = phase === 'ball' || bloom
  return (
    <div className={`lt ${phase}`} style={{ '--tier': TIER_COLOR[tier] } as CSSProperties}>
      <div className={`lt-cam ${zoom ? 'zoom' : ''}`} style={{ transformOrigin: `${ex.x}px ${trayY}px` }}>
        <div className="lt-machine" style={{ left: X, top: Y, width: W, height: H }}>
          <img className="drum" src={P.drum} alt="" draggable={false} style={{ transformOrigin: `${P.axle[0] * s}px ${P.axle[1] * s}px`, transform: `rotate(${rot}deg)`, filter: speed > 0.5 ? `blur(${Math.min(2.5, (speed - 0.5) * 3)}px)` : undefined }} />
          <img className="stand" src={P.stand} alt="" draggable={false} />
          <img className="crank" src={P.crank} alt="" draggable={false} style={{ transformOrigin: `${P.axle[0] * s}px ${P.axle[1] * s}px`, transform: `rotate(${rot}deg)` }} />
        </div>
        {phase === 'crank' && (
          <svg className="lt-ring" viewBox="0 0 100 100" style={{ left: ax.x - 330, top: ax.y - 330, width: 660, height: 660 }} aria-hidden>
            <circle cx="50" cy="50" r="48" className="track" /><circle cx="50" cy="50" r="48" className="fill" style={{ strokeDasharray: `${prog * 301.6} 400` }} />
          </svg>
        )}
        {(phase === 'drop' || phase === 'ball') && <i className={`lt-ball ${ballColor} ${bloom ? 'bloom' : ''}`} style={{ left: ex.x, top: trayY, '--fall': `${trayY - ex.y}px` } as CSSProperties} />}
      </div>
      {phase === 'crank' && <button type="button" className="pr-zone round" aria-label="핸들 돌리기" style={{ left: ax.x - 340, top: ax.y - 340, width: 680, height: 680 }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spinOut(1.1) } }} />}
      <Hint show={phase === 'crank' && !touched} d="M20 120 A120 120 0 0 1 220 40" x={ax.x + 60} y={ax.y - 170} w={240} h={140} />
      {phase === 'ball' && !bloom && <button type="button" className="pr-zone round" aria-label="공 확인하기" style={{ left: CW / 2 - 160, top: 470 - 160, width: 320, height: 320 }} onClick={() => { audio.sfx(tier >= 5 ? 'reveal5' : 'reveal'); setBloom(true); setTimeout(reveal, reduce ? 50 : 1100) }} />}
      {bloom && <i className="lt-flash" />}
    </div>
  )
}

/* ───────────── 이치방쿠지 ───────────── */
type V = { x: number; y: number }
function clipHalf(poly: V[], m: V, n: V, keepNeg: boolean): V[] {
  const f = (p: V) => ((p.x - m.x) * n.x + (p.y - m.y) * n.y) * (keepNeg ? -1 : 1)
  const out: V[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]; const fa = f(a), fb = f(b)
    if (fa >= 0) out.push(a)
    if ((fa >= 0) !== (fb >= 0)) { const k = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }) }
  }
  return out
}
const area = (p: V[]) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a.x * b.y - b.x * a.y }, 0)) / 2
const pts = (p: V[]) => p.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')

function KujiRitual({ tier, setStep, reveal, pt, reduce }: Ctx) {
  const B = PR.kujibox; const bw = 820; const bs = bw / B.w; const bh = B.h * bs; const BX = CW / 2 - bw / 2, BY = 300
  const T = PR.ticket; const tw = 640; const th = (T.h / T.w) * tw; const TX = CW / 2 - tw / 2, TY = 470 - th / 2
  const [phase, setPhase] = useState<'enter' | 'pick' | 'rise' | 'peel' | 'reveal'>('enter')
  const [hover, setHover] = useState<V | null>(null), [picked, setPicked] = useState<V | null>(null)
  const [p, setP] = useState<V>({ x: tw, y: th }), [gone, setGone] = useState(false), [touched, setTouched] = useState(false)
  const g = useRef({ sx: 0, sy: 0, px: tw, py: th, moved: false })
  const uid = useMemo(() => Math.random().toString(36).slice(2, 7), [])
  useEffect(() => { const id = setTimeout(() => { setPhase('pick'); setStep(1) }, reduce ? 50 : 1300); return () => clearTimeout(id) }, [])
  const open = { x0: BX + B.open[0] * bs, y0: BY + B.open[1] * bs, x1: BX + B.open[2] * bs, y1: BY + B.open[3] * bs }
  const pick = (q: V) => { audio.sfx('select'); setPicked(q); setPhase('rise'); setStep(2); setTimeout(() => { setPhase('peel'); setTouched(false) }, reduce ? 50 : 1150) }
  // 벗기기 기하: 모서리 C를 손가락 위치 P로 접는다 → 접는 선 = C·P의 수직이등분선
  const C = { x: tw, y: th }
  const rect: V[] = [{ x: 0, y: 0 }, { x: tw, y: 0 }, { x: tw, y: th }, { x: 0, y: th }]
  const dvec = { x: C.x - p.x, y: C.y - p.y }; const dl = Math.hypot(dvec.x, dvec.y)
  let keep = rect, flapR: V[] = [], mat = 'matrix(1 0 0 1 0 0)', frac = 0, M = C, n = { x: 1, y: 0 }
  if (dl > 1) {
    n = { x: dvec.x / dl, y: dvec.y / dl }; M = { x: (C.x + p.x) / 2, y: (C.y + p.y) / 2 }
    keep = clipHalf(rect, M, n, true)
    const flap = clipHalf(rect, M, n, false)
    const md = M.x * n.x + M.y * n.y
    const R = (q: V) => { const k = (q.x * n.x + q.y * n.y - md) * 2; return { x: q.x - k * n.x, y: q.y - k * n.y } }
    flapR = flap.map(R)
    mat = `matrix(${1 - 2 * n.x * n.x} ${-2 * n.x * n.y} ${-2 * n.x * n.y} ${1 - 2 * n.y * n.y} ${2 * md * n.x} ${2 * md * n.y})`
    frac = area(flap) / (tw * th)
  }
  const down = (e: RPE) => { (e.target as Element).setPointerCapture(e.pointerId); const q = pt(e); g.current = { sx: q.x, sy: q.y, px: p.x, py: p.y, moved: false }; setTouched(true) }
  const move = (e: RPE) => {
    if (phase !== 'peel' || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    const q = pt(e); const dx = q.x - g.current.sx, dy = q.y - g.current.sy
    if (Math.abs(dx) + Math.abs(dy) > 6) g.current.moved = true
    setP({ x: clamp(g.current.px + dx, -tw * 0.9, tw), y: clamp(g.current.py + dy, -th * 0.9, th) })
  }
  const finish = () => {
    audio.sfx(tier >= 5 ? 'reveal5' : 'reveal')
    const from = p
    tween(0, 1, 520, (k) => setP({ x: from.x + (-tw * 1.1 - from.x) * k, y: from.y + (-th * 1.1 - from.y) * k }), () => { setGone(true); setPhase('reveal'); setStep(3); setTouched(false) })
  }
  const up = () => {
    if (phase !== 'peel') return
    if (frac > 0.22 || !g.current.moved) finish()
    else { const from = p; tween(0, 1, 300, (k) => setP({ x: from.x + (tw - from.x) * k, y: from.y + (th - from.y) * k })) }
  }
  const tierCls = `t${tier}`
  return (
    <div className={`kj ${phase}`} style={{ '--tier': TIER_COLOR[tier] } as CSSProperties}>
      <div className="kj-box" style={{ left: BX, top: BY, width: bw, height: bh }}>
        <img className="box" src={B.file} alt="" draggable={false} />
        {phase === 'enter' && [0, 1, 2, 3, 4].map((i) => <img key={i} className="kj-fly" src={T.file} alt="" style={{ '--i': i, left: bw / 2 - 45 + (i - 2) * 60, top: bh * 0.3 } as CSSProperties} />)}
      </div>
      {phase === 'pick' && (
        <button type="button" className="pr-zone kj-pickzone" aria-label="쿠지 한 장 고르기" style={{ left: open.x0, top: open.y0, width: open.x1 - open.x0, height: open.y1 - open.y0 }}
          onPointerMove={(e) => setHover(pt(e))} onPointerLeave={() => setHover(null)} onClick={(e) => { const q = e.clientX ? pt(e) : { x: (open.x0 + open.x1) / 2, y: (open.y0 + open.y1) / 2 }; pick(q) }} />
      )}
      {phase === 'pick' && hover && <img className="kj-hover" src={T.file} alt="" style={{ left: hover.x - 55, top: hover.y - 46 }} />}
      {phase === 'pick' && !hover && <i className="kj-pickhint" style={{ left: (open.x0 + open.x1) / 2, top: (open.y0 + open.y1) / 2 }} />}
      {phase === 'rise' && picked && <img className="kj-rise" src={T.file} alt="" style={{ '--fx': `${picked.x - CW / 2}px`, '--fy': `${picked.y - 470}px`, left: TX, top: TY, width: tw, height: th } as CSSProperties} />}
      {(phase === 'peel' || phase === 'reveal') && (
        <div className={`kj-ticket ${tierCls}`} style={{ left: TX, top: TY, width: tw, height: th }}>
          <div className="under" style={{ WebkitMaskImage: `url(${T.file})`, maskImage: `url(${T.file})` }}>
            <svg viewBox="0 0 64 48" aria-hidden className="crown"><path d="M6 40 2 10l16 13L32 4l14 19 16-13-4 30Z" /><rect x="8" y="42" width="48" height="4" rx="1" /></svg>
            <b>{TIER_LABEL[tier]}</b><span className="stars">{'★'.repeat(tier)}</span>
          </div>
          {!gone && (
            <svg className="cover" viewBox={`0 0 ${tw} ${th}`} width={tw} height={th} aria-hidden>
              <defs>
                <clipPath id={`k${uid}`}><polygon points={pts(keep)} /></clipPath>
                <clipPath id={`f${uid}`}><polygon points={pts(flapR)} /></clipPath>
                <filter id={`b${uid}`}><feColorMatrix type="matrix" values="0 0 0 0 .92  0 0 0 0 .88  0 0 0 0 .79  0 0 0 1 0" /></filter>
                <linearGradient id={`g${uid}`} gradientUnits="userSpaceOnUse" x1={M.x} y1={M.y} x2={M.x - n.x * 160} y2={M.y - n.y * 160}>
                  <stop offset="0" stopColor="#000" stopOpacity=".32" /><stop offset=".25" stopColor="#fff" stopOpacity=".25" /><stop offset="1" stopColor="#000" stopOpacity=".05" />
                </linearGradient>
              </defs>
              <image href={T.file} width={tw} height={th} clipPath={`url(#k${uid})`} />
              {flapR.length > 2 && <>
                <polygon points={pts(flapR)} className="flap-shadow" />
                <g clipPath={`url(#f${uid})`}><image href={T.file} width={tw} height={th} transform={mat} filter={`url(#b${uid})`} /></g>
                <polygon points={pts(flapR)} fill={`url(#g${uid})`} />
              </>}
            </svg>
          )}
          {phase === 'peel' && <button type="button" className="pr-zone" aria-label="종이 벗기기" style={{ left: -60, top: -60, width: tw + 120, height: th + 120 }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onKeyDown={(e) => { if (e.key === 'Enter') finish() }} />}
          <Hint show={phase === 'peel' && !touched} d="M180 110 C150 80 90 50 20 20" x={tw - 200} y={th - 130} />
          {phase === 'reveal' && <button type="button" className="pr-zone" aria-label="결과 공개" style={{ left: 0, top: 0, width: tw, height: th }} onClick={() => { audio.sfx('select'); reveal() }} />}
        </div>
      )}
    </div>
  )
}

/* ───────────── 공통 틀 ───────────── */
export default function PullRitual({ kind, tx, bg, onClose }: { kind: RitualKind; tx: RecruitmentTransaction; bg: string; onClose: (summary: boolean) => void }) {
  const reduce = useReduceMotion()
  const { ref, pt } = useCanvasPoint()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const best = useMemo(() => [...tx.results].sort((a, b) => b.rarity - a.rarity || Number(b.isPickup) - Number(a.isPickup) || Number(b.isNew) - Number(a.isNew))[0], [tx])
  const tier = clamp(best.rarity, 3, 5)
  const c = CHAR_BY_ID[best.characterId]
  const multi = tx.results.length > 1
  const ctx: Ctx = { tier, front: <CardFront r={best} />, setStep, reveal: () => setDone(true), pt, reduce }
  const St = STEPS[kind]
  useEffect(() => { if (done) audio.sfx(tier >= 5 ? 'reveal5' : 'reveal') }, [done])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); if (done) onClose(multi); else setDone(true) } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [done, multi])
  const Body = { pack: PackRitual, capsule: CapsuleRitual, lottery: LotteryRitual, kuji: KujiRitual }[kind]
  return (
    <div className="pr-overlay" role="dialog" aria-modal="true" aria-label={`영입 연출 · ${St[Math.min(step, St.length - 1)].t}`}>
      <RefStage canvas={{ width: CW, height: CH }} className={`pr pr-${kind} t${tier} ${done ? 'is-done' : ''} ${reduce ? 'ui-reduced' : ''}`}>
        <div className="pr-root" ref={ref} style={{ '--tier': TIER_COLOR[tier] } as CSSProperties}>
          <div className="pr-bg" aria-hidden><img src={bg} alt="" /><i className="shade" /><i className="aura" /></div>
          {!done && <Body {...ctx} />}
          {!done && (
            <div className="pr-head">
              <span className="no">{String(step + 1).padStart(2, '0')}</span>
              <div><b key={step}>{St[Math.min(step, St.length - 1)].t}</b>{St[Math.min(step, St.length - 1)].h && <small key={`h${step}`}>{St[Math.min(step, St.length - 1)].h}</small>}</div>
              <span className="dots" aria-hidden>{St.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</span>
            </div>
          )}
          {!done && <button type="button" className="pr-skip" onClick={() => { audio.sfx('tap'); setDone(true) }}>건너뛰기 ›</button>}
          {done && (
            <div className="pr-result" role="status">
              {tier >= 4 && <i className="rays" aria-hidden />}
              <div className="card"><CardFront r={best} /></div>
              <div className="info">
                <span className="label">{TIER_LABEL[tier]}{best.isPickup ? ' · PICK UP' : ''}</span>
                <h2>{c.name}</h2>
                <p>{best.isNew ? '새 대원이 합류했습니다' : '이미 함께하는 대원입니다 · 중복 전환 규칙 미정'}{multi ? ` · 외 ${tx.results.length - 1}명` : ''}</p>
              </div>
              <button type="button" className="pr-ok" autoFocus onClick={() => { audio.sfx('tap'); onClose(multi) }}>{multi ? `전체 결과 보기 (${tx.results.length})` : '확인'}</button>
            </div>
          )}
        </div>
      </RefStage>
    </div>
  )
}
