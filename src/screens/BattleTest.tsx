import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import '../styles/battle-test.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { RefStage } from '../ui/ref'
import { useReduceMotion, useScreenActive } from '../ui/motion'
import SP from '../game/data/battle-sprites.json'
import { newSim, step, castSkill, killAll, SKILLS, type Sim, type Ent, type Kind } from '../game/battleSim'

// 전투 테스트(시안: 성수 거리 전투 1280×720). 아군 4명(리온·세렌·이안·칸나) vs 결정 몬스터 2웨이브.
// 기본 공격은 자동, 스킬은 아래 카드를 눌러 쓴다(AUTO면 자동). 2배속·일시정지·재시작.
// 리온·사냥개는 크로마키 영상에서 뽑은 프레임 시트, 나머지는 이미지 모델로 만든 한 장 그림을 움직인다.
type Sheet = { file: string; w: number; h: number; cols: number; n: number; fps: number }
type Pic = { file: string; w: number; h: number }
const S = SP as unknown as { plate: string; rion: Sheet; hound: Sheet; ian: Pic; seren: Pic; kanna: Pic; golem: Pic; orb: Pic }
// 표시 크기·발 위치(그림 안에서 발이 닿는 점)
const LOOK: Record<Kind, { s: number; ax: number; ay: number; head: number }> = {
  rion: { s: 0.86, ax: 92, ay: 259, head: 185 },
  hound: { s: 0.6, ax: 108, ay: 214, head: 130 },
  ian: { s: 175 / S.ian.h, ax: S.ian.w * 0.45, ay: S.ian.h, head: 182 },
  seren: { s: 150 / S.seren.h, ax: S.seren.w * 0.4, ay: S.seren.h, head: 158 },
  kanna: { s: 150 / S.kanna.h, ax: S.kanna.w * 0.45, ay: S.kanna.h, head: 158 },
  golem: { s: 215 / S.golem.h, ax: S.golem.w * 0.5, ay: S.golem.h, head: 222 },
  orb: { s: 95 / S.orb.h, ax: S.orb.w * 0.5, ay: S.orb.h, head: 160 },
}
const ORDER = ['rion', 'seren', 'ian', 'kanna'] as const
const CARD_X = [40, 355, 650, 955]
const IDLE_R = [...Array.from({ length: 15 }, (_, i) => 33 + i), 0, 1, 2, 3, 4, 5]
const fmtT = (s: number) => { const v = Math.max(0, Math.ceil(s)); return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}` }

function SheetFrame({ sh, f, s }: { sh: Sheet; f: number; s: number }) {
  const c = f % sh.cols, r = Math.floor(f / sh.cols)
  return <i className="bt-sheet" style={{ width: sh.w * s, height: sh.h * s, backgroundImage: `url(${sh.file})`, backgroundSize: `${sh.w * sh.cols * s}px auto`, backgroundPosition: `${-c * sh.w * s}px ${-r * sh.h * s}px` }} />
}

function Unit({ e, t }: { e: Ent; t: number }) {
  const L = LOOK[e.kind]
  const act = e.act
  let body
  if (e.kind === 'rion') {
    const f = act && (act.k === 'atk' || act.k === 'skill') ? Math.min(32, 6 + Math.floor(act.t * 12)) : IDLE_R[Math.floor(t * 12) % IDLE_R.length]
    body = <SheetFrame sh={S.rion} f={f} s={L.s} />
  } else if (e.kind === 'hound') {
    body = <SheetFrame sh={S.hound} f={(Math.floor(t * 12) + e.id.length * 7 + e.hx) % S.hound.n} s={L.s} />
  } else {
    const p = S[e.kind as 'ian']
    body = <img src={p.file} alt="" draggable={false} style={{ width: p.w * L.s, height: p.h * L.s }} />
  }
  const dir = e.side === 'ally' ? 1 : -1
  const k = act ? act.t / act.dur : 0
  let dx = 0, sc = 1
  if (act?.k === 'atk' && e.kind !== 'rion') dx = Math.sin(Math.min(1, k) * Math.PI) * (e.side === 'ally' ? 22 : -28)
  if (act?.k === 'skill') sc = 1 + Math.sin(Math.min(1, k) * Math.PI) * 0.08
  if (act?.k === 'hit') dx = -dir * 6 * (1 - k)
  const hpk = e.hp / e.max
  const float = e.kind === 'orb' ? -58 + Math.sin(t * 2.4 + e.hx) * 8 : 0
  return (
    <div className={`bt-unit ${e.side} k-${e.kind} ${e.dead ? 'dead' : ''} ${act?.k === 'hit' ? 'hit' : ''} ${act?.k === 'skill' || act?.k === 'dash' ? 'cast' : ''} ${e.shield > 0 ? 'shielded' : ''} ${e.taunt > 1.3 ? 'taunt' : ''}`}
      style={{ left: e.x, top: e.y, zIndex: Math.round(e.y) } as CSSProperties} data-id={e.id}>
      <i className="bt-shadow" style={{ width: e.kind === 'golem' ? 150 : e.kind === 'orb' ? 70 : 96 }} />
      <div className="bt-body" style={{ transform: `translate(${dx - L.ax * L.s}px, ${-L.ay * L.s + float}px) scale(${sc})`, transformOrigin: `${L.ax * L.s}px ${L.ay * L.s}px` }}>{body}</div>
      {e.shield > 0 && <i className="bt-aura" />}
      {!e.dead && (
        <div className="bt-hp" style={{ top: -L.head + float }}>
          <i className="dia" /><span><i style={{ width: `${hpk * 100}%` }} />{e.shield > 0 && <b style={{ width: `${Math.min(100, (e.shield / e.max) * 100)}%` }} />}</span>
        </div>
      )}
    </div>
  )
}

export default function BattleTest(_: { params: Record<string, unknown> }) {
  const nav = useNav()
  const active = useScreenActive()
  const reduce = useReduceMotion()
  const sim = useRef<Sim>(newSim())
  const [, tick] = useReducer((n: number) => n + 1, 0)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [auto, setAuto] = useState(false)
  const [started, setStarted] = useState(false)
  const cfg = useRef({ paused, speed, auto, active, started }); cfg.current = { paused, speed, auto, active, started }
  const lastSeq = useRef(0)

  useEffect(() => { audio.bgm('battle'); const id = setTimeout(() => setStarted(true), reduce ? 0 : 1300); return () => { clearTimeout(id); audio.bgm('menu') } }, [])
  useEffect(() => {
    let raf = 0, last = performance.now()
    const f = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const c = cfg.current
      if (c.active && !c.paused && c.started) {
        const s = sim.current
        step(s, dt * c.speed, c.auto)
        // 소리: 새 효과마다(너무 잦지 않게)
        for (const x of s.fx) if (x.id > lastSeq.current) {
          if (x.k === 'hitE' && Math.random() < 0.5) audio.sfx('hit')
          if (x.k === 'slashBig') audio.sfx('slash')
          if (x.k === 'dieE') audio.sfx('coin')
          if (x.k === 'wave') audio.sfx('title')
        }
        lastSeq.current = Math.max(lastSeq.current, ...s.fx.map((x) => x.id), 0)
        if (s.result && !resultSounded.current) { resultSounded.current = true; audio.sfx(s.result === 'win' ? 'reveal5' : 'error') }
      }
      tick()
      raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [])
  const resultSounded = useRef(false)
  const restart = () => { sim.current = newSim(); resultSounded.current = false; lastSeq.current = 0; setPaused(false); setStarted(false); setTimeout(() => setStarted(true), reduce ? 0 : 900) }
  const cast = (id: string) => { if (paused || !started) return; if (castSkill(sim.current, id)) audio.sfx(id === 'ian' ? 'select' : id === 'kanna' ? 'coin' : 'whoosh'); else audio.sfx('error') }
  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.stopPropagation(); if (!sim.current.result) setPaused((p) => !p) }
      const n = ['1', '2', '3', '4'].indexOf(ev.key); if (n >= 0) cast(ORDER[n])
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [paused, started])
  useEffect(() => { (window as unknown as { __BT__: unknown }).__BT__ = { sim: () => sim.current, killAll: () => killAll(sim.current), cast, setT: (t: number) => { sim.current.t = t } } }, [paused, started])

  const s = sim.current
  const shake = s.shake > 0 && !reduce ? `translate(${(Math.random() - 0.5) * 10 * s.shake * 4}px, ${(Math.random() - 0.5) * 8 * s.shake * 4}px)` : undefined
  const ents = [...s.ents].sort((a, b) => a.y - b.y)
  const dealt = (id: string) => s.ents.find((e) => e.id === id)?.dealt ?? 0

  return (
    <div className="scr battle-test">
      <RefStage canvas={{ width: 1280, height: 720 }} className={`bt ${reduce ? 'ui-reduced' : ''} ${paused ? 'is-paused' : ''}`}>
        <div className="bt-world" style={{ transform: shake }}>
          <img className="bt-plate" src={S.plate} alt="" draggable={false} />
          <i className="bt-sun" />
          {ents.map((e) => <Unit key={e.id} e={e} t={s.t} />)}
          {s.proj.map((p) => <i key={p.id} className={`bt-proj p-${p.k}`} style={{ left: p.x, top: p.y, zIndex: 900 }} />)}
          {s.fx.map((f) => f.k === 'num'
            ? <b key={f.id} className={`bt-num ${f.crit ? 'crit' : ''} ${f.heal ? 'heal' : ''} ${f.shield ? 'shield' : ''}`} style={{ left: f.x, top: f.y, zIndex: 1000, '--k': f.t / f.dur } as CSSProperties}>{f.heal ? '+' : ''}{f.v}</b>
            : f.k === 'wave' ? null
            : <i key={f.id} className={`bt-fx f-${f.k} ${f.v != null ? `v${f.v}` : ''}`} style={{ left: f.x, top: f.y, zIndex: 950, animationDuration: `${f.dur}s` } as CSSProperties} />)}
          <i className="bt-rail" aria-hidden />
        </div>
        {s.fx.filter((f) => f.k === 'wave').map((f) => <div key={f.id} className="bt-wave" style={{ animationDuration: `${f.dur}s` }}>{f.text}</div>)}

        {/* 위 HUD */}
        <div className="bt-top">
          <div className="bt-stage"><b>ABILITY KINGDOM</b><i /><span>SEONGSU / 01-04</span>{s.waves > 1 && <em>WAVE {s.wave}/{s.waves}</em>}</div>
          <div className={`bt-timer ${s.limit - s.t < 15 ? 'low' : ''}`} aria-label={`남은 시간 ${fmtT(s.limit - s.t)}`}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><circle cx="12" cy="13.5" r="8" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M12 9v5l3 2M9.5 2.5h5M12 2.5v3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>{fmtT(s.limit - s.t)}</div>
          <button type="button" className={`bt-btn auto ${auto ? 'on' : ''}`} aria-pressed={auto} onClick={() => { audio.sfx('select'); setAuto((a) => !a) }}>AUTO</button>
          <button type="button" className={`bt-btn spd ${speed === 2 ? 'on' : ''}`} aria-pressed={speed === 2} onClick={() => { audio.sfx('select'); setSpeed((v) => (v === 1 ? 2 : 1)) }}>{speed}x<svg viewBox="0 0 24 16" width="20" height="14" aria-hidden><path d="M1 1l9 7-9 7zM12 1l9 7-9 7z" fill="currentColor" /></svg></button>
          <button type="button" className="bt-btn pause" aria-label="일시정지" onClick={() => { audio.sfx('tap'); setPaused(true) }}><svg viewBox="0 0 16 18" width="14" height="16" aria-hidden><rect x="1" width="5" height="18" rx="1" fill="currentColor" /><rect x="10" width="5" height="18" rx="1" fill="currentColor" /></svg></button>
        </div>

        {/* 아래 카드 */}
        {ORDER.map((id, i) => {
          const u = s.ents.find((e) => e.id === id)!
          const sk = s.skills[id]
          const ready = sk.left === 0 && !u.dead && started && !s.result
          return (
            <div key={id} className={`bt-card ${u.dead ? 'down' : ''} ${ready ? 'ready' : ''}`} style={{ left: CARD_X[i] }}>
              <img className="face" src={`ref/battle/face-${id}.webp`} alt="" draggable={false} />
              <b className="name">{u.name}</b>
              <span className="hp num-tab">{Math.ceil(u.hp)} / {u.max}</span>
              <span className="bar"><i style={{ width: `${(u.hp / u.max) * 100}%` }} />{u.shield > 0 && <b style={{ width: `${Math.min(100, (u.shield / u.max) * 100)}%` }} />}</span>
              <button type="button" className="skill" disabled={!ready} aria-label={`${SKILLS[id].name} (${i + 1}) · ${SKILLS[id].desc}${ready ? ' · 사용 가능' : ` · ${Math.ceil(sk.left)}초 남음`}`} onClick={() => cast(id)}>
                <img src={`ref/battle/skill-${id}.webp`} alt="" draggable={false} />
                {!ready && <i className="cool" style={{ '--p': `${(sk.left / sk.cd) * 360}deg` } as CSSProperties} />}
                <em className="num-tab">{ready ? sk.cd : Math.ceil(sk.left)}</em>
              </button>
            </div>
          )
        })}

        {s.cutin && <div className="bt-cutin" key={s.cutin.kind + s.cutin.name}><img src={`ref/battle/face-${s.cutin.kind}.webp`} alt="" /><b>{s.cutin.name}</b></div>}
        {!started && !s.result && <div className="bt-start" aria-hidden><b>BATTLE START</b></div>}

        {paused && !s.result && (
          <div className="bt-overlay" role="dialog" aria-label="일시정지">
            <div className="bt-panel">
              <h2>일시정지</h2>
              <p>전투 테스트 · 기본 공격은 자동, 스킬은 카드(또는 숫자 1~4)로 사용합니다.</p>
              <button type="button" className="primary" autoFocus onClick={() => { audio.sfx('tap'); setPaused(false) }}>계속하기</button>
              <button type="button" onClick={() => { audio.sfx('tap'); restart() }}>처음부터</button>
              <button type="button" onClick={() => { audio.sfx('tap'); nav.back() }}>나가기</button>
            </div>
          </div>
        )}
        {s.result && (
          <div className={`bt-overlay result ${s.result}`} role="dialog" aria-label={s.result === 'win' ? '승리' : '패배'}>
            <div className="bt-panel wide">
              <h2 className="big">{s.result === 'win' ? 'VICTORY' : s.t >= s.limit ? 'TIME OVER' : 'DEFEAT'}</h2>
              <p>걸린 시간 {fmtT(s.t)} · 웨이브 {s.wave}/{s.waves}</p>
              <div className="bt-stats">
                {ORDER.map((id) => { const u = s.ents.find((e) => e.id === id)!; const top = Math.max(1, ...ORDER.map((o) => dealt(o))); return (
                  <div key={id} className="row"><img src={`ref/battle/face-${id}.webp`} alt="" /><b>{u.name}</b><span className="bar"><i style={{ width: `${(u.dealt / top) * 100}%` }} /></span><em className="num-tab">{u.dealt.toLocaleString()}</em>{u.heal > 0 && <small>회복 {u.heal}</small>}</div>
                ) })}
              </div>
              <div className="btns">
                <button type="button" className="primary" autoFocus onClick={() => { audio.sfx('tap'); restart() }}>다시 하기</button>
                <button type="button" onClick={() => { audio.sfx('tap'); nav.back() }}>나가기</button>
              </div>
              <small className="note">테스트 전투입니다. 보상·기록은 남지 않습니다.</small>
            </div>
          </div>
        )}
      </RefStage>
    </div>
  )
}
