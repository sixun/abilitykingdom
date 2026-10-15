import { useEffect, useReducer, useRef, useState, type CSSProperties, type PointerEvent as RPE } from 'react'
import '../../styles/case.css'
import { useNav } from '../../app/nav'
import { audio } from '../../app/audio'
import { RefStage } from '../../ui/ref'
import { useReduceMotion, useScreenActive } from '../../ui/motion'
import { game, useGame } from '../../game/store'
import { CASE_NODE, CHAPTER1 } from '../../game/story/chapter1'
import { STAGES } from '../../game/combat/chapter1Stages'
import { newSim, step, castActive, castBuff, setFocus, useDevice, starsOf, killAll, stat, ALLY_ORDER, ABILITY_INFO, LANE_Y, type Sim, type AllyKind, type Unit } from '../../game/combat/sim'
import { BattleRenderer, headY } from '../../battle/BattleRenderer'
import { BGS } from '../../battle/look'
import StoryScene from './StoryScene'
import type { Reward } from '../../game/types'
import { ITEM_BY_ID } from '../../game/data/catalog'

// 사건 파일 전투(1장). 화면 = WebGL 캔버스(그림·빛·반사) + DOM 오버레이(체력·시전 게이지·카드·안내).
// 조작: 카드 탭 = 액티브, 카드 위로 밀기(또는 카드의 작은 버프 단추) = 버프, 적 탭 = 집중 공격, 셔터 장치 탭 = 대원 보내기.
// 키보드: 1~4 액티브, Q·W·E·R 버프, Esc 일시정지.
const fmt = (s: number) => { const v = Math.max(0, Math.ceil(s)); return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}` }
const BUFF_KEYS = ['q', 'w', 'e', 'r']
const KIND_LABEL: Record<string, string> = { battle: '일반 전투', objective: '목표 전투', boss: '보스 전투' }
const HINT: Record<string, string> = {
  'c1-2': '바닥의 빨간 예고가 보이면 이안의 「방벽 전개」로 미리 막아 두세요.',
  'c1-4': '노란 표시가 붙은 잠식충을 눌러 집중 공격하고, 이안 카드를 위로 밀어 중계기를 감싸세요.',
  'c1-5': '머리 위 보라 게이지가 보이면 라온의 「주파수 폭발」이나 세렌의 「월광 일섬」으로 끊으세요.',
  'c1-6': '호출 결정체를 눌러 집중 공격하세요. 증원이 몰리면 셔터 장치를 눌러 길을 막을 수 있어요.',
  'c1-7': '기둥이 서면 기둥을 먼저 누르세요. 전역 노이즈는 끊으면 6초 무력화됩니다.',
}

export default function CaseBattle({ params }: { params: Record<string, unknown> }) {
  const nav = useNav()
  const gs = useGame()
  const active = useScreenActive()
  const reduce = useReduceMotion()
  const nodeId = String(params.node ?? params.id ?? 'c1-2')
  const node = CASE_NODE[nodeId] ?? CASE_NODE['c1-2']
  const def = STAGES[node.id] ?? STAGES['c1-2']
  const cleared = !!gs.content.caseFile?.stars[node.id]
  const sim = useRef<Sim>(newSim(def))
  const canvas = useRef<HTMLCanvasElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const rd = useRef<BattleRenderer | null>(null)
  const [, tick] = useReducer((n: number) => n + 1, 0)
  const [phase, setPhase] = useState<'pre' | 'intro' | 'fight' | 'result' | 'post'>(node.pre?.length && !cleared ? 'pre' : 'intro')
  const [load, setLoad] = useState(0)
  const [glErr, setGlErr] = useState(false)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [auto, setAuto] = useState(false)
  const [reward, setReward] = useState<null | { first: boolean; rewards: Reward[]; coreUnlocked: boolean; stars: number }>(null)
  const cfg = useRef({ paused, speed, auto, active, phase, reduce }); cfg.current = { paused, speed, auto, active, phase, reduce }
  const lastSeq = useRef(0); const resultDone = useRef(false)

  // 렌더러 준비(대화 중에 미리 불러온다)
  useEffect(() => {
    if (!canvas.current) return
    let r: BattleRenderer
    try { r = new BattleRenderer(canvas.current) } catch { setGlErr(true); return }
    rd.current = r
    const kinds = new Set<string>([...ALLY_ORDER, 'hound', 'golem', 'orb', 'mite'])
    for (const w of def.waves ?? []) for (const sp of w) kinds.add(sp.k)
    for (const w of def.timeline ?? []) for (const sp of w.spawn) kinds.add(sp.k)
    if (def.goal === 'boss') { kinds.add('boss'); kinds.add('pylon') }
    for (const d of def.devices ?? []) kinds.add(d.k)
    r.load(def.bg, [...kinds], setLoad).then(() => setLoad(1)).catch(() => setGlErr(true))
    return () => r.dispose()
  }, [])
  useEffect(() => { audio.bgm('battle'); return () => audio.bgm('menu') }, [])
  useEffect(() => { if (phase === 'intro' && load >= 1) { const id = setTimeout(() => setPhase('fight'), reduce ? 300 : 1900); audio.sfx('title'); return () => clearTimeout(id) } }, [phase, load])

  useEffect(() => {
    let raf = 0, last = performance.now(), t = 0
    const f = (now: number) => {
      const real = Math.min(0.05, (now - last) / 1000); last = now
      const c = cfg.current; const s = sim.current; const r = rd.current
      if (c.active && !c.paused) {
        if (c.phase === 'fight') {
          let k = c.speed
          if (s.slowmo > 0) { s.slowmo -= real; k *= 0.35 }
          if (s.stop > 0 && !c.reduce) s.stop -= real
          else { s.stop = 0; step(s, real * k, c.auto) }
          sounds(s)
          if (s.result && !resultDone.current) { resultDone.current = true; onResult(s) }
        }
        t += real * (c.phase === 'fight' ? c.speed : 1)
        if (r?.ready && host.current) { r.reduce = c.reduce; const b = host.current.getBoundingClientRect(); r.resize(b.width, b.height, window.devicePixelRatio || 1, gs.settings.quality === 'low' ? 1 : 1.5); r.render(s, t, real * (c.phase === 'fight' ? c.speed : 1), !c.reduce) }
      }
      tick()
      raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [])

  const sounds = (s: Sim) => {
    for (const x of s.fx) if (x.id > lastSeq.current) {
      if (x.k === 'hitE' && (x.crit || Math.random() < 0.35)) audio.sfx('hit')
      else if (x.k === 'slashBig') audio.sfx('slash')
      else if (x.k === 'dieE') audio.sfx('coin')
      else if (x.k === 'break') audio.sfx('reveal')
      else if (x.k === 'banner') audio.sfx('title')
      else if (x.k === 'slam' || x.k === 'noise') audio.sfx('swap')
      else if (x.k === 'buffOn') audio.sfx('save')
    }
    for (const x of s.fx) lastSeq.current = Math.max(lastSeq.current, x.id)
  }
  const onResult = async (s: Sim) => {
    audio.sfx(s.result === 'win' ? 'reveal5' : 'error')
    if (s.result === 'win') { const st = starsOf(s).filter(Boolean).length; const res = await game.clearCaseNode(node.id, st); if (res.ok) setReward(res.value) }
    setTimeout(() => setPhase('result'), 900)
  }
  const restart = () => { sim.current = newSim(def); resultDone.current = false; lastSeq.current = 0; setReward(null); setPaused(false); setPhase('intro') }
  const act = (id: AllyKind) => { if (cfg.current.phase !== 'fight' || cfg.current.paused) return; if (castActive(sim.current, id)) audio.sfx(id === 'ian' ? 'select' : id === 'kanna' ? 'coin' : 'whoosh'); else audio.sfx('error') }
  const buff = (id: AllyKind) => { if (cfg.current.phase !== 'fight' || cfg.current.paused) return; if (!castBuff(sim.current, id)) audio.sfx('error') }
  const focus = (id: string) => { if (cfg.current.phase !== 'fight') return; setFocus(sim.current, sim.current.focus === id ? null : id); audio.sfx('select') }
  const dev = (id: string) => { if (cfg.current.phase !== 'fight') return; if (useDevice(sim.current, id)) audio.sfx('open'); else audio.sfx('error') }

  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      if (cfg.current.phase === 'pre' || cfg.current.phase === 'post') return
      if (ev.key === 'Escape') { ev.stopPropagation(); if (!sim.current.result) setPaused((p) => !p); return }
      const n = ['1', '2', '3', '4'].indexOf(ev.key); if (n >= 0) act(ALLY_ORDER[n])
      const b = BUFF_KEYS.indexOf(ev.key.toLowerCase()); if (b >= 0) buff(ALLY_ORDER[b])
    }
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true)
  }, [])
  useEffect(() => { (window as unknown as { __CB__: unknown }).__CB__ = { sim: () => sim.current, killAll: () => killAll(sim.current), act, buff, focus, dev, advance: (sec: number) => { for (let k = 0; k < sec * 30 && !sim.current.result; k++) step(sim.current, 1 / 30, cfg.current.auto) }, setT: (t: number) => { sim.current.t = t }, phase: () => cfg.current.phase, renderer: () => rd.current } })

  const s = sim.current
  const allies = ALLY_ORDER.map((id) => s.units.find((u) => u.id === id)!)
  const foes = s.units.filter((u) => u.side === 'enemy' && !u.dead && !u.entering)
  const boss = s.units.find((u) => u.kind === 'boss')
  const relay = s.devices.find((d) => d.k === 'relay')
  const tipTarget = s.tip?.at === 'enemy' ? (s.units.find((u) => u.side === 'enemy' && !u.dead && (s.tip!.ref ? u.kind === s.tip!.ref : !!u.tele)) ?? null) : null
  const stars = starsOf(s)

  return (
    <div className="scr case-battle">
      <RefStage canvas={{ width: 1280, height: 720 }} className={`cb ${reduce ? 'ui-reduced' : ''} ${paused ? 'is-paused' : ''} bg-${def.bg}`}>
        <div className="cb-gl" ref={host}><canvas ref={canvas} width={1280} height={720} aria-label={`${node.no} ${node.title} 전투 화면`} /></div>
        <i className="cb-grade" style={{ background: BGS[def.bg].grade }} aria-hidden />
        <i className="cb-vignette" aria-hidden />
        {glErr && <div className="cb-glerr">이 기기에서는 전투 화면(WebGL2)을 그릴 수 없습니다.</div>}

        {/* 머리 위: 체력·보호막·시전·표시 + 적 누르기 */}
        <div className="cb-marks" style={rd.current ? { transform: `translate(640px, 360px) scale(${rd.current.view.z}) translate(${-rd.current.view.x}px, ${-rd.current.view.y}px)`, transformOrigin: '0 0' } : undefined}>
          {s.units.filter((u) => !u.dead && !(u.side === 'enemy' && u.x > 1300)).map((u) => <Mark key={u.id} u={u} focus={s.focus === u.id} onFocus={u.side === 'enemy' ? () => focus(u.id) : undefined} tipped={tipTarget?.id === u.id} />)}
          {s.devices.map((d) => d.k === 'relay'
            ? <div key={d.id} className="cb-dev relay" style={{ left: d.x, top: d.y - 175 }}><b>{d.label}</b><span className="bar"><i style={{ width: `${(d.hp / d.max) * 100}%` }} /></span>{d.guard > 0 && <em>보호 구역</em>}</div>
            : <button key={d.id} type="button" className={`cb-dev shutter ${d.closed > 0 ? 'closed' : d.cool > 0 ? 'cool' : 'ready'} ${s.tip?.at === 'device' ? 'tipped' : ''}`} style={{ left: d.x, top: d.y - 150 }}
              aria-label={`${d.label} ${d.closed > 0 ? `봉쇄 중 ${Math.ceil(d.closed)}초` : d.cool > 0 ? `재정비 ${Math.ceil(d.cool)}초` : '— 눌러서 대원 보내기'}`} onClick={() => dev(d.id)}>
              <b>{d.label}</b><span>{d.closed > 0 ? `봉쇄 ${Math.ceil(d.closed)}` : d.cool > 0 ? `재정비 ${Math.ceil(d.cool)}` : s.units.some((u) => u.task?.dev === d.id) ? '이동 중' : '누르면 작동'}</span>
            </button>)}
          {s.devices.filter((d) => d.k === 'shutter' && d.closed > 0).map((d) => <i key={`w${d.id}`} className="cb-shutter" style={{ top: LANE_Y[d.lane] - 120 }} aria-hidden />)}
          {s.fx.map((f) => f.k === 'num'
            ? <b key={f.id} className={`cb-num ${f.crit ? 'crit' : ''} ${f.heal ? 'heal' : ''} ${f.shield ? 'shield' : ''} ${f.text === 'dev' ? 'dev' : ''}`} style={{ left: f.x, top: f.y, '--k': f.t / f.dur } as CSSProperties}>{f.heal ? '+' : ''}{f.v}</b>
            : f.k === 'word' ? <b key={f.id} className="cb-word" style={{ left: f.x, top: f.y, '--k': f.t / f.dur } as CSSProperties}>{f.text}</b>
            : f.k === 'break' ? <b key={f.id} className="cb-break" style={{ left: f.x, top: f.y }}>BREAK</b>
            : null)}
        </div>
        {s.fx.filter((f) => f.k === 'banner').slice(-1).map((f) => <div key={f.id} className="cb-banner" style={{ animationDuration: `${f.dur}s` }}>{f.text}</div>)}

        {/* 위 HUD */}
        <div className="cb-top">
          <div className="cb-stage"><small>{CHAPTER1.no} · {node.no} · {KIND_LABEL[node.kind]}</small><b>{node.title}</b><span>{def.goalText}</span></div>
          {def.goal === 'defend'
            ? <div className="cb-goal defend" aria-label={`수신 ${Math.floor(Math.min(1, s.t / (def.defendT ?? 75)) * 100)}%`}><span>재가동</span><i><b style={{ width: `${Math.min(1, s.t / (def.defendT ?? 75)) * 100}%` }} /></i><em className="num-tab">{fmt((def.defendT ?? 75) - s.t)}</em></div>
            : <div className={`cb-timer ${def.limit - s.t < 15 ? 'low' : ''}`} aria-label={`남은 시간 ${fmt(def.limit - s.t)}`}>{fmt(def.limit - s.t)}</div>}
          <button type="button" className={`cb-btn ${auto ? 'on' : ''}`} aria-pressed={auto} onClick={() => { audio.sfx('select'); setAuto((a) => !a) }}>AUTO</button>
          <button type="button" className={`cb-btn ${speed === 2 ? 'on' : ''}`} aria-pressed={speed === 2} onClick={() => { audio.sfx('select'); setSpeed((v) => (v === 1 ? 2 : 1)) }}>{speed}x</button>
          <button type="button" className="cb-btn" aria-label="일시정지" onClick={() => { audio.sfx('tap'); setPaused(true) }}>❚❚</button>
        </div>
        {boss && !boss.dead && phase === 'fight' && (
          <div className="cb-boss"><small>위험 등급 6 · 우호도 레드</small><b>{boss.name}</b><span className="bar"><i style={{ width: `${(boss.hp / stat(boss, 'maxHp')) * 100}%` }} /><em style={{ left: '70%' }} /><em style={{ left: '35%' }} /></span><span className="ph">PHASE {boss.phase}{s.units.some((u) => u.kind === 'pylon' && !u.dead) ? ' · 기둥 보호 중(피해 70% 감소)' : boss.vuln > 0 ? ' · 무력화' : ''}</span></div>
        )}
        {s.tip && phase === 'fight' && <div className="cb-tip" key={s.tip.id} role="status"><i>!</i>{s.tip.text}</div>}

        {/* 아래 카드 */}
        <div className="cb-cards">
          {allies.map((u, i) => <Card key={u.id} u={u} i={i} s={s} onAct={() => act(u.kind as AllyKind)} onBuff={() => buff(u.kind as AllyKind)} tipped={s.tip?.at === 'card' && s.tip.ref === u.kind} />)}
        </div>
        {s.cutin && <div className={`cb-cutin ${s.cutin.buff ? 'buff' : ''}`} key={s.cutin.kind + s.cutin.name + s.cutin.buff}><img src={`ref/battle/face-${s.cutin.kind}.webp`} alt="" /><small>{s.cutin.buff ? 'BUFF' : 'ACTIVE'}</small><b>{s.cutin.name}</b></div>}

        {phase === 'intro' && (
          <div className="cb-intro" aria-live="polite">
            <small>{CHAPTER1.no} · {node.no}</small><b>{node.title}</b><span>{def.goalText}</span>
            {load < 1 ? <em className="load"><i style={{ width: `${load * 100}%` }} />조명·반사 준비 중</em> : <em>BATTLE START</em>}
            <p className="squad">1장 지정 편성 · 체험 대원: 라온 · 세렌 · 이안 · 칸나</p>
          </div>
        )}

        {paused && !s.result && (
          <div className="cb-overlay" role="dialog" aria-label="일시정지">
            <div className="cb-panel">
              <h2>일시정지</h2>
              <ul className="cb-help">
                <li><b>카드 탭</b> 액티브 스킬 (1~4)</li><li><b>카드 위로 밀기</b> 버프 (Q W E R)</li>
                <li><b>적 탭</b> 집중 공격 · 다시 누르면 해제</li><li><b>장치 탭</b> 가까운 대원이 달려가 작동</li>
              </ul>
              <div className="cb-passives">{ALLY_ORDER.map((k) => <p key={k}><img src={`ref/battle/face-${k}.webp`} alt="" /><b>패시브 · {ABILITY_INFO[k].passive[0]}</b>{ABILITY_INFO[k].passive[1]}</p>)}</div>
              <div className="btns">
                <button type="button" className="primary" autoFocus onClick={() => { audio.sfx('tap'); setPaused(false) }}>계속하기</button>
                <button type="button" onClick={() => { audio.sfx('tap'); restart() }}>처음부터</button>
                <button type="button" onClick={() => { audio.sfx('tap'); nav.back() }}>사건 파일로</button>
              </div>
            </div>
          </div>
        )}
        {phase === 'result' && s.result && (
          <div className={`cb-overlay result ${s.result}`} role="dialog" aria-label={s.result === 'win' ? '승리' : '패배'}>
            <div className="cb-panel wide">
              <h2 className="big">{s.result === 'win' ? (node.kind === 'boss' ? 'CASE CLEAR' : 'VICTORY') : s.why === '제한 시간 초과' ? 'TIME OVER' : 'DEFEAT'}</h2>
              <p className="why">{s.why} · {fmt(s.t)}</p>
              <ul className="cb-stars">{def.stars.map((x, k) => <li key={k} className={stars[k] ? 'on' : ''}><i aria-hidden>★</i>{x.label}</li>)}</ul>
              {s.result === 'win' && reward && (
                <div className="cb-reward">{reward.first ? <><small>첫 클리어 보상</small>{reward.rewards.map((r) => <span key={r.id}>{r.kind === 'currency' ? ({ credit: '크레딧', diamond: '다이아' } as Record<string, string>)[r.id] ?? r.id : ITEM_BY_ID[r.id]?.name ?? r.id} ×{r.qty}</span>)}</> : <small>이미 받은 보상입니다 · 최고 별 {reward.stars}개</small>}
                  {reward.coreUnlocked && <strong className="core">코어 슬롯 1 해금</strong>}</div>
              )}
              {s.result === 'win' && !reward && <p className="hint">이전 노드를 먼저 완료해야 보상과 별이 기록됩니다.</p>}
              {s.result === 'lose' && <p className="hint">TIP · {HINT[node.id]}</p>}
              <div className="cb-dmg">{allies.map((u) => { const top = Math.max(1, ...allies.map((a) => a.dealt)); return <div key={u.id}><img src={`ref/battle/face-${u.kind}.webp`} alt="" /><b>{u.name}</b><span><i style={{ width: `${(u.dealt / top) * 100}%` }} /></span><em className="num-tab">{u.dealt.toLocaleString()}</em>{u.healed > 0 && <small>회복 {u.healed.toLocaleString()}</small>}</div> })}</div>
              <div className="btns">
                {s.result === 'win'
                  ? <button type="button" className="primary" autoFocus onClick={() => { audio.sfx('tap'); if (node.post?.length) setPhase('post'); else nav.back() }}>계속</button>
                  : <button type="button" className="primary" autoFocus onClick={() => { audio.sfx('tap'); restart() }}>다시 도전</button>}
                {s.result === 'win' && <button type="button" onClick={() => { audio.sfx('tap'); restart() }}>다시 하기</button>}
                <button type="button" onClick={() => { audio.sfx('tap'); nav.back() }}>사건 파일로</button>
              </div>
            </div>
          </div>
        )}
        {phase === 'pre' && <StoryScene bg={def.bg} lines={node.pre!} onDone={() => setPhase('intro')} label={`${node.no} 전투 전 대화`} dim={0.55} />}
        {phase === 'post' && <StoryScene bg={def.bg} lines={node.post!} onDone={() => nav.back()} label={`${node.no} 전투 후 대화`} dim={0.55} />}
      </RefStage>
    </div>
  )
}

function Mark({ u, focus, onFocus, tipped }: { u: Unit; focus: boolean; onFocus?: () => void; tipped: boolean }) {
  const hy = headY(u)
  const mx = stat(u, 'maxHp'); const k = u.hp / mx
  const tl = u.tele
  const big = u.kind === 'boss'
  return (
    <div className={`cb-mark ${u.side} k-${u.kind} ${focus ? 'focus' : ''} ${tipped ? 'tipped' : ''}`} style={{ left: u.x, top: hy }}>
      {!big && <span className="hp"><i style={{ width: `${k * 100}%` }} />{u.shield > 0 && <b style={{ width: `${Math.min(100, (u.shield / mx) * 100)}%` }} />}</span>}
      {u.icon && <em className={`icon ${u.icon}`} aria-hidden>{u.icon === 'device' ? '!' : '◎'}</em>}
      {tl && (tl.k === 'cast' || tl.k === 'call' || tl.k === 'noise') && <span className={`cast ${tl.k}`}><b>{tl.name}</b><i style={{ width: `${Math.min(1, tl.t / tl.dur) * 100}%` }} />{tl.need < Infinity && <s style={{ width: `${Math.min(1, tl.acc / tl.need) * 100}%` }} />}</span>}
      {u.stun > 0 && <span className="stun" aria-hidden>✦ ✦</span>}
      {u.vuln > 0 && <span className="vuln">무력화</span>}
      {onFocus && <button type="button" className="hit" style={{ height: Math.max(80, u.y - hy + 10), width: big ? 260 : u.kind === 'mite' ? 90 : 120 }} aria-label={`${u.name}${focus ? ' 집중 공격 해제' : ' 집중 공격'}`} aria-pressed={focus} onClick={onFocus} />}
    </div>
  )
}

function Card({ u, i, s, onAct, onBuff, tipped }: { u: Unit; i: number; s: Sim; onAct: () => void; onBuff: () => void; tipped: boolean }) {
  const ab = s.abil[u.id]
  const down = !!u.dead
  const aReady = ab.a.left === 0 && !down && !s.result
  const bReady = ab.b.left === 0 && !down && !s.result
  const mx = stat(u, 'maxHp')
  const start = useRef<{ y: number; id: number; swiped: boolean } | null>(null)
  const [lift, setLift] = useState(0)
  const info = ABILITY_INFO[u.kind as AllyKind]
  const pd = (e: RPE) => { start.current = { y: e.clientY, id: e.pointerId, swiped: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }
  const pm = (e: RPE) => { const st = start.current; if (!st) return; const dy = st.y - e.clientY; setLift(Math.max(0, Math.min(60, dy))); if (dy > 45 && !st.swiped) { st.swiped = true; onBuff() } }
  const pu = () => { const st = start.current; start.current = null; setLift(0); if (st && !st.swiped) onAct() }
  return (
    <div className={`cb-card ${down ? 'down' : ''} ${aReady ? 'ready' : ''} ${ab.b.on > 0 ? 'buffing' : ''} ${tipped ? 'tipped' : ''} ${u.task ? 'busy' : ''}`} style={{ '--i': i, '--lift': `${-lift}px` } as CSSProperties}>
      <div className="face-hit" role="button" tabIndex={-1} aria-hidden onPointerDown={pd} onPointerMove={pm} onPointerUp={pu} onPointerCancel={() => { start.current = null; setLift(0) }}>
        <img className="face" src={`ref/battle/face-${u.kind}.webp`} alt="" draggable={false} />
        <b className="name">{u.name}</b>
        <span className="hp num-tab">{Math.ceil(u.hp)} / {mx}</span>
        <span className="bar"><i style={{ width: `${(u.hp / mx) * 100}%` }} />{u.shield > 0 && <b style={{ width: `${Math.min(100, (u.shield / mx) * 100)}%` }} />}</span>
      </div>
      <button type="button" className="act" disabled={!aReady} onClick={onAct} aria-label={`액티브 ${info.active[0]} (${i + 1}) · ${info.active[1]}${aReady ? ' · 사용 가능' : ` · ${Math.ceil(ab.a.left)}초 남음`}`}>
        <img src={`ref/battle/skill-${u.kind}.webp`} alt="" draggable={false} />
        {!aReady && <i className="cool" style={{ '--p': `${(ab.a.left / ab.a.cd) * 360}deg` } as CSSProperties} />}
        {!aReady && !down && <em className="num-tab">{Math.ceil(ab.a.left)}</em>}
      </button>
      <button type="button" className={`buff ${bReady ? 'ready' : ''}`} disabled={!bReady} onClick={onBuff} aria-label={`버프 ${info.buff[0]} (${BUFF_KEYS[i].toUpperCase()}) · ${info.buff[1]}${bReady ? ' · 사용 가능' : ab.b.on > 0 ? ` · 지속 ${Math.ceil(ab.b.on)}초` : ` · ${Math.ceil(ab.b.left)}초 남음`}`}>
        <i style={{ width: `${ab.b.on > 0 ? (ab.b.on / ab.b.dur) * 100 : (1 - ab.b.left / ab.b.cd) * 100}%` }} /><span>{ab.b.on > 0 ? `${info.buff[0]} ${Math.ceil(ab.b.on)}s` : bReady ? `▲ ${info.buff[0]}` : `${info.buff[0]} ${Math.ceil(ab.b.left)}`}</span>
      </button>
    </div>
  )
}
