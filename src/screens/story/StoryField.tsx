import { useEffect, useMemo, useReducer, useRef, useState, type PointerEvent as RPE } from 'react'
import '../../styles/explore.css'
import { useNav } from '../../app/nav'
import { audio } from '../../app/audio'
import { RefStage } from '../../ui/ref'
import { Cine, type Shot } from '../../ui/cine/Cine'
import { useReduceMotion, useScreenActive } from '../../ui/motion'
import { useGame, badges } from '../../game/store'
import { CHAR_BY_ID } from '../../game/data/characters'
import { ITEM_BY_ID } from '../../game/data/catalog'
import { statsOf, playerExpToNext, PLAYER_EXP } from '../../game/rules'
import type { OwnedCharacter } from '../../game/types'
import { FieldHud, type ChatLine, type ChatTab, type HudModel, type Marker } from './FieldHud'
import { ExploreRenderer, SPRITES, DIRS, type Actor, type Dir } from '../../explore/ExploreRenderer'
import { ACADEMY, ZONES, type Line, type Portal, type Zone } from '../../explore/zones'
import { CHAPTER1 } from '../../game/story/chapter1'
import { STAGES } from '../../game/combat/chapter1Stages'
import { game } from '../../game/store'
import StoryScene from '../case/StoryScene'

