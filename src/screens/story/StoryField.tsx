import { useEffect, useMemo, useReducer, useRef, useState, type PointerEvent as RPE } from 'react'
import '../../styles/explore.css'
import { useNav } from '../../app/nav'
import { audio } from '../../app/audio'
import { RefStage } from '../../ui/ref'
import { Cine, type Shot } from '../../ui/cine/Cine'
import { useReduceMotion, useScreenActive } from '../../ui/motion'
import { useGame } from '../../game/store'
import { CHAR_BY_ID } from '../../game/data/characters'
import { ExploreRenderer, SPRITES, DIRS, type Actor, type Dir } from '../../explore/ExploreRenderer'
import { ACADEMY, type Line, type Zone } from '../../explore/zones'
import { CHAPTER1 } from '../../game/story/chapter1'
import { STAGES } from '../../game/combat/chapter1Stages'
import { game } from '../../game/store'
import StoryScene from '../case/StoryScene'

// 화면을 떠났다 돌아올 때(전투 다녀오기) 이어서 시작하려고 기억해 두는 필드 상태(앱을 켜 둔 동안만)
type Memo = { x: number; y: number; dir: Dir; who: string; clues: string[]; seen: string[]; place: string; away?: { id: string; x: number; y: number } }
const MEMO: Record<string, Memo> = {}

