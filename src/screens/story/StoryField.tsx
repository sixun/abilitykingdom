import { useEffect, useReducer, useRef, useState, type PointerEvent as RPE } from 'react'
import '../../styles/explore.css'
import { useNav } from '../../app/nav'
import { audio } from '../../app/audio'
import { RefStage } from '../../ui/ref'
import { useReduceMotion, useScreenActive } from '../../ui/motion'
import { useGame } from '../../game/store'
import { CHAR_BY_ID } from '../../game/data/characters'
import { ExploreRenderer, SPRITES, DIRS, type Actor, type Dir } from '../../explore/ExploreRenderer'
import { ACADEMY, type Line, type Zone } from '../../explore/zones'

// 스토리 탐색(2.5D): 끊김 없는 구역 이동 · 8방향 걷기/달리기 · NPC 대화 · 조사 · 대원 교체 · 미니맵 · 진입 연출
// 조작: 왼쪽 아래 조이스틱(끌기) 또는 WASD·방향키, Shift=달리기, E/Space=대화·조사, Tab=대원 교체
const PLAYABLE = ['seren', 'ian'] as const
type Playable = typeof PLAYABLE[number]
const WALK = 320, RUN = 560, NEAR = 260

export default function StoryField({ params }: { params: Record<string, unknown> }) {
  const nav = useNav()
  const gs = useGame()
  const active = useScreenActive()
  const reduce = useReduceMotion()
  const zone: Zone = ACADEMY
  void params
  const canvas = useRef<HTMLCanvasElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const rd = useRef<ExploreRenderer | null>(null)
  const [, tick] = useReducer((n: number) => n + 1, 0)
  const [load, setLoad] = useState(0)
  const [glErr, setGlErr] = useState(false)
  const [who, setWho] = useState<Playable>('seren')
  const [run, setRun] = useState(false)
  const [phase, setPhase] = useState<'load' | 'intro' | 'title' | 'play'>('load')
  const [talk, setTalk] = useState<{ title: string; lines: Line[]; i: number } | null>(null)
  const [clues, setClues] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [place, setPlace] = useState(zone.place)
  const [banner, setBanner] = useState<{ name: string; n: number } | null>(null)
  const seen = useRef(new Set<string>([zone.place]))
  const me = useRef<Actor>({ id: 'me', kind: 'seren', x: zone.start.x, y: zone.start.y, dir: 'S', moving: false, run: false, t: 0 })
  const npcs = useRef<Actor[]>(zone.npcs.map((n) => ({ id: n.id, kind: n.id.includes('girl') ? 'npc' : 'npc-s', img: n.img, x: n.x, y: n.y, dir: 'S', moving: false, run: false, t: Math.random() * 5 })))
  const keys = useRef(new Set<string>())
  const stick = useRef<{ id: number; ox: number; oy: number; dx: number; dy: number } | null>(null)
  const cam = useRef({ x: zone.intro.x, y: zone.intro.y, z: zone.intro.z })
  const cfg = useRef({ active, phase, talk, run, reduce }); cfg.current = { active, phase, talk, run, reduce }
  const stepPhase = useRef(0)
  const frames = useRef(0)
  const placeRef = useRef(zone.place)

  // 렌더러 준비
  useEffect(() => {
    if (!canvas.current) return
    let r: ExploreRenderer
    try { r = new ExploreRenderer(canvas.current) } catch { setGlErr(true); return }
    rd.current = r
    r.quality = gs.settings.quality === 'low' ? 'low' : 'high'
    r.load(zone, PLAYABLE.filter((k) => SPRITES[k]), zone.npcs.map((n) => n.img), r.quality === 'low', setLoad, [zone.start, zone.intro])
      .then(() => { setLoad(1); setPhase('intro') }).catch(() => setGlErr(true))
    audio.preload(['step', 'title', 'whoosh', 'select', 'swap', 'open', 'coin', 'save'])
    const prevBgm = audio.currentBgm
    audio.bgm(zone.bgm); audio.ambience(zone.amb, 0.55) // 음악이 있으니 환경음은 낮춘다
    return () => { r.dispose(); audio.ambience(''); audio.bgm(prevBgm === zone.bgm ? 'lobby' : prevBgm) }
  }, [])

  // 진입 연출: 정문을 비추다 → 대원 쪽으로 카메라가 내려오고 → 장소 이름이 찍힌다
  useEffect(() => {
    if (phase !== 'intro') return
    if (reduce) { cam.current = { x: me.current.x, y: me.current.y - 120, z: 0.5 }; setPhase('title'); return }
    audio.sfx('whoosh')
    const id = setTimeout(() => setPhase('title'), 2300)
    return () => clearTimeout(id)
  }, [phase])
  useEffect(() => {
    if (phase !== 'title') return
    audio.sfx('title')
    const id = setTimeout(() => setPhase('play'), reduce ? 600 : 2600)
    return () => clearTimeout(id)
  }, [phase])

  const nearest = () => {
    const m = me.current
    const n = zone.npcs.map((x) => ({ kind: 'npc' as const, x, d: Math.hypot(x.x - m.x, (x.y - m.y) * 1.4) })).sort((a, b) => a.d - b.d)[0]
    const s = zone.spots.map((x) => ({ kind: 'spot' as const, x, d: Math.hypot(x.x - m.x, (x.y - m.y) * 1.4) - x.r + NEAR })).sort((a, b) => a.d - b.d)[0]
    const best = [n, s].filter((v) => v && v.d < NEAR).sort((a, b) => a.d - b.d)[0]
    return best ?? null
  }
  const interact = () => {
    if (cfg.current.phase !== 'play') return
    if (cfg.current.talk) { nextLine(); return }
    const t = nearest(); if (!t) return
    audio.sfx('open')
    if (t.kind === 'npc') {
      const n = t.x as typeof zone.npcs[number]
      const npc = npcs.current.find((a) => a.id === n.id); if (npc) npc.dir = me.current.x < npc.x ? 'SW' : 'SE'
      setTalk({ title: n.name, lines: n.lines, i: 0 })
    } else {
      const s = t.x as typeof zone.spots[number]
      setTalk({ title: s.label, lines: s.lines, i: 0 })
      if (s.clue && !clues.includes(s.clue)) { setClues((c) => [...c, s.clue!]); setTimeout(() => { audio.sfx('coin'); setToast(`단서 획득 · ${s.clue}`) }, 400) }
    }
  }
  const nextLine = () => {
    audio.sfx('tap')
    setTalk((tk) => (tk && tk.i + 1 < tk.lines.length ? { ...tk, i: tk.i + 1 } : null))
  }
  const swap = (k: Playable) => {
    if (k === who) return
    audio.sfx('swap')
    setWho(k); me.current.kind = k; me.current.flash = 1
  }
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(null), 2200); return () => clearTimeout(id) } }, [toast])

  // 키보드
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.current.add(k); e.preventDefault() }
      if (k === 'shift') setRun(true)
      if (k === 'e' || k === ' ' || k === 'enter') { e.preventDefault(); interact() }
      if (k === 'tab') { e.preventDefault(); swap(who === 'seren' ? 'ian' : 'seren') }
      if (k === 'escape' && !cfg.current.talk) nav.back()
    }
    const up = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); keys.current.delete(k); if (k === 'shift') setRun(false) }
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  })

  // 한 프레임: 입력 → 이동(걷기 영역 밖으로는 미끄러지듯 막힘) → 카메라 → 그리기
  useEffect(() => {
    let raf = 0, last = performance.now(), t = 0
    const f = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt
      const c = cfg.current; const r = rd.current; const m = me.current
      if (c.active && r?.ready) {
        let ix = 0, iy = 0
        if (c.phase === 'play' && !c.talk) {
          const K = keys.current
          ix = (K.has('d') || K.has('arrowright') ? 1 : 0) - (K.has('a') || K.has('arrowleft') ? 1 : 0)
          iy = (K.has('s') || K.has('arrowdown') ? 1 : 0) - (K.has('w') || K.has('arrowup') ? 1 : 0)
          if (stick.current) { const s = stick.current; const L = Math.hypot(s.dx, s.dy); if (L > 10) { ix = s.dx / Math.max(L, 60); iy = s.dy / Math.max(L, 60) } }
        }
        const mag = Math.min(1, Math.hypot(ix, iy))
        m.moving = mag > 0.15
        m.run = c.run || mag > 0.98 && !!stick.current
        if (m.moving) {
          const ang = Math.atan2(iy, ix)
          m.dir = DIRS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8] as Dir
          const sp = (m.run ? RUN : WALK) * Math.max(0.5, mag) * dt
          const nx = m.x + Math.cos(ang) * sp, ny = m.y + Math.sin(ang) * sp * 0.82
          if (r.walkable(nx, ny)) { m.x = nx; m.y = ny }
          else if (r.walkable(nx, m.y)) m.x = nx
          else if (r.walkable(m.x, ny)) m.y = ny
          // 발소리: 걷기 한 주기에 두 번
          const ph = (m.t * (m.run ? 1.7 : 1) / 1.333) * 2
          if (Math.floor(ph) !== Math.floor(stepPhase.current)) audio.sfx('step', m.run ? 1 : 0.7)
          stepPhase.current = ph
        }
        m.t += dt
        // 구역 이름: 새 장소에 처음 들어서면 이름이 뜬다
        if (c.phase === 'play') {
          const rg = zone.regions.find((g) => m.x >= g.x0 && m.x < g.x1 && m.y >= g.y0 && m.y < g.y1)
          if (rg && rg.name !== placeRef.current) {
            placeRef.current = rg.name; setPlace(rg.name)
            if (!seen.current.has(rg.name)) { seen.current.add(rg.name); setBanner((b) => ({ name: rg.name, n: (b?.n ?? 0) + 1 })); audio.sfx('whoosh') }
          }
        }
        if (m.flash) m.flash = Math.max(0, m.flash - dt * 3)
        for (const n of npcs.current) n.t += dt
        // 카메라
        const k = c.phase === 'intro' ? 1.3 : 5
        const tz = c.phase === 'intro' ? 0.5 : 0.5
        const want = c.phase === 'intro' || c.phase === 'title' || c.phase === 'play' ? { x: m.x, y: m.y - 130 } : { x: cam.current.x, y: cam.current.y }
        const cm = cam.current
        cm.x += (want.x - cm.x) * Math.min(1, dt * k); cm.y += (want.y - cm.y) * Math.min(1, dt * k); cm.z += (tz - cm.z) * Math.min(1, dt * (c.phase === 'intro' ? 1.1 : 4))
        const hw = 640 / cm.z, hh = 360 / cm.z
        cm.x = Math.max(hw, Math.min(zone.W - hw, cm.x)); cm.y = Math.max(hh, Math.min(zone.H - hh, cm.y))
        r.view = { ...cm }
        if (host.current) { const b = host.current.getBoundingClientRect(); r.resize(b.width, window.devicePixelRatio || 1) }
        r.render([m, ...npcs.current], t, dt)
        frames.current++
        tick()
      }
      raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => { (window as unknown as { __EX__: unknown }).__EX__ = { frames: () => frames.current, me: () => me.current, phase: () => cfg.current.phase, set: (x: number, y: number, d?: Dir) => { me.current.x = x; me.current.y = y; if (d) me.current.dir = d }, walkable: (x: number, y: number) => rd.current?.walkable(x, y), swap, setPhase, interact } })

  // 조이스틱
  const sDown = (e: RPE<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); const b = e.currentTarget.getBoundingClientRect(); stick.current = { id: e.pointerId, ox: b.left + b.width / 2, oy: b.top + b.height / 2, dx: 0, dy: 0 }; sMove(e) }
  const sMove = (e: RPE<HTMLDivElement>) => { const s = stick.current; if (!s || s.id !== e.pointerId) return; const sc = e.currentTarget.getBoundingClientRect().width / 220; s.dx = (e.clientX - s.ox) / sc; s.dy = (e.clientY - s.oy) / sc }
  const sUp = () => { stick.current = null }

  const m = me.current
  const near = phase === 'play' && !talk ? nearest() : null
  const r = rd.current
  const toScreen = (x: number, y: number) => r ? { left: (x - r.view.x) * r.view.z + 640, top: (y - r.view.y) * r.view.z + 360 } : { left: -999, top: -999 }
  const st = stick.current
  const knob = st ? (() => { const L = Math.hypot(st.dx, st.dy), k = Math.min(1, 70 / Math.max(1, L)); return { x: st.dx * k, y: st.dy * k } })() : { x: 0, y: 0 }
  const owned = (k: string) => !!gs.owned[k]

  return (
    <div className="scr story-field">
      <RefStage canvas={{ width: 1280, height: 720 }} className={`sf ${reduce ? 'ui-reduced' : ''} ph-${phase} ${talk ? 'talking' : ''}`}>
        <div className="sf-gl" ref={host}><canvas ref={canvas} width={1280} height={720} aria-label={`${zone.area} ${zone.place} 탐색 화면`} /></div>
        {glErr && <div className="sf-err">이 기기에서는 탐색 화면(WebGL2)을 그릴 수 없습니다.</div>}
        {phase === 'load' && !glErr && <div className="sf-load"><b>{zone.area}</b><i><em style={{ width: `${Math.round(load * 100)}%` }} /></i></div>}

        {/* NPC 머리 위 말풍선 · 조사 표시 */}
        {phase === 'play' && zone.npcs.map((n) => <i key={n.id} className={`sf-bubble ${near?.x === n ? 'on' : ''}`} style={toScreen(n.x, n.y - zone.charH - 40)} aria-hidden>···</i>)}
        {phase === 'play' && zone.spots.filter((s) => s.kind === 'look').map((s) => <i key={s.id} className={`sf-spot ${clues.includes(s.clue ?? '') ? 'done' : ''} ${near?.x === s ? 'on' : ''}`} style={toScreen(s.x, s.y - 240)} aria-hidden />)}
        {near && <div className="sf-hint" style={toScreen(m.x, m.y - zone.charH - 70)}>{near.kind === 'npc' ? '대화' : (near.x as { label: string }).label}</div>}

        {/* 진입 연출: 위아래 검은 띠 + 장소 이름 */}
        <i className="sf-letter top" aria-hidden /><i className="sf-letter bot" aria-hidden />
        {phase === 'title' && <div className="sf-title" role="status"><small>{zone.areaEn}</small><b>{zone.place}</b><span>{zone.area}</span></div>}

        <div className="sf-hud">
          <div className="sf-top">
            <button type="button" className="sf-back" onClick={() => { audio.sfx('tap'); nav.back() }} aria-label="뒤로">‹</button>
            <div className="sf-loc"><i aria-hidden>◆</i>{zone.area} - {place}</div>
          </div>
          <div className="sf-quest"><small>{zone.quest.title}</small><b>{zone.quest.goal}</b><span>단서 {clues.length} / {zone.spots.filter((s) => s.clue).length}</span></div>
          <div className="sf-party" role="group" aria-label="탐색 대원">
            {PLAYABLE.filter((k) => SPRITES[k]).map((k) => (
              <button key={k} type="button" className={k === who ? 'on' : ''} aria-pressed={k === who} onClick={() => swap(k)}>
                <img src={`ref/battle/face-${k}.webp`} alt="" /><b>{CHAR_BY_ID[k]?.name ?? k}</b>{!owned(k) && <em>체험</em>}
              </button>
            ))}
          </div>
          <Minimap zone={zone} me={m} npcs={zone.npcs} img={`${zone.dir}/low.webp`} view={r?.view} />

          <div className="sf-stick" onPointerDown={sDown} onPointerMove={sMove} onPointerUp={sUp} onPointerCancel={sUp} aria-label="이동 조이스틱(키보드: WASD·방향키)">
            <i style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
          </div>
          <div className="sf-acts">
            <button type="button" className={`run ${run ? 'on' : ''}`} aria-pressed={run} aria-label="달리기(Shift)" onClick={() => { audio.sfx('select'); setRun((v) => !v) }}><RunIcon /></button>
            <button type="button" className={`talk ${near?.kind === 'npc' ? 'ready' : ''}`} aria-label="대화(E)" disabled={near?.kind !== 'npc'} onClick={interact}><TalkIcon /></button>
            <button type="button" className={`look ${near?.kind === 'spot' ? 'ready' : ''}`} aria-label="조사(E)" disabled={near?.kind !== 'spot'} onClick={interact}><LookIcon /></button>
          </div>
        </div>

        {talk && (
          <button type="button" className="sf-talk" onClick={nextLine} aria-label="다음 대사">
            <small>{talk.lines[talk.i].who ?? talk.title}</small>
            <p>{talk.lines[talk.i].text}</p>
            <i aria-hidden>▼</i>
          </button>
        )}
        {toast && <div className="sf-toast" role="status">{toast}</div>}
        {banner && <div className="sf-region" key={banner.n} role="status" onAnimationEnd={() => setBanner(null)}><small>{zone.areaEn}</small><b>{banner.name}</b></div>}
      </RefStage>
    </div>
  )
}