// 화면을 떠났다 돌아올 때(전투 다녀오기) 이어서 시작하려고 기억해 두는 필드 상태(앱을 켜 둔 동안만)
type Memo = { x: number; y: number; dir: Dir; who: string; clues: string[]; seen: string[]; place: string; away?: { id: string; x: number; y: number } }
const MEMO: Record<string, Memo> = {}
// 채팅 기록(맵을 옮겨도 이어지게 화면 밖에 둔다. 서버 연결 전이라 이 기기 안에서만)
const CHAT: ChatLine[] = []
const chatLog = (tab: ChatTab, text: string, who?: string) => { const last = CHAT[CHAT.length - 1]; if (last && last.text === text && last.who === who && Date.now() - last.at < 1500) return; CHAT.push({ tab, text, who, at: Date.now() }); if (CHAT.length > 120) CHAT.splice(0, CHAT.length - 120) }
/** 받침에 따라 (으)로 */
const ro = (w: string) => { const c = w.charCodeAt(w.length - 1); if (c < 0xac00 || c > 0xd7a3) return `${w}(으)로`; const j = (c - 0xac00) % 28; return w + (j === 0 || j === 8 ? '로' : '으로') }
const DIR_DEG: Record<Dir, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }
const ACTIVE_CD = 8, DODGE_CD = 2.5
// 맵을 옮겨도(화면이 새로 열려도) 이어지는 HUD 상태: 쿨타임·각성 게이지·버프·탈것·채팅창·알림판
const KEEP = { act: null as null | Record<string, unknown>, mounted: false, questShow: true, chatSmall: false, chatTab: 'world' as ChatTab, at: 0 }
/** 이 맵에서 목표 맵으로 가는 첫 포탈(맵 연결 그래프 너비 탐색) */
function portalToward(from: string, goal: string): Portal | null {
  const prev = new Map<string, { z: string; p: Portal }>(); const q = [from]; const seen = new Set([from])
  while (q.length) {
    const z = q.shift()!; if (z === goal) break
    for (const p of ZONES[z]?.portals ?? []) if (!seen.has(p.to.zone) && ZONES[p.to.zone]) { seen.add(p.to.zone); prev.set(p.to.zone, { z, p }); q.push(p.to.zone) }
  }
  if (!prev.has(goal)) return null
  let cur = goal, step = prev.get(cur)!
  while (step.z !== from) { cur = step.z; step = prev.get(cur)! }
  return step.p
}

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
  // 구역: params.zone(없으면 아카데미 큰 지도). 출입구로 넘어오면 params.at 자리에서 연출 없이 시작
  const zone: Zone = ZONES[String(params.zone ?? 'academy_gate')] ?? ACADEMY // 스토리 시작 = 아카데미 정문 진입로
  const atParam = params.at as { x: number; y: number; dir: Dir } | undefined
  const camZ = zone.camZ ?? CAM_Z
  const camLift = zone.charH * 0.43 // 카메라가 발보다 조금 위(몸 가운데)를 본다
  const canvas = useRef<HTMLCanvasElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const rd = useRef<ExploreRenderer | null>(null)
  const [, tick] = useReducer((n: number) => n + 1, 0)
  const [load, setLoad] = useState(0)
  const [glErr, setGlErr] = useState(false)
  // 전투 다녀오기 등으로 기억해 둔 자리가 있으면 그게 먼저(포탈로 들어올 때는 목적지 기억을 지우고 온다)
  const memo = MEMO[zone.id]
  const at = memo ? undefined : atParam
  const [who, setWho] = useState<Playable>((memo?.who as Playable) ?? (params.who as Playable) ?? 'seren')
  const [run, setRun] = useState(false)
  const [phase, setPhase] = useState<'load' | 'intro' | 'play'>('load')
  const [talk, setTalk] = useState<{ title: string; lines: Line[]; i: number } | null>(null)
  const [clues, setClues] = useState<string[]>(memo?.clues ?? [])
  const [toast, setToast] = useState<string | null>(null)
  const [, setPlace] = useState(memo?.place ?? zone.place)
  const [banner, setBanner] = useState<{ r: Zone['regions'][number]; n: number } | null>(null)
  const [ticker, setTicker] = useState(false)
  // HUD: 채팅·퀘스트 알림판·탈것·대상·전투 동작 상태
  const [chatTab, setChatTab] = useState<ChatTab>(KEEP.chatTab)
  const [chatSmall, setChatSmall] = useState(KEEP.chatSmall)
  const [, chatBump] = useReducer((n: number) => n + 1, 0)
  const [questShow, setQuestShow] = useState(KEEP.questShow)
  const [mounted, setMounted] = useState(KEEP.mounted)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [fxs, setFxs] = useState<{ id: number; k: string; x: number; y: number; r?: number; dx?: number; text?: string }[]>([])
  const fxId = useRef(0)
  const act = useRef({ active: 0, dodge: 0, gauge: 0, awakenT: 0, shieldT: 0, expT: 0, dance: 0, dash: null as null | { vx: number; vy: number; t: number }, atk: 0, walked: 0 })
  // 지난 화면에서 이어받기(지난 사이 흐른 시간만큼 쿨타임·버프를 줄인다)
  if (KEEP.act && !act.current.walked && KEEP.at) { const gap = (performance.now() - KEEP.at) / 1000; const k = KEEP.act as typeof act.current; for (const key of ['active', 'dodge', 'awakenT', 'shieldT', 'expT'] as const) act.current[key] = Math.max(0, k[key] - gap); act.current.gauge = k.gauge; act.current.walked = 0.0001; KEEP.act = null }
  useEffect(() => () => { KEEP.act = { ...act.current, dash: null, dance: 0 }; KEEP.at = performance.now() }, [])
  useEffect(() => { Object.assign(KEEP, { mounted, questShow, chatSmall, chatTab }) }, [mounted, questShow, chatSmall, chatTab])
  // 자동 이동: 경유점 · 목적(퀘스트 목표 / 지도에서 고른 곳 / 고른 대상에게 가서 말 걸기)
  const auto = useRef<null | { kind: 'quest' | 'point' | 'npc'; pts: { x: number; y: number }[]; id?: string; stuck: number; lastD: number }>(null)
  // 연출 카메라: wide = 처음 보여 줄 곳 고정, drift = 천천히 밀고 들어감, follow = 대원에게 돌진(이후 따라감)
  const camMode = useRef<'wide' | 'drift' | 'follow'>('wide')
  const fxv = useRef({ rush: 0, flash: 0 })
  const seen = useRef(new Set<string>(memo?.seen ?? [zone.place]))
  const me = useRef<Actor>({ id: 'me', kind: memo?.who ?? String(params.who ?? 'seren'), x: at?.x ?? memo?.x ?? zone.start.x, y: at?.y ?? memo?.y ?? zone.start.y, dir: at?.dir ?? memo?.dir ?? 'S', moving: false, run: false, t: 0 })
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
  const chapNext = CHAPTER1.nodes.find((n) => !stars[n.id]) // 이 맵에 없는 사건이어도 퀘스트 칸에 보여 준다
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
    r.grade = zone.raw ? 0 : 1
    r.load(zone, PLAYABLE.filter((k) => SPRITES[k]), zone.npcs.map((n) => n.img), r.quality === 'low', setLoad, at ? [at] : memo ? [memo] : [zone.start, zone.intro])
      .then(() => {
        setLoad(1)
        // 출입구로 넘어옴: 연출 없이 도착 자리에서 바로
        if (at) { camMode.current = 'follow'; cam.current = { x: at.x, y: at.y - camLift, z: camZ }; setPhase('play'); return }
        if (!memo) { setPhase('intro'); return }
        // 전투 등에서 돌아옴: 연출 없이 그 자리에서 이어서. 끝내지 못한 사건이면 한 걸음 물러서 바로 다시 걸리지 않게
        camMode.current = 'follow'
        const a = memo.away
        if (a && !(game.getState().content.caseFile?.stars ?? {})[a.id]) {
          const m = me.current; const dx = m.x - a.x, dy = m.y - a.y, L = Math.hypot(dx, dy) || 1
          for (let k = 360; k >= 0; k -= 20) { const nx = a.x + dx / L * (L + k), ny = a.y + dy / L * (L + k); if (r.walkable(nx, ny)) { m.x = nx; m.y = ny; break } }
        }
        cam.current = { x: me.current.x, y: me.current.y - camLift, z: camZ }
        setPhase('play')
      }).catch(() => setGlErr(true))
    audio.preload(['step', 'title', 'whoosh', 'select', 'swap', 'open', 'coin', 'save', 'shutter', 'boss_slam', 'slam'])
    const prevBgm = audio.currentBgm
    audio.bgm(zone.bgm); audio.ambience(zone.amb, 0.55) // 음악이 있으니 환경음은 낮춘다
    const cv = canvas.current
    return () => { r.dispose(); setTimeout(() => { if (!cv.isConnected) r.release() }, 0); audio.ambience(''); audio.bgm(prevBgm === zone.bgm ? 'lobby' : prevBgm) }
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
      if (s.clue && !clues.includes(s.clue)) {
        setClues((c) => [...c, s.clue!])
        const xp = Math.round(PLAYER_EXP.clue * (act.current.expT > 0 ? 1.5 : 1))
        game.grantPlayerExp(xp); chatLog('system', `단서 획득 · ${s.clue} (경험치 +${xp})`); chatBump()
        setTimeout(() => { audio.sfx('coin'); setToast(`단서 획득 · ${s.clue}`) }, 400)
      }
    }
  }
  // 문 통과: 화면을 덮었다가 반대편에서 연다(닫힌 철문을 걸어서 뚫고 지나가지 않게)
  const goThrough = (to: { x: number; y: number }) => {
    if (busy.current) return
    busy.current = true; audio.sfx('shutter'); setGateFade(true)
    setTimeout(() => { const m = me.current; m.x = to.x; m.y = to.y; cam.current = { x: to.x, y: to.y - camLift, z: camZ } }, 420)
    setTimeout(() => { setGateFade(false); busy.current = false }, 900)
  }
  // 다른 맵으로: 화면을 덮은 뒤 목적지 맵을 새로 연다(도착 자리는 목적지 출입구 반경 밖 → 바로 되돌아가는 반복 없음)
  const armed = useRef(new Set((zone.portals ?? []).filter((p) => Math.hypot(me.current.x - p.x, (me.current.y - p.y) * 1.4) > p.r * 1.3).map((p) => p.id)))
  const goZone = (p: Portal) => {
    if (busy.current) return
    busy.current = true; stick.current = null; keys.current.clear(); audio.sfx('shutter'); setGateFade(true)
    setTimeout(() => { delete MEMO[zone.id]; delete MEMO[p.to.zone]; nav.replace('story', { zone: p.to.zone, at: { x: p.to.x, y: p.to.y, dir: p.to.dir }, who: me.current.kind, auto: auto.current?.kind === 'quest' }) }, 420)
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
  // 끝낸 사건은 저장이 반영되기 전에 같은 자리에서 다시 열리지 않게 기억해 둔다(예전엔 저장 전 한 프레임에 같은 장면이 다시 열렸다)
  const doneEv = useRef(new Set<string>())
  const finishScene = async () => {
    const n = scene!; doneEv.current.add(n.id); setScene(null)
    await game.clearCaseNode(n.id, 1); busy.current = false
    audio.sfx('save'); setToast(`사건 진행 · ${n.no} ${n.title}`); chatLog('system', `사건 진행 · ${n.no} ${n.title}`); chatBump()
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

  // ───── HUD 동작 ─────
  const mountedRef = useRef(false); mountedRef.current = mounted
  const targetRef = useRef<string | null>(null); targetRef.current = targetId
  const fx = (k: string, x: number, y: number, extra: { r?: number; dx?: number; text?: string } = {}, ms = 900) => {
    const id = ++fxId.current
    setFxs((v) => [...v, { id, k, x, y, ...extra }])
    setTimeout(() => setFxs((v) => v.filter((f) => f.id !== id)), ms)
  }
  const free = () => cfg.current.phase === 'play' && !cfg.current.talk && !busy.current
  const facing = () => { const d = DIR_DEG[me.current.dir] * Math.PI / 180; return { x: Math.sin(d), y: -Math.cos(d) } }
  const doAttack = () => {
    const A = act.current, m = me.current; if (!free() || A.atk > 0) return
    A.atk = 0.32; A.gauge = Math.min(1, A.gauge + 0.05); A.dance = 0
    const f = facing(); audio.sfx('slash')
    fx('slash', m.x + f.x * 70, m.y - zone.charH * 0.45 + f.y * 50, { r: DIR_DEG[m.dir] - 60 }, 320)
  }
  const doActive = () => {
    const A = act.current, m = me.current; if (!free() || A.active > 0) return
    A.active = ACTIVE_CD; A.shieldT = 4; A.gauge = Math.min(1, A.gauge + 0.15)
    audio.sfx('whoosh'); fx('burst', m.x, m.y - zone.charH * 0.4, {}, 750); m.flash = 0.8
  }
  const doAwaken = () => {
    const A = act.current, m = me.current; if (!free() || A.gauge < 1) return
    A.gauge = 0; A.awakenT = 20; A.expT = 60
    audio.sfx('reveal5'); fx('awaken', m.x, m.y - zone.charH * 0.45, {}, 1000); fxv.current = { rush: 0.6, flash: 0.55 }; m.flash = 1
    chatLog('system', '각성! 20초 동안 이동 속도 +20%, 60초 동안 탐색 경험치 +50%'); chatBump()
  }
  const doDodge = () => {
    const A = act.current, m = me.current; if (!free() || A.dodge > 0) return
    const f = facing(); A.dodge = DODGE_CD; A.dance = 0; auto.current = null
    A.dash = { vx: f.x * 900, vy: f.y * 900 * 0.82, t: 0.2 }
    audio.sfx('whoosh'); fx('dash', m.x, m.y - zone.charH * 0.35, { r: DIR_DEG[m.dir] - 90 }, 360)
  }
  const doDance = () => {
    const A = act.current, m = me.current; if (!free()) return
    if (A.dance > 0) { A.dance = 0; return }
    A.dance = 3.2; auto.current = null; audio.sfx('select')
    for (let i = 0; i < 6; i++) setTimeout(() => fx('note', m.x + (Math.random() - 0.5) * 80, m.y - zone.charH * (0.9 + Math.random() * 0.2), { dx: Math.round((Math.random() - 0.5) * 80), text: Math.random() < 0.5 ? '♪' : '♫' }, 1400), i * 420)
  }
  const startAuto = (kind: 'quest' | 'point' | 'npc', x: number, y: number, id?: string) => {
    const r = rd.current, m = me.current; if (!r || !free()) return false
    const pts = r.findPath(m.x, m.y, x, y)
    if (!pts || !pts.length) { setToast('그곳으로 가는 길이 없습니다'); auto.current = null; return false }
    auto.current = { kind, pts, id, stuck: 0, lastD: Infinity }; act.current.dance = 0
    return true
  }
  // 퀘스트 목표: 이 맵에 다음 사건이 있으면 그 자리, 없으면 사건이 있는 맵 쪽 포탈
  const questTarget = (): null | { x: number; y: number; goal: string } => {
    if (next && nextEv) {
      const rg = zone.regions.find((g) => nextEv.x >= g.x0 && nextEv.x < g.x1 && nextEv.y >= g.y0 && nextEv.y < g.y1)
      return { x: nextEv.x, y: nextEv.y, goal: `${rg?.name ?? zone.place}의 ◆ ${next.no} 자리로 이동하기` }
    }
    if (!chapNext) return null
    const goalZone = Object.keys(ZONES).find((z) => ZONES[z].events[chapNext.id])
    const p = goalZone ? portalToward(zone.id, goalZone) : null
    return p ? { x: p.x, y: p.y, goal: `${ro(p.label.replace(/\s*\(.*\)$/, ''))} 이동하기` } : null
  }
  const autoQuestRef = useRef(() => {})
  autoQuestRef.current = () => {
    if (auto.current?.kind === 'quest') { auto.current = null; audio.sfx('tap'); return }
    const t = questTarget(); if (!t) { setToast('지금 진행할 사건이 없습니다'); return }
    if (startAuto('quest', t.x, t.y)) audio.sfx('select')
  }
  const cycleTarget = () => {
    const m = me.current
    const list = [...zone.npcs.map((n) => ({ id: n.id, name: n.name, x: n.x, y: n.y })), ...zone.spots.filter((x) => x.kind === 'look').map((x) => ({ id: x.id, name: x.label, x: x.x, y: x.y }))]
      .map((t) => ({ ...t, d: Math.hypot(t.x - m.x, t.y - m.y) })).filter((t) => t.d < 1600).sort((a, b) => a.d - b.d)
    if (!list.length) { setTargetId(null); setToast('주변에 고를 대상이 없습니다'); return }
    const i = list.findIndex((t) => t.id === targetId)
    const nx = list[(i + 1) % list.length]
    audio.sfx('select'); setTargetId(i === list.length - 1 ? null : nx.id)
  }
  const targetObj = () => {
    if (!targetId) return null
    const n = zone.npcs.find((x) => x.id === targetId); if (n) return { name: n.name, x: n.x, y: n.y }
    const sp = zone.spots.find((x) => x.id === targetId); return sp ? { name: sp.label, x: sp.x, y: sp.y } : null
  }
  const doTalk = () => {
    if (cfg.current.talk) { nextLine(); return }
    if (nearest()) { interact(); return }
    const t = targetObj(); if (t) startAuto('npc', t.x, t.y + 40, targetId!)
  }
  const doCamp = () => {
    if (!free()) return
    const home = ZONES.academy_gate
    if (zone.id === home.id) { goThrough(home.start); chatLog('system', '귀환 · 정문 진입로 입구로 돌아왔습니다.'); chatBump(); return }
    goZone({ id: 'camp', label: '귀환', x: me.current.x, y: me.current.y, r: 1, to: { zone: home.id, x: home.start.x, y: home.start.y, dir: 'E' } })
  }
  const leave = () => { delete MEMO[zone.id]; nav.back() }
  // 맵에 들어오면 시스템 알림, 포탈로 오면서 자동 이동 중이었으면 이어서
  useEffect(() => { chatLog('system', `${zone.place}에 들어왔습니다.`); chatBump() }, [])
  const autoGo = useRef(!!params.auto)
  useEffect(() => { if (phase === 'play' && autoGo.current) { autoGo.current = false; setTimeout(() => autoQuestRef.current(), 300) } }, [phase])
  // 팀장 레벨업 연출
  const prevLv = useRef(gs.playerLevel)
  useEffect(() => {
    if (gs.playerLevel > prevLv.current) {
      const m = me.current; audio.sfx('reveal5'); fx('lvup', m.x, m.y - zone.charH - 40, { text: `LEVEL UP · Lv.${gs.playerLevel}` }, 1800)
      chatLog('system', `팀장 레벨이 ${gs.playerLevel}(으)로 올랐습니다.`); chatBump()
    }
    prevLv.current = gs.playerLevel
  }, [gs.playerLevel])

  // 키보드
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.current.add(k); e.preventDefault() }
      if (k === 'shift') setRun(true)
      if (k === 'e' || k === ' ' || k === 'enter') { e.preventDefault(); interact() }
      if (k === 'tab') { e.preventDefault(); swap(who === 'seren' ? 'ian' : 'seren') }
      if (k === 'j') doAttack()
      if (k === 'k') doActive()
      if (k === 'l') doDodge()
      if (k === 'u') doAwaken()
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
        const A = act.current
        for (const key of ['active', 'dodge', 'awakenT', 'shieldT', 'expT', 'dance', 'atk'] as const) A[key] = Math.max(0, A[key] - dt)
        if (c.phase === 'play' && !c.talk && !busy.current) {
          const K = keys.current
          ix = (K.has('d') || K.has('arrowright') ? 1 : 0) - (K.has('a') || K.has('arrowleft') ? 1 : 0)
          iy = (K.has('s') || K.has('arrowdown') ? 1 : 0) - (K.has('w') || K.has('arrowup') ? 1 : 0)
          if (stick.current) { const s = stick.current; const L = Math.hypot(s.dx, s.dy); if (L > 10) { ix = s.dx / Math.max(L, 60); iy = s.dy / Math.max(L, 60) } }
        }
        // 손으로 움직이면 자동 이동 멈춤 / 아니면 경유점 따라 걷기
        if (auto.current && (ix || iy)) auto.current = null
        const au = auto.current
        if (au && !ix && !iy && c.phase === 'play' && !c.talk && !busy.current) {
          while (au.pts.length && Math.hypot(au.pts[0].x - m.x, au.pts[0].y - m.y) < 26) au.pts.shift()
          const wp = au.pts[0]
          if (!wp) { auto.current = null; if (au.kind === 'npc') interact() }
          else {
            const dx = wp.x - m.x, dy = (wp.y - m.y) / 0.82, L = Math.hypot(dx, dy) || 1
            ix = dx / L; iy = dy / L
            const D = au.pts.reduce((acc, p, i, arr) => acc + (i ? Math.hypot(p.x - arr[i - 1].x, p.y - arr[i - 1].y) : Math.hypot(p.x - m.x, p.y - m.y)), 0)
            if (D > au.lastD - 1) au.stuck += dt; else au.stuck = 0
            au.lastD = D
            if (au.stuck > 1.2) { const end = au.pts[au.pts.length - 1]; const np = r.findPath(m.x, m.y, end.x, end.y); if (np && np.length) { au.pts = np; au.stuck = 0 } else auto.current = null }
          }
        }
        // 회피: 보는 방향으로 짧게 미끄러지듯 / 춤: 제자리에서 빙글
        if (A.dash) {
          A.dash.t -= dt
          const nx = m.x + A.dash.vx * dt, ny = m.y + A.dash.vy * dt
          if (r.walkable(nx, ny)) { m.x = nx; m.y = ny } else A.dash.t = 0
          if (A.dash.t <= 0) A.dash = null
          ix = 0; iy = 0
        }
        if (A.dance > 0) { ix = 0; iy = 0; m.dir = DIRS[Math.floor(A.dance * 6.5) % 8] as Dir }
        const mag = Math.min(1, Math.hypot(ix, iy))
        m.moving = mag > 0.15
        m.run = c.run || mag > 0.98 && !!stick.current || !!auto.current
        if (m.moving) {
          const ang = Math.atan2(iy, ix)
          m.dir = DIRS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8] as Dir
          const boost = (mountedRef.current ? 1.35 : 1) * (A.awakenT > 0 ? 1.2 : 1)
          const sp = (m.run || auto.current ? RUN : WALK) * boost * Math.max(0.5, mag) * dt
          A.walked += sp; if (A.walked > 300) { A.walked = 0; A.gauge = Math.min(1, A.gauge + 0.01) }
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
        // 출입구: 반경 밖으로 한 번 나갔다가(잠금 풀림) 다시 들어서면 이동
        if (c.phase === 'play' && !c.talk && !busy.current) for (const p of zone.portals ?? []) {
          const d = Math.hypot(m.x - p.x, (m.y - p.y) * 1.4)
          if (d > p.r * 1.3) armed.current.add(p.id)
          else if (d < p.r && armed.current.has(p.id)) { goZone(p); break }
        }
        // 사건 자리에 들어서면 조우
        const ev = evRef.current
        if (c.phase === 'play' && !c.talk && !busy.current && ev && !doneEv.current.has(ev.n.id) && Math.hypot(m.x - ev.x, (m.y - ev.y) * 1.4) < ev.r) startEvent(ev.n)
        if (m.flash) m.flash = Math.max(0, m.flash - dt * 3)
        for (const n of npcs.current) n.t += dt
        // 카메라
        const mode = c.phase === 'play' ? 'follow' : c.phase === 'load' ? 'wide' : camMode.current
        const k = mode === 'wide' ? 0 : mode === 'drift' ? 0.5 : c.phase === 'play' ? 5 : 7.5
        const tz = mode === 'follow' ? camZ : zone.intro.z - (mode === 'drift' ? 0.07 * zone.intro.z / 0.46 : 0)
        const want = mode === 'follow' ? { x: m.x, y: m.y - camLift } : { x: zone.intro.x + (zone.id === 'academy' ? 320 : 0), y: zone.intro.y + (zone.id === 'academy' ? 150 : 0) }
        const cm = cam.current
        cm.x += (want.x - cm.x) * Math.min(1, dt * k); cm.y += (want.y - cm.y) * Math.min(1, dt * k); cm.z += (tz - cm.z) * Math.min(1, dt * (mode === 'follow' ? 6 : 0.6))
        // 돌진 흐림·번쩍임은 빠르게 가라앉는다
        const fv = fxv.current; fv.rush *= Math.exp(-dt * 3.4); fv.flash *= Math.exp(-dt * 9)
        r.rush = c.reduce ? 0 : fv.rush; r.flash = c.reduce ? 0 : fv.flash
        const hw = 640 / cm.z, hh = 360 / cm.z
        cm.x = zone.W > hw * 2 ? Math.max(hw, Math.min(zone.W - hw, cm.x)) : zone.W / 2; cm.y = zone.H > hh * 2 ? Math.max(hh, Math.min(zone.H - hh, cm.y)) : zone.H / 2
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

  useEffect(() => { (window as unknown as { __EX__: unknown }).__EX__ = { frames: () => frames.current, me: () => me.current, phase: () => cfg.current.phase, set: (x: number, y: number, d?: Dir) => { me.current.x = x; me.current.y = y; if (d) me.current.dir = d }, walkable: (x: number, y: number) => rd.current?.walkable(x, y), zone: () => zone.id, hud: () => ({ ...act.current, auto: auto.current?.kind ?? null, mounted: mountedRef.current, target: targetRef.current }), findPath: (x: number, y: number) => rd.current?.findPath(me.current.x, me.current.y, x, y), autoQuest: () => autoQuestRef.current(), state: () => ({ enc: enc?.id, scene: scene?.id, busy: busy.current, talk: !!talk }), portals: () => zone.portals ?? [], view: () => rd.current?.view, swap, setPhase, interact, next: () => evRef.current } })

  // 조이스틱
  const sDown = (e: RPE<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); const b = e.currentTarget.getBoundingClientRect(); stick.current = { id: e.pointerId, ox: b.left + b.width / 2, oy: b.top + b.height / 2, dx: 0, dy: 0 }; sMove(e) }
  const sMove = (e: RPE<HTMLDivElement>) => { const s = stick.current; if (!s || s.id !== e.pointerId) return; const sc = e.currentTarget.getBoundingClientRect().width / (e.currentTarget.offsetWidth || 190); s.dx = (e.clientX - s.ox) / sc; s.dy = (e.clientY - s.oy) / sc }
  const sUp = () => { stick.current = null }

  const m = me.current
  const near = phase === 'play' && !talk ? nearest() : null
  const r = rd.current
  const toScreen = (x: number, y: number) => r ? { left: (x - r.view.x) * r.view.z + 640, top: (y - r.view.y) * r.view.z + 360 } : { left: -999, top: -999 }
  const st = stick.current
  const knob = st ? (() => { const L = Math.hypot(st.dx, st.dy), k = Math.min(1, 62 / Math.max(1, L)); return { x: st.dx * k, y: st.dy * k } })() : { x: 0, y: 0 }

  const b = badges(gs)
  const charOf = (id: string) => {
    const def = CHAR_BY_ID[id]; const own = gs.owned[id]
    const o: OwnedCharacter = own ?? ({ id, level: 40, obtainedAt: 0, dupes: 0, equipment: { weapon: null, gear: null, accessory: null } } as unknown as OwnedCharacter)
    const st = def ? statsOf(def, o, ITEM_BY_ID) : { hp: 1 }
    const face = ['seren', 'ian', 'kanna', 'rion'].includes(id) ? `ref/battle/face-${id}.webp` : (def?.assets.portrait ?? '')
    return { id, name: def?.name ?? id, level: o.level, trial: !own, face, hp: st.hp, hpMax: st.hp, canSwap: !!SPRITES[id] && (PLAYABLE as readonly string[]).includes(id) }
  }
  // 파티 창: 탐색에서 바꿀 수 있는 대원 먼저, 나머지는 지금 편성의 대원(최대 2명)
  const partyIds = () => {
    const team = gs.teams.find((t) => t.id === gs.activeTeamId)
    const ids = [...PLAYABLE.filter((k) => k !== who && SPRITES[k]), ...(team?.slots ?? []).filter((x): x is string => !!x && x !== who && !!CHAR_BY_ID[x])]
    return [...new Set(ids)].slice(0, 2)
  }
  const hudModel = (): HudModel => {
    const A = act.current, mm = me.current, qt = questTarget(), tg = targetObj()
    const pxPerM = zone.charH / 1.7
    const markers: Marker[] = [
      ...zone.npcs.map((x) => ({ x: x.x, y: x.y, k: 'npc' as const })),
      ...zone.spots.filter((x) => x.kind === 'look').map((x) => ({ x: x.x, y: x.y, k: 'spot' as const })),
      ...(zone.portals ?? []).map((x) => ({ x: x.x, y: x.y, k: 'portal' as const })),
      ...(nextEv ? [{ x: nextEv.x, y: nextEv.y, k: 'ev' as const }] : []),
      ...(tg ? [{ x: tg.x, y: tg.y, k: 'target' as const }] : []),
      ...(auto.current?.pts.length ? [{ ...auto.current.pts[auto.current.pts.length - 1], k: 'dest' as const }] : []),
    ]
    const buffs = [
      ...(A.shieldT > 0 ? [{ id: 'rush', icon: 'buff0', name: '액티브 · 가속', desc: '이동 속도 +40%', left: A.shieldT, max: 4 }] : []),
      ...(A.expT > 0 ? [{ id: 'exp', icon: 'buff1', name: '각성 · 경험치', desc: '탐색 경험치(단서) +50%', left: A.expT, max: 60 }] : []),
      ...(A.awakenT > 0 ? [{ id: 'awaken', icon: 'buff2', name: '각성 · 신속', desc: '이동 속도 +20%', left: A.awakenT, max: 20 }] : []),
      ...(mounted ? [{ id: 'mount', icon: 'buff3', name: '탈것', desc: '이동 속도 +35% · 다시 누르면 내림', left: 0, max: 0 }] : []),
    ]
    const nearT = nearest()
    return {
      zone, me: { x: mm.x, y: mm.y, dir: DIR_DEG[mm.dir] }, view: rd.current?.view,
      lead: charOf(who), party: partyIds().map(charOf),
      active: { left: A.active, max: ACTIVE_CD }, awaken: { gauge: A.gauge, on: A.awakenT > 0 }, dodge: { left: A.dodge, max: DODGE_CD },
      buffs,
      quest: { show: questShow, tag: chapNext ? `${chapNext.no} ${chapNext.title}` : '1장 완료', goal: qt?.goal ?? '1장의 모든 사건을 끝냈습니다', dist: qt ? Math.round(Math.hypot(qt.x - mm.x, qt.y - mm.y) / pxPerM) : null, auto: auto.current?.kind === 'quest', done: !qt },
      wallet: { credit: gs.wallet.credit, diamond: gs.wallet.diamond },
      badge: { event: b.event, menu: b.mail || b.mission || b.notice, quest: !!chapNext },
      markers,
      canTalk: !!nearT || !!tg, talkLabel: nearT ? (nearT.kind === 'npc' ? (nearT.x as { name: string }).name : (nearT.x as { label: string }).label) : tg ? `${tg.name}에게 가기` : '',
      targetName: tg?.name ?? null, mounted, dancing: A.dance > 0,
      chat: { tab: chatTab, lines: CHAT, small: chatSmall },
      exp: { level: gs.playerLevel, cur: gs.playerExp ?? 0, need: playerExpToNext(gs.playerLevel) },
      chapter: 'CH. 1',
    }
  }
  const hudActions = {
    go: (sc: Parameters<typeof nav.push>[0], p?: Record<string, unknown>) => { audio.sfx('tap'); auto.current = null; nav.push(sc, p) },
    back: leave, swap: (id: string) => swap(id as Playable),
    attack: doAttack, active: doActive, awaken: doAwaken, dodge: doDodge, talk: doTalk, dance: doDance, target: cycleTarget,
    mount: () => { audio.sfx('swap'); setMounted((v) => { chatLog('system', v ? '탈것에서 내렸습니다.' : '탈것에 탔습니다. 이동 속도 +35%'); chatBump(); return !v }) },
    camp: doCamp, autoQuest: () => autoQuestRef.current(),
    moveTo: (x: number, y: number) => { if (startAuto('point', x, y)) audio.sfx('select') },
    toggleQuest: () => { audio.sfx('tap'); setQuestShow((v) => !v) },
    chatTab: (t: ChatTab) => { audio.sfx('tap'); setChatTab(t) }, chatSmall: () => setChatSmall((v) => !v),
    say: (tab: ChatTab, text: string) => { chatLog(tab, text, gs.playerName); chatBump(); audio.sfx('tap') },
    stick: { down: sDown, move: sMove, up: sUp, knob },
    questList: CHAPTER1.nodes.map((n) => ({ id: n.id, no: n.no, title: n.title, place: n.place, state: (stars[n.id] ? 'done' : n === chapNext ? 'next' : 'lock') as 'done' | 'next' | 'lock' })),
  }

  return (
    <div className="scr story-field">
      <RefStage canvas={{ width: 1280, height: 720 }} className={`sf ${reduce ? 'ui-reduced' : ''} ph-${phase} ${talk ? 'talking' : ''} ${ticker ? 'ticker-on' : ''}`}>
        <div className="sf-gl" ref={host}><canvas ref={canvas} width={1280} height={720} aria-label={`${zone.area} ${zone.place} 탐색 화면`} /></div>
        {glErr && <div className="sf-err">이 기기에서는 탐색 화면(WebGL2)을 그릴 수 없습니다.</div>}
        {phase === 'load' && !glErr && <div className="sf-load"><b>{zone.area}</b><i><em style={{ width: `${Math.round(load * 100)}%` }} /></i></div>}

        {/* NPC 머리 위 말풍선 · 조사 표시 */}
        {phase === 'play' && zone.npcs.map((n) => <i key={n.id} className={`sf-bubble ${near?.x === n ? 'on' : ''}`} style={toScreen(n.x, n.y - zone.charH - 40)} aria-hidden>···</i>)}
        {phase === 'play' && zone.spots.filter((s) => s.kind === 'look').map((s) => <i key={s.id} className={`sf-spot ${clues.includes(s.clue ?? '') ? 'done' : ''} ${near?.x === s ? 'on' : ''}`} style={toScreen(s.x, s.y - 240)} aria-hidden />)}
        {phase === 'play' && (zone.portals ?? []).map((p) => <i key={p.id} className={`sf-portal ${p.x < zone.W * 0.15 ? 'edge-l' : ''}`} style={toScreen(p.x, p.y)} aria-hidden><b>{p.label}</b></i>)}
        {phase === 'play' && next && nextEv && <i className={`sf-ev ${next.kind}`} style={toScreen(nextEv.x, nextEv.y)} aria-hidden><b>{next.no}</b></i>}
        {near && <div className="sf-hint" style={toScreen(m.x, m.y - zone.charH - 70)}>{near.kind === 'npc' ? '대화' : (near.x as { label: string }).label}</div>}

        {/* 진입 연출: 위아래 검은 띠 + 장소 이름 */}
        <i className="sf-letter top" aria-hidden /><i className="sf-letter bot" aria-hidden />
        {phase === 'intro' && <Cine shots={entry} onShot={onEntryShot} onDone={startPlay} skippable reduce={reduce} />}
        {ticker && <Cine shots={[{ k: 'ticker', d: 3.4, top: `ABILITY KINGDOM — CHAPTER ${zone.chapter.no} — ${zone.chapter.en.join(' ')} —`, bot: `${zone.place} · ${zone.placeEn} · ${zone.area} · ${zone.areaEn} ·` }]} block={false} reduce={reduce} onDone={() => setTicker(false)} />}

        {/* 필드 효과 */}
        {fxs.map((f) => <i key={f.id} className={`fx-${f.k}`} style={{ ...toScreen(f.x, f.y), '--r': `${f.r ?? 0}deg`, '--dx': `${f.dx ?? 0}px` } as React.CSSProperties}>{f.text}</i>)}
        {phase === 'play' && <FieldHud m={hudModel()} a={hudActions} />}

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