// 스토리 탐색(2.5D): 끊김 없는 구역 이동 · 8방향 걷기/달리기 · NPC 대화 · 조사 · 대원 교체 · 미니맵 · 진입 연출
// 조작: 왼쪽 아래 조이스틱(끌기) 또는 WASD·방향키, Shift=달리기, E/Space=대화·조사, Tab=대원 교체
const PLAYABLE = ['seren', 'ian'] as const
type Playable = typeof PLAYABLE[number]
// 캐릭터 키를 배경 물체(벤치·가로등·계단)에 맞춘 뒤 카메라를 당겼다: 화면 속 캐릭터 크기는 그대로, 배경이 커 보인다
const CAM_Z = 0.74
const WALK = 230, RUN = 400, NEAR = 200

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
  const memo = MEMO[zone.id]
  const [who, setWho] = useState<Playable>((memo?.who as Playable) ?? 'seren')
  const [run, setRun] = useState(false)
  const [phase, setPhase] = useState<'load' | 'intro' | 'play'>('load')
  const [talk, setTalk] = useState<{ title: string; lines: Line[]; i: number } | null>(null)
  const [clues, setClues] = useState<string[]>(memo?.clues ?? [])
  const [toast, setToast] = useState<string | null>(null)
  const [place, setPlace] = useState(memo?.place ?? zone.place)
  const [banner, setBanner] = useState<{ r: Zone['regions'][number]; n: number } | null>(null)
  const [ticker, setTicker] = useState(false)
  // 연출 카메라: wide = 처음 보여 줄 곳 고정, drift = 천천히 밀고 들어감, follow = 대원에게 돌진(이후 따라감)
  const camMode = useRef<'wide' | 'drift' | 'follow'>('wide')
  const fxv = useRef({ rush: 0, flash: 0 })
  const seen = useRef(new Set<string>(memo?.seen ?? [zone.place]))
  const me = useRef<Actor>({ id: 'me', kind: memo?.who ?? 'seren', x: memo?.x ?? zone.start.x, y: memo?.y ?? zone.start.y, dir: memo?.dir ?? 'S', moving: false, run: false, t: 0 })
  const npcs = useRef<Actor[]>(zone.npcs.map((n) => ({ id: n.id, kind: n.id.includes('girl') ? 'npc' : 'npc-s', img: n.img, x: n.x, y: n.y, dir: 'S', moving: false, run: false, t: Math.random() * 5 })))
  const keys = useRef(new Set<string>())
  const stick = useRef<{ id: number; ox: number; oy: number; dx: number; dy: number } | null>(null)
  const cam = useRef({ x: zone.intro.x, y: zone.intro.y, z: zone.intro.z })
  const cfg = useRef({ active, phase, talk, run, reduce }); cfg.current = { active, phase, talk, run, reduce }
  const evRef = useRef<{ x: number; y: number; r: number; n: NonNullable<ReturnType<typeof CHAPTER1.nodes.find>> } | null>(null)
  const stepPhase = useRef(0)
  const frames = useRef(0)
  const placeRef = useRef(memo?.place ?? zone.place)
  // 사건 진행: 1장 노드를 순서대로. 다음 노드 하나만 필드에 표시된다
  const stars = gs.content.caseFile?.stars ?? {}
  const next = CHAPTER1.nodes.find((n) => !stars[n.id] && zone.events[n.id])
  const nextEv = next ? zone.events[next.id] : null
  const [enc, setEnc] = useState<typeof next | null>(null)        // 조우 연출 중인 노드
  const [scene, setScene] = useState<typeof next | null>(null)    // 필드 위에서 여는 이야기·조사 장면
  const [gateFade, setGateFade] = useState(false)
  const busy = useRef(false)
  const save = (extra?: Partial<Memo>) => { const m = me.current; MEMO[zone.id] = { x: m.x, y: m.y, dir: m.dir, who: m.kind, clues, seen: [...seen.current], place: placeRef.current, ...extra } }

  // 렌더러 준비
  useEffect(() => {
    if (!canvas.current) return
    let r: ExploreRenderer
    try { r = new ExploreRenderer(canvas.current) } catch { setGlErr(true); return }
    rd.current = r
    r.quality = gs.settings.quality === 'low' ? 'low' : 'high'
    r.load(zone, PLAYABLE.filter((k) => SPRITES[k]), zone.npcs.map((n) => n.img), r.quality === 'low', setLoad, memo ? [memo] : [zone.start, zone.intro])
      .then(() => {
        setLoad(1)
        if (!memo) { setPhase('intro'); return }
        // 전투 등에서 돌아옴: 연출 없이 그 자리에서 이어서. 끝내지 못한 사건이면 한 걸음 물러서 바로 다시 걸리지 않게
        camMode.current = 'follow'
        const a = memo.away
        if (a && !(game.getState().content.caseFile?.stars ?? {})[a.id]) {
          const m = me.current; const dx = m.x - a.x, dy = m.y - a.y, L = Math.hypot(dx, dy) || 1
          for (let k = 360; k >= 0; k -= 20) { const nx = a.x + dx / L * (L + k), ny = a.y + dy / L * (L + k); if (r.walkable(nx, ny)) { m.x = nx; m.y = ny; break } }
        }
        cam.current = { x: me.current.x, y: me.current.y - 95, z: CAM_Z }
        setPhase('play')
      }).catch(() => setGlErr(true))
    audio.preload(['step', 'title', 'whoosh', 'select', 'swap', 'open', 'coin', 'save', 'shutter', 'boss_slam', 'slam'])
    const prevBgm = audio.currentBgm
    audio.bgm(zone.bgm); audio.ambience(zone.amb, 0.55) // 음악이 있으니 환경음은 낮춘다
    return () => { r.dispose(); audio.ambience(''); audio.bgm(prevBgm === zone.bgm ? 'lobby' : prevBgm) }
  }, [])

  // 진입 연출(시네마틱 타이포): 암전 → 넓은 화면 위 장 제목 블록 → 거대한 구역 이름과 함께 카메라가 대원에게 돌진 → 단색 카드 → 위아래 띠
  const entry = useMemo<Shot[]>(() => [
    { k: 'black', d: 0.45, sfx: 'whoosh' },
    { k: 'stack', d: 1.7, lines: [`CHAPTER ${zone.chapter.no}`, ...zone.chapter.en], sub: zone.chapter.title, sfx: 'shutter' },
    { k: 'mono', d: 1.3, text: zone.areaEn.split(' ')[0], kicker: 'ABILITY KINGDOM · STORY', sub: zone.area, sfx: 'boss_slam' },
    { k: 'card', d: 1.05, big: zone.chapter.no, mid: 'CHAPTER', sub: zone.placeEn.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), bg: zone.chapter.card.bg, ink: zone.chapter.card.ink, sfx: 'shutter' },
  ], [])
  const onEntryShot = (i: number) => {
    if (i === 1) camMode.current = 'drift'
    if (i === 2) { camMode.current = 'follow'; fxv.current = { rush: 1, flash: 0.55 } }
  }
  const startPlay = () => {
    camMode.current = 'follow'
    setPhase('play'); setTicker(true)
  }

  evRef.current = next && nextEv ? { ...nextEv, n: next } : null
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
      if (s.kind === 'gate' && s.to) { goThrough(s.to); return }
      setTalk({ title: s.label, lines: s.lines, i: 0 })
      if (s.clue && !clues.includes(s.clue)) { setClues((c) => [...c, s.clue!]); setTimeout(() => { audio.sfx('coin'); setToast(`단서 획득 · ${s.clue}`) }, 400) }
    }
  }
  // 문 통과: 화면을 덮었다가 반대편에서 연다(닫힌 철문을 걸어서 뚫고 지나가지 않게)
  const goThrough = (to: { x: number; y: number }) => {
    if (busy.current) return
    busy.current = true; audio.sfx('shutter'); setGateFade(true)
    setTimeout(() => { const m = me.current; m.x = to.x; m.y = to.y; cam.current = { x: to.x, y: to.y - 95, z: CAM_Z } }, 420)
    setTimeout(() => { setGateFade(false); busy.current = false }, 900)
  }
  // 사건 조우: 연출 → 전투 화면(다녀오면 같은 자리) / 이야기·조사는 필드 위에서 바로
  const startEvent = (n: NonNullable<typeof next>) => {
    busy.current = true; stick.current = null; keys.current.clear()
    if (STAGES[n.id]) { setEnc(n); return }
    setScene(n)
  }
  const encShots = (n: NonNullable<typeof next>): Shot[] => [
    { k: 'black', d: 0.25, sfx: 'whoosh' },
    { k: 'stack', d: 1.2, lines: ['INCIDENT', `${CHAPTER1.no} — ${n.no}`], sub: `${n.title} · ${n.place}`, at: 'bl', sfx: 'shutter' },
    { k: 'mono', d: 1.1, text: n.kind === 'boss' ? 'STATIC' : 'ENGAGE', kicker: `${CHAPTER1.no} · ${n.no}`, sub: n.title, sfx: 'boss_slam', tint: n.kind === 'boss' ? '#ff4d5e' : '#c8f53b' },
  ]
  const toBattle = (n: NonNullable<typeof next>) => {
    save({ away: { id: n.id, x: zone.events[n.id].x, y: zone.events[n.id].y } })
    setEnc(null); busy.current = false
    nav.push('caseBattle', { node: n.id })
  }
  const finishScene = async () => {
    const n = scene!; setScene(null); busy.current = false
    await game.clearCaseNode(n.id, 1); audio.sfx('save'); setToast(`사건 진행 · ${n.no} ${n.title}`)
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
      if (k === 'escape' && !cfg.current.talk && !busy.current) { delete MEMO[zone.id]; nav.back() }
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
        if (c.phase === 'play' && !c.talk && !busy.current) {
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
            if (!seen.current.has(rg.name)) { seen.current.add(rg.name); setBanner((b) => ({ r: rg, n: (b?.n ?? 0) + 1 })); fxv.current.flash = 0.25 }
          }
        }
        // 사건 자리에 들어서면 조우
        const ev = evRef.current
        if (c.phase === 'play' && !c.talk && !busy.current && ev && Math.hypot(m.x - ev.x, (m.y - ev.y) * 1.4) < ev.r) startEvent(ev.n)
        if (m.flash) m.flash = Math.max(0, m.flash - dt * 3)
        for (const n of npcs.current) n.t += dt
        // 카메라
        const mode = c.phase === 'play' ? 'follow' : c.phase === 'load' ? 'wide' : camMode.current
        const k = mode === 'wide' ? 0 : mode === 'drift' ? 0.5 : c.phase === 'play' ? 5 : 7.5
        const tz = mode === 'follow' ? CAM_Z : zone.intro.z - (mode === 'drift' ? 0.07 : 0)
        const want = mode === 'follow' ? { x: m.x, y: m.y - 95 } : { x: zone.intro.x + 320, y: zone.intro.y + 150 }
        const cm = cam.current
        cm.x += (want.x - cm.x) * Math.min(1, dt * k); cm.y += (want.y - cm.y) * Math.min(1, dt * k); cm.z += (tz - cm.z) * Math.min(1, dt * (mode === 'follow' ? 6 : 0.6))
        // 돌진 흐림·번쩍임은 빠르게 가라앉는다
        const fv = fxv.current; fv.rush *= Math.exp(-dt * 3.4); fv.flash *= Math.exp(-dt * 9)
        r.rush = c.reduce ? 0 : fv.rush; r.flash = c.reduce ? 0 : fv.flash
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

  useEffect(() => { (window as unknown as { __EX__: unknown }).__EX__ = { frames: () => frames.current, me: () => me.current, phase: () => cfg.current.phase, set: (x: number, y: number, d?: Dir) => { me.current.x = x; me.current.y = y; if (d) me.current.dir = d }, walkable: (x: number, y: number) => rd.current?.walkable(x, y), swap, setPhase, interact, next: () => evRef.current } })

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
      <RefStage canvas={{ width: 1280, height: 720 }} className={`sf ${reduce ? 'ui-reduced' : ''} ph-${phase} ${talk ? 'talking' : ''} ${ticker ? 'ticker-on' : ''}`}>
        <div className="sf-gl" ref={host}><canvas ref={canvas} width={1280} height={720} aria-label={`${zone.area} ${zone.place} 탐색 화면`} /></div>
        {glErr && <div className="sf-err">이 기기에서는 탐색 화면(WebGL2)을 그릴 수 없습니다.</div>}
        {phase === 'load' && !glErr && <div className="sf-load"><b>{zone.area}</b><i><em style={{ width: `${Math.round(load * 100)}%` }} /></i></div>}

        {/* NPC 머리 위 말풍선 · 조사 표시 */}
        {phase === 'play' && zone.npcs.map((n) => <i key={n.id} className={`sf-bubble ${near?.x === n ? 'on' : ''}`} style={toScreen(n.x, n.y - zone.charH - 40)} aria-hidden>···</i>)}
        {phase === 'play' && zone.spots.filter((s) => s.kind === 'look').map((s) => <i key={s.id} className={`sf-spot ${clues.includes(s.clue ?? '') ? 'done' : ''} ${near?.x === s ? 'on' : ''}`} style={toScreen(s.x, s.y - 240)} aria-hidden />)}
        {phase === 'play' && next && nextEv && <i className={`sf-ev ${next.kind}`} style={toScreen(nextEv.x, nextEv.y)} aria-hidden><b>{next.no}</b></i>}
        {near && <div className="sf-hint" style={toScreen(m.x, m.y - zone.charH - 70)}>{near.kind === 'npc' ? '대화' : (near.x as { label: string }).label}</div>}

        {/* 진입 연출: 위아래 검은 띠 + 장소 이름 */}
        <i className="sf-letter top" aria-hidden /><i className="sf-letter bot" aria-hidden />
        {phase === 'intro' && <Cine shots={entry} onShot={onEntryShot} onDone={startPlay} skippable reduce={reduce} />}
        {ticker && <Cine shots={[{ k: 'ticker', d: 3.4, top: `ABILITY KINGDOM — CHAPTER ${zone.chapter.no} — ${zone.chapter.en.join(' ')} —`, bot: `${zone.place} · ${zone.placeEn} · ${zone.area} · ${zone.areaEn} ·` }]} block={false} reduce={reduce} onDone={() => setTicker(false)} />}

        <div className="sf-hud">
          <div className="sf-top">
            <button type="button" className="sf-back" onClick={() => { audio.sfx('tap'); delete MEMO[zone.id]; nav.back() }} aria-label="뒤로">‹</button>
            <div className="sf-loc"><i aria-hidden>◆</i>{zone.area} - {place}</div>
          </div>
          <div className="sf-quest"><small>{zone.quest.title} · {CHAPTER1.no}</small><b>{next ? `${next.no} ${next.title}` : '1장 완료'}</b><span>{next && nextEv ? `${zone.regions.find((g) => nextEv.x >= g.x0 && nextEv.x < g.x1 && nextEv.y >= g.y0 && nextEv.y < g.y1)?.name ?? ''} — 지도의 ◆ 표시로 이동` : `단서 ${clues.length} / ${zone.spots.filter((s) => s.clue).length}`}</span></div>
          <div className="sf-party" role="group" aria-label="탐색 대원">
            {PLAYABLE.filter((k) => SPRITES[k]).map((k) => (
              <button key={k} type="button" className={k === who ? 'on' : ''} aria-pressed={k === who} onClick={() => swap(k)}>
                <img src={`ref/battle/face-${k}.webp`} alt="" /><b>{CHAR_BY_ID[k]?.name ?? k}</b>{!owned(k) && <em>체험</em>}
              </button>
            ))}
          </div>
          <Minimap zone={zone} me={m} npcs={zone.npcs} img={`${zone.dir}/low.webp`} view={r?.view} ev={nextEv} />

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
        {gateFade && <div className="sf-gatefade" aria-hidden />}
        {enc && <Cine shots={encShots(enc)} reduce={reduce} onDone={() => toBattle(enc)} />}
        {scene && <StoryScene bg={scene.bg} lines={scene.script ?? []} hotspots={scene.hotspots} outro={scene.outro} onDone={finishScene} label={`${scene.no} ${scene.title}`} dim={scene.kind === 'investigate' ? 0.15 : 0.45} relayAt={scene.kind === 'investigate' ? [560, 540] : undefined} />}
        {banner && <Cine key={banner.n} shots={[{ k: 'brutal', d: 1.8, text: banner.r.en, sub: banner.r.name, code: `${banner.r.code} // ${zone.areaEn}\n${zone.area} · ${banner.r.name}`, sfx: 'slam' }]} block={false} reduce={reduce} onDone={() => setBanner(null)} />}
      </RefStage>
    </div>
  )
}