function Minimap({ zone, me, npcs, img, view }: { zone: Zone; me: Actor; npcs: Zone['npcs']; img: string; view?: { x: number; y: number; z: number } }) {
  const K = 0.072 // 미니맵 배율(월드 1px → 0.072px)
  return (
    <div className="sf-mini" aria-label="미니맵">
      <div className="sf-mini-in" style={{ transform: `translate(${Math.min(0, Math.max(260 - zone.W * K, -me.x * K + 130))}px, ${Math.min(0, Math.max(190 - zone.H * K, -me.y * K + 95))}px)` }}>
        <img src={img} alt="" style={{ width: zone.W * K }} />
        {view && <i className="cam" style={{ left: (view.x - 640 / view.z) * K, top: (view.y - 360 / view.z) * K, width: 1280 / view.z * K, height: 720 / view.z * K }} />}
        {npcs.map((n) => <i key={n.id} className="npc" style={{ left: n.x * K, top: n.y * K }} />)}
        {zone.spots.map((s) => <i key={s.id} className={`spot ${s.kind}`} style={{ left: s.x * K, top: s.y * K }} />)}
        <i className="me" style={{ left: me.x * K, top: me.y * K }} />
      </div>
      <b>{zone.area} 1-1</b>
    </div>
  )
}
const RunIcon = () => <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden><circle cx="15" cy="4" r="2.2" /><path d="M10 8.5l4-1 3 3 3 .5-.4 1.9-3.8-.7-1.6-1.6-1 3.6 2.6 2.4-1 5.4h-2l.8-4.4-2.6-2-1.4 3.4-4.6 1.2-.5-1.9 3.6-1 2-6.2-1.6.4-1.4 2.6-1.8-.9z" /></svg>
const TalkIcon = () => <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden><path d="M12 4C6.5 4 2.5 7.4 2.5 11.6c0 2.2 1.1 4.2 3 5.6L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 9.5-3.4 9.5-7.6S17.5 4 12 4z" /><circle cx="8" cy="11.6" r="1.3" fill="#1d2230" /><circle cx="12" cy="11.6" r="1.3" fill="#1d2230" /><circle cx="16" cy="11.6" r="1.3" fill="#1d2230" /></svg>
const LookIcon = () => <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5.5 5.5" /></svg>