function Minimap({ zone, me, npcs, img, view, ev }: { zone: Zone; me: Actor; npcs: Zone['npcs']; img: string; view?: { x: number; y: number; z: number }; ev?: { x: number; y: number } | null }) {
  const K = 0.072 // 미니맵 배율(월드 1px → 0.072px)
  return (
    <div className="sf-mini" aria-label="미니맵">
      <div className="sf-mini-in" style={{ transform: `translate(${Math.min(0, Math.max(260 - zone.W * K, -me.x * K + 130))}px, ${Math.min(0, Math.max(190 - zone.H * K, -me.y * K + 95))}px)` }}>
        <img src={img} alt="" style={{ width: zone.W * K }} />
        {view && <i className="cam" style={{ left: (view.x - 640 / view.z) * K, top: (view.y - 360 / view.z) * K, width: 1280 / view.z * K, height: 720 / view.z * K }} />}
        {npcs.map((n) => <i key={n.id} className="npc" style={{ left: n.x * K, top: n.y * K }} />)}
        {zone.spots.map((s) => <i key={s.id} className={`spot ${s.kind}`} style={{ left: s.x * K, top: s.y * K }} />)}
        {ev && <i className="ev" style={{ left: ev.x * K, top: ev.y * K }} />}
        <i className="me" style={{ left: me.x * K, top: me.y * K }} />
      </div>
      <b>{zone.area}</b>
    </div>
  )
}
const RunIcon = () => <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden><circle cx="15" cy="4" r="2.2" /><path d="M10 8.5l4-1 3 3 3 .5-.4 1.9-3.8-.7-1.6-1.6-1 3.6 2.6 2.4-1 5.4h-2l.8-4.4-2.6-2-1.4 3.4-4.6 1.2-.5-1.9 3.6-1 2-6.2-1.6.4-1.4 2.6-1.8-.9z" /></svg>
const TalkIcon = () => <svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden><path d="M12 4C6.5 4 2.5 7.4 2.5 11.6c0 2.2 1.1 4.2 3 5.6L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 9.5-3.4 9.5-7.6S17.5 4 12 4z" /><circle cx="8" cy="11.6" r="1.3" fill="#1d2230" /><circle cx="12" cy="11.6" r="1.3" fill="#1d2230" /><circle cx="16" cy="11.6" r="1.3" fill="#1d2230" /></svg>
const LookIcon = () => <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5.5 5.5" /></svg>
