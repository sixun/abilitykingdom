// 인게임 전투 시뮬레이션 v2(화면과 분리된 순수 로직). 좌표는 1280×720 무대, 발 위치 기준. y가 클수록 앞(카메라 쪽).
// 기획: 실시간 · 4인 · 이동 조작 없음 · 탭 지휘(적 탭 = 집중 공격, 장치 탭 = 대원이 달려가 작동).
// 어빌리티: 패시브(자동) · 액티브(카드 탭) · 버프(카드 위로 밀기) · 각성(보류).
// 적의 예고 4종: 강타(바닥 원) · 돌진(바닥 띠) · 시전(머리 위 게이지) · 노란 표시(장치·호출을 노림). 예고는 기절 또는 누적 피해로 끊긴다.
// 수치는 1장 시험값이다(성장 기획의 20종 능력치 중 전투에 쓰는 항목만 사용).

export type Side = 'ally' | 'enemy'
export type AllyKind = 'rion' | 'seren' | 'ian' | 'kanna'
export type FoeKind = 'hound' | 'golem' | 'orb' | 'mite' | 'caller' | 'pylon' | 'boss'
export type Kind = AllyKind | FoeKind

export interface Stats {
  maxHp: number; atk: number; def: number; atkSpd: number; moveSpd: number
  critRate: number; critDmg: number; pen: number; basicUp: number; abilUp: number
  cdr: number; effHit: number; effRes: number; buffDur: number
  healPow: number; shieldPow: number; dmgRed: number; healRecv: number; ccRed: number
}
const ZERO: Stats = { maxHp: 0, atk: 0, def: 0, atkSpd: 0, moveSpd: 0, critRate: 0, critDmg: 0, pen: 0, basicUp: 0, abilUp: 0, cdr: 0, effHit: 0, effRes: 0, buffDur: 0, healPow: 0, shieldPow: 0, dmgRed: 0, healRecv: 0, ccRed: 0 }

export type TeleKind = 'slam' | 'charge' | 'cast' | 'call' | 'noise'
export interface Tele { k: TeleKind; name: string; t: number; dur: number; x: number; y: number; x2: number; y2: number; r: number; w: number; need: number; acc: number; target?: string }
export interface Act { k: 'atk' | 'skill' | 'buff' | 'hit' | 'dash' | 'stagger' | 'use' | 'roar'; t: number; dur: number; tx?: number; ty?: number; fx?: number; fy?: number; n?: number; imp?: number } // n: 연속 공격 몇 타째(1~3), imp: 타격 순간(초)
export interface Buff { id: string; t: number; mods: Partial<Stats>; regen?: number; src: string }
export interface Unit {
  id: string; side: Side; kind: Kind; name: string
  x: number; y: number; hx: number; hy: number; face: 1 | -1
  hp: number; st: Stats; buffs: Buff[]
  shield: number; shieldT: number; taunt: number; stun: number; slowT: number; slowK: number
  cd: number; interval: number; range: number
  act: Act | null; tele: Tele | null; teleCd: number; teleCd2: number
  dead: number; entering: boolean
  dealt: number; healed: number; basicN: number
  task: null | { dev: string; ph: 'go' | 'use' | 'back'; t: number }
  icon: null | 'device' | 'target'
  passive: boolean // 집중 지정이 없으면 아군 기본 공격이 노리지 않는 대상(기둥·호출체)
  statik: boolean // 움직이지 않음
  vuln: number // 무력화(받는 피해 증가) 남은 시간
  phase: number; lv: number
  vx: number; vy: number // 이동 속도(화면에서 걷기·기울기 연출에 씀)
  hop: number // 공중으로 뜬 높이(넉백·백스텝 연출)
  frz: number // 타격 경직(히트스톱): 이 시간 동안 멈춘다
}
export interface Device { id: string; k: 'relay' | 'shutter'; x: number; y: number; hp: number; max: number; lane: number; closed: number; cool: number; guard: number; label: string }
export interface Proj { id: number; k: 'ring' | 'wave' | 'slash' | 'cube' | 'bolt'; x: number; y: number; tx: string; spd: number; dmg: number; from: string; crit: boolean; brk: number; abil: boolean; seen?: string[]; vx?: number; life?: number }
export interface Fx { id: number; k: string; x: number; y: number; t: number; dur: number; v?: number; crit?: boolean; heal?: boolean; shield?: boolean; text?: string; x2?: number; y2?: number; r?: number; color?: string; who?: string }
export interface Ability { name: string; cd: number; left: number; dur: number; on: number }
export interface Tip { id: string; text: string; at?: 'card' | 'enemy' | 'device'; ref?: string }
export interface Spawn { k: FoeKind; lane?: number; x?: number; y?: number; lv?: number }
export interface StageDef {
  id: string; title: string; bg: 'street' | 'alley' | 'substation'
  goal: 'eliminate' | 'defend' | 'boss' | 'target'; goalText: string
  limit: number; defendT?: number
  homes?: Partial<Record<AllyKind, [number, number]>>
  waves?: Spawn[][]
  timeline?: { t: number; spawn: Spawn[] }[]
  devices?: Omit<Device, 'hp' | 'closed' | 'cool' | 'guard'>[]
  setup?: (s: Sim) => void
  tips?: { id: string; when: (s: Sim) => boolean; text: string; at?: Tip['at']; ref?: string; slow?: boolean }[]
  stars: { label: string; ok: (s: Sim) => boolean }[]
  lv: number // 적 강도 배율
}
export interface Sim {
  t: number; def: StageDef; units: Unit[]; devices: Device[]; proj: Proj[]; fx: Fx[]
  abil: Record<string, { a: Ability; b: Ability }>
  focus: string | null; shake: number; stop: number; slowmo: number
  result: null | 'win' | 'lose'; why: string; seq: number
  cutin: null | { kind: AllyKind; name: string; t: number; buff: boolean }
  flags: Record<string, number>; cnt: { breaks: number; downs: number; shutter: number; relayMin: number; noiseBreaks: number; focus: number }
  tip: (Tip & { t: number }) | null; seenTips: string[]
  wave: number; tl: number; timers: { at: number; f: () => void }[]; rnd: () => number
}

// ───────── 대원 정의 ─────────
export const ALLY_ORDER: AllyKind[] = ['rion', 'seren', 'ian', 'kanna']
const S = (o: Partial<Stats>): Stats => ({ ...ZERO, ...o })
const ALLY: Record<AllyKind, { name: string; st: Stats; interval: number; range: number; home: [number, number] }> = {
  rion: { name: '라온', st: S({ maxHp: 2200, atk: 125, def: 50, critRate: 0.15, critDmg: 0.6, effHit: 0.1 }), interval: 1.7, range: 1400, home: [430, 590] },
  seren: { name: '세렌', st: S({ maxHp: 2050, atk: 140, def: 55, critRate: 0.2, critDmg: 0.7, pen: 0.15, effHit: 0.15 }), interval: 1.25, range: 1400, home: [470, 320] },
  ian: { name: '이안', st: S({ maxHp: 3000, atk: 75, def: 110, dmgRed: 0.25, shieldPow: 0.2, critRate: 0.05, critDmg: 0.5 }), interval: 1.4, range: 210, home: [560, 450] },
  kanna: { name: '칸나', st: S({ maxHp: 1950, atk: 95, def: 45, critRate: 0.1, critDmg: 0.5, healPow: 0.15 }), interval: 1.5, range: 1400, home: [250, 450] },
}
export const ABILITY_INFO: Record<AllyKind, { passive: [string, string]; active: [string, string, number]; buff: [string, string, number, number] }> = {
  rion: { passive: ['공진', '음파는 적의 시전을 두 배로 흔든다(예고 끊기 피해 2배)'], active: ['주파수 폭발', '음파 고리 3겹이 전장을 가로질러 모든 적을 관통한다', 7], buff: ['볼륨 업', '8초 동안 라온 공격 속도 +60%, 아군 전체 치명타 확률 +10%', 16, 8] },
  seren: { passive: ['잔월', '치명타가 나면 검기 한 줄이 더 날아간다'], active: ['월광 일섬', '집중 대상(없으면 체력이 가장 많은 적)에게 달려가 3연속 베기, 마지막 일격은 1.5초 기절', 8], buff: ['고요한 밤', '8초 동안 세렌 치명타 확률 +40%, 치명타 피해 +30%', 18, 8] },
  ian: { passive: ['방패병', '받는 피해 25% 감소, 방패 치기로 적의 시선을 끈다'], active: ['방벽 전개', '아군 전원에게 보호막을 주고 5초 동안 적의 공격을 자신에게 끈다', 10], buff: ['보호 구역', '8초 동안 지킬 장치(없으면 체력이 가장 낮은 아군)를 방벽으로 감싸 받는 피해 75% 감소', 20, 8] },
  kanna: { passive: ['덤 큐브', '기본 공격 4번마다 체력이 가장 낮은 아군을 회복한다. 큐브는 적을 느리게 한다'], active: ['큐브 낙하', '적 5명에게 큐브를 떨어뜨리고 아군 전체를 회복한다', 7], buff: ['보너스 스테이지', '6초 동안 아군 전체 초당 3% 회복, 받는 치유 +20%', 18, 6] },
}

// ───────── 적 정의 ─────────
const FOE: Record<FoeKind, { name: string; st: Stats; interval: number; range: number; speed: number; passive?: boolean; statik?: boolean; icon?: Unit['icon'] }> = {
  hound: { name: '결정 사냥개', st: S({ maxHp: 2700, atk: 250, def: 20 }), interval: 1.3, range: 75, speed: 100 },
  golem: { name: '결정 거인', st: S({ maxHp: 9400, atk: 470, def: 60, effRes: 0.3 }), interval: 2.2, range: 105, speed: 42 },
  orb: { name: '결정 구체', st: S({ maxHp: 2300, atk: 260, def: 10 }), interval: 2.1, range: 620, speed: 40 },
  mite: { name: '잠식충', st: S({ maxHp: 950, atk: 120, def: 0 }), interval: 0.6, range: 60, speed: 150, icon: 'device' },
  caller: { name: '호출 결정체', st: S({ maxHp: 18000, atk: 0, def: 40, effRes: 0.2 }), interval: 99, range: 0, speed: 0, passive: true, statik: true, icon: 'target' },
  pylon: { name: '중계 결정 기둥', st: S({ maxHp: 5200, atk: 0, def: 30 }), interval: 99, range: 0, speed: 0, passive: true, statik: true, icon: 'target' },
  boss: { name: '스태틱', st: S({ maxHp: 31000, atk: 560, def: 80, effRes: 0.5 }), interval: 2.0, range: 165, speed: 46 },
}
export const LANE_Y = [345, 470, 600]

// ───────── 기본 도구 ─────────
const alive = (u: Unit) => u.dead === 0
export const isAlive = alive
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.5)
export function stat(u: Unit, k: keyof Stats) { let v = u.st[k]; for (const b of u.buffs) v += b.mods[k] ?? 0; return v }
const fx = (s: Sim, f: Omit<Fx, 'id' | 't'>) => { s.fx.push({ ...f, id: s.seq++, t: 0 }) }
const later = (s: Sim, dt: number, f: () => void) => { s.timers.push({ at: s.t + dt, f }) }
function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

function mkUnit(side: Side, kind: Kind, id: string, x: number, y: number, hx: number, hy: number, lv = 1): Unit {
  const d = side === 'ally' ? ALLY[kind as AllyKind] : FOE[kind as FoeKind]
  const st = { ...d.st }
  if (side === 'enemy') { st.maxHp = Math.round(st.maxHp * lv); st.atk = Math.round(st.atk * (0.6 + lv * 0.4)) }
  const f = side === 'enemy' ? (d as typeof FOE.hound) : null
  return {
    id, side, kind, name: d.name, x, y, hx, hy, face: side === 'ally' ? 1 : -1, hp: st.maxHp, st, buffs: [],
    shield: 0, shieldT: 0, taunt: 0, stun: 0, slowT: 0, slowK: 0, cd: 0.5 + Math.random() * 0.8, interval: d.interval, range: d.range,
    act: null, tele: null, teleCd: 3 + Math.random() * 3, teleCd2: 6, dead: 0, entering: true, dealt: 0, healed: 0, basicN: 0, task: null,
    icon: f?.icon ?? null, passive: !!f?.passive, statik: !!f?.statik, vuln: 0, phase: 1, lv, vx: 0, vy: 0, hop: 0, frz: 0,
  }
}

export function newSim(def: StageDef, seed = Date.now()): Sim {
  const s: Sim = {
    t: 0, def, units: [], devices: [], proj: [], fx: [], abil: {}, focus: null, shake: 0, stop: 0, slowmo: 0,
    result: null, why: '', seq: 1, cutin: null, flags: {}, cnt: { breaks: 0, downs: 0, shutter: 0, relayMin: 1, noiseBreaks: 0, focus: 0 },
    tip: null, seenTips: [], wave: 0, tl: 0, timers: [], rnd: mulberry(seed),
  }
  for (const k of ALLY_ORDER) {
    const [hx, hy] = def.homes?.[k] ?? ALLY[k].home
    s.units.push(mkUnit('ally', k, k, hx - 260, hy, hx, hy))
    const I = ABILITY_INFO[k]
    s.abil[k] = { a: { name: I.active[0], cd: I.active[2], left: 1.5, dur: 0, on: 0 }, b: { name: I.buff[0], cd: I.buff[2], left: 4, dur: I.buff[3], on: 0 } }
  }
  for (const d of def.devices ?? []) s.devices.push({ ...d, hp: d.max, closed: 0, cool: 0, guard: 0 })
  def.setup?.(s)
  if (def.waves?.length) spawnWave(s)
  return s
}

export function spawn(s: Sim, sp: Spawn, delay = 0) {
  const lane = sp.lane ?? Math.floor(s.rnd() * 3)
  const y = sp.y ?? LANE_Y[lane] + (s.rnd() - 0.5) * 50
  const hx = sp.x ?? 900 + s.rnd() * 220
  const u = mkUnit('enemy', sp.k, `${sp.k}${s.seq++}`, 1360 + delay * 60, y, hx, y, (sp.lv ?? 1) * s.def.lv)
  if (sp.k === 'pylon') { u.x = hx; u.entering = false }
  if (sp.k === 'mite' && !s.devices.some((d) => d.k === 'relay')) u.icon = null // 지킬 장치가 없으면 노란 표시 없음
  s.units.push(u)
  return u
}
function spawnWave(s: Sim) {
  const w = s.def.waves![s.wave]
  w.forEach((sp, i) => spawn(s, sp, i * 0.6))
  s.wave++
  if (s.def.waves!.length > 1) fx(s, { k: 'banner', x: 640, y: 250, dur: 1.6, text: `WAVE ${s.wave} / ${s.def.waves!.length}` })
}

// ───────── 피해·회복 ─────────
function damage(s: Sim, from: Unit | undefined, to: Unit, mult: number, o: { crit?: boolean; abil?: boolean; brk?: number; trueDmg?: number; noNum?: boolean; push?: number } = {}) {
  if (!alive(to)) return 0
  let v: number
  let crit = false
  if (o.trueDmg) v = o.trueDmg
  else {
    const atk = from ? stat(from, 'atk') : 100
    crit = o.crit ?? (from ? s.rnd() < stat(from, 'critRate') : false)
    const up = from ? (o.abil ? stat(from, 'abilUp') : stat(from, 'basicUp')) : 0
    const def = Math.max(0, stat(to, 'def') * (1 - (from ? stat(from, 'pen') : 0)))
    v = atk * mult * (1 + up) * (crit ? 1 + (from ? stat(from, 'critDmg') : 0.5) : 1) * (100 / (100 + def)) * (0.92 + s.rnd() * 0.16)
  }
  v *= 1 - Math.min(0.8, stat(to, 'dmgRed'))
  if (to.vuln > 0) v *= 1.5
  if (to.kind === 'boss' && s.units.some((p) => p.kind === 'pylon' && alive(p))) v *= 0.3
  v = Math.max(1, Math.round(v))
  if (to.shield > 0) { const a = Math.min(to.shield, v); to.shield -= a; v -= a; if (a > 0 && !o.noNum) fx(s, { k: 'num', x: to.x, y: to.y - headOf(to) - 18, dur: 0.9, v: a, shield: true }) }
  to.hp = Math.max(0, to.hp - v)
  if (from) from.dealt += v
  if (v > 0 && !o.noNum) fx(s, { k: 'num', x: to.x + (s.rnd() - 0.5) * 34, y: to.y - headOf(to) + 10, dur: 0.9, v, crit })
  if (crit || o.abil) s.stop = Math.max(s.stop, crit ? 0.085 : 0.05)
  fx(s, { k: to.side === 'enemy' ? 'hitE' : 'hitA', x: to.x, y: to.y - headOf(to) * 0.45, dur: 0.35, crit })
  if (!to.act || (to.act.k === 'atk' && to.side === 'enemy')) to.act = { k: 'hit', t: 0, dur: to.side === 'ally' ? 0.32 : 0.2 }
  // 히트스톱: 근접 타격·치명타·스킬은 때린 쪽과 맞은 쪽이 아주 잠깐 멈춘다(던파식 손맛)
  if (from && !o.noNum) {
    const melee = from.kind === 'seren' || from.kind === 'ian'
    const fz = crit ? 0.09 : o.abil ? 0.06 : melee ? 0.05 : 0
    if (fz) { if (to.kind !== 'boss') to.frz = Math.max(to.frz, fz); if (melee) from.frz = Math.max(from.frz, fz) }
  }
  // 넉백: 맞은 쪽이 밀려난다(보스·고정체 제외). 큰 타격은 살짝 뜬다
  const push = (o.push ?? 0) + (crit ? 18 : 0) + (o.abil ? 14 : 0) + (from && (from.kind === 'golem' || from.kind === 'boss') ? 26 : 0)
  if (push > 0 && from && to.kind !== 'boss' && !to.statik && !to.tele) {
    const dir = Math.sign(to.x - from.x) || (to.side === 'enemy' ? 1 : -1)
    to.x = Math.max(60, Math.min(1240, to.x + dir * push)); to.vx = dir * push * 6
    if (push >= 30) to.hop = Math.max(to.hop, push * 0.7)
  }
  // 예고 끊기: 시전 중 받은 피해 누적
  if (to.tele) {
    to.tele.acc += v * (o.brk ?? 1)
    if (to.tele.acc >= to.tele.need) breakTele(s, to)
  }
  if (to.hp <= 0) kill(s, to)
  return v
}
function kill(s: Sim, u: Unit) {
  u.dead = 0.0001; u.act = null; u.tele = null; u.task = null
  fx(s, { k: u.side === 'enemy' ? 'dieE' : 'dieA', x: u.x, y: u.y - headOf(u) * 0.4, dur: 0.9, who: u.kind })
  if (u.side === 'ally') s.cnt.downs++
  if (s.focus === u.id) s.focus = null
  if (u.kind === 'pylon') { fx(s, { k: 'banner', x: 640, y: 240, dur: 1.2, text: '기둥 파괴' }); s.shake = Math.max(s.shake, 0.3) }
}
function heal(s: Sim, from: Unit, to: Unit, amt: number) {
  if (!alive(to)) return
  const v = Math.min(stat(to, 'maxHp') - to.hp, Math.round(amt * (1 + stat(from, 'healPow')) * (1 + stat(to, 'healRecv'))))
  if (v <= 0) return
  to.hp += v; from.healed += v
  if (v >= 8) fx(s, { k: 'num', x: to.x, y: to.y - headOf(to) - 34, dur: 1, v, heal: true })
  fx(s, { k: 'heal', x: to.x, y: to.y - 50, dur: 0.8 })
}
function shieldUp(s: Sim, from: Unit, to: Unit, amt: number, dur: number) {
  if (!alive(to)) return
  to.shield = Math.max(to.shield, Math.round(amt * (1 + stat(from, 'shieldPow')))); to.shieldT = dur
  fx(s, { k: 'shieldOn', x: to.x, y: to.y - 60, dur: 0.8 })
}
function stunUnit(s: Sim, from: Unit, to: Unit, sec: number) {
  if (!alive(to)) return
  const chance = Math.max(0.15, Math.min(1, 0.9 + stat(from, 'effHit') - stat(to, 'effRes')))
  if (s.rnd() > chance) { fx(s, { k: 'word', x: to.x, y: to.y - headOf(to) - 20, dur: 0.8, text: '저항' }); return }
  if (to.tele) { breakTele(s, to); return }
  if (to.kind === 'boss' || to.statik) return
  to.stun = Math.max(to.stun, sec * (1 - stat(to, 'ccRed')))
  fx(s, { k: 'stun', x: to.x, y: to.y - headOf(to), dur: sec })
}
function breakTele(s: Sim, u: Unit) {
  const tk = u.tele!.k
  u.tele = null
  s.cnt.breaks++
  s.stop = Math.max(s.stop, 0.12)
  s.shake = Math.max(s.shake, 0.22)
  fx(s, { k: 'break', x: u.x, y: u.y - headOf(u) * 0.6, dur: 0.9 })
  if (tk === 'noise') { s.cnt.noiseBreaks++; u.vuln = 6; u.act = { k: 'stagger', t: 0, dur: 6 }; fx(s, { k: 'banner', x: 640, y: 240, dur: 1.6, text: '무력화! 받는 피해 +50%' }) }
  else { u.act = { k: 'stagger', t: 0, dur: 1.4 }; u.teleCd = Math.max(u.teleCd, 4) }
}
export function headOf(u: { kind: Kind }) {
  switch (u.kind) { case 'boss': return 300; case 'golem': return 205; case 'pylon': return 190; case 'caller': return 190; case 'orb': return 150; case 'mite': return 80; case 'hound': return 120; case 'ian': return 175; default: return 160 }
}

// ───────── 명령(화면 → 시뮬레이션) ─────────
export function castActive(s: Sim, id: AllyKind): boolean {
  const ab = s.abil[id]?.a; const u = s.units.find((e) => e.id === id)
  if (!ab || !u || !alive(u) || ab.left > 0 || s.result || u.stun > 0 || u.task) return false
  const foes = targets(s)
  if (!foes.length && (id === 'rion' || id === 'seren')) return false
  ab.left = ab.cd * (1 - stat(u, 'cdr'))
  s.cutin = { kind: id, name: ab.name, t: 0, buff: false }
  s.shake = Math.max(s.shake, 0.2)
  u.act = { k: 'skill', t: 0, dur: 0.9 }
  if (id === 'rion') {
    for (let i = 0; i < 3; i++) later(s, 0.25 + i * 0.16, () => { if (alive(u)) s.proj.push({ id: s.seq++, k: 'wave', x: u.x + 50, y: u.y - 110, tx: '', spd: 980, dmg: 1.1, from: u.id, crit: false, brk: 3, abil: true, seen: [], vx: 1, life: 1.6 }) })
  } else if (id === 'seren') {
    const t = s.units.find((e) => e.id === s.focus && alive(e)) ?? foes.filter((e) => !e.passive).sort((a, b) => b.hp - a.hp)[0] ?? foes[0]
    u.act = { k: 'dash', t: 0, dur: 1.15, tx: t.x - 100 * (t.kind === 'boss' ? 1.6 : 1), ty: t.y + 6, fx: u.x, fy: u.y }
    for (let i = 0; i < 3; i++) later(s, 0.32 + i * 0.2, () => {
      if (!alive(t)) return
      damage(s, u, t, 1.35, { abil: true, crit: i === 2 ? true : undefined, brk: 1.5 })
      fx(s, { k: 'slashBig', x: t.x, y: t.y - headOf(t) * 0.5, dur: 0.45, v: i })
      if (i === 2) stunUnit(s, u, t, 1.5)
    })
  } else if (id === 'ian') {
    for (const a of s.units) if (a.side === 'ally' && alive(a)) shieldUp(s, u, a, stat(u, 'maxHp') * 0.1, 6)
    u.taunt = 5
    fx(s, { k: 'wall', x: u.x + 70, y: u.y - 70, dur: 1.1 })
  } else if (id === 'kanna') {
    const list = [...foes].sort((a, b) => (b.id === s.focus ? 1 : 0) - (a.id === s.focus ? 1 : 0)).slice(0, 5)
    list.forEach((t, i) => later(s, 0.15 + i * 0.11, () => { fx(s, { k: 'cubeDrop', x: t.x, y: t.y - headOf(t) * 0.5, dur: 0.7 }); later(s, 0.4, () => damage(s, u, t, 1.5, { abil: true })) }))
    for (const a of s.units) if (a.side === 'ally' && alive(a)) heal(s, u, a, stat(a, 'maxHp') * 0.08)
  }
  return true
}
export function castBuff(s: Sim, id: AllyKind): boolean {
  const ab = s.abil[id]?.b; const u = s.units.find((e) => e.id === id)
  if (!ab || !u || !alive(u) || ab.left > 0 || s.result || u.stun > 0) return false
  ab.left = ab.cd * (1 - stat(u, 'cdr'))
  const dur = ab.dur * (1 + stat(u, 'buffDur'))
  ab.on = dur
  s.cutin = { kind: id, name: ab.name, t: 0, buff: true }
  u.act = { k: 'buff', t: 0, dur: 0.9 }
  const team = s.units.filter((a) => a.side === 'ally' && alive(a))
  const add = (to: Unit, mods: Partial<Stats>, regen?: number) => { to.buffs = to.buffs.filter((b) => b.id !== `${id}-b`); to.buffs.push({ id: `${id}-b`, t: dur, mods, regen, src: id }) }
  if (id === 'rion') { add(u, { atkSpd: 0.6, critRate: 0.1 }); for (const a of team) if (a !== u) add(a, { critRate: 0.1 }) }
  else if (id === 'seren') add(u, { critRate: 0.4, critDmg: 0.3 })
  else if (id === 'ian') {
    const dev = s.devices.find((d) => d.k === 'relay' && d.hp > 0)
    if (dev) { dev.guard = dur; fx(s, { k: 'guard', x: dev.x, y: dev.y - 60, dur }) }
    else { const low = [...team].sort((a, b) => a.hp / stat(a, 'maxHp') - b.hp / stat(b, 'maxHp'))[0]; add(low, { dmgRed: 0.75 }); fx(s, { k: 'guard', x: low.x, y: low.y - 60, dur, who: low.id }) }
  } else if (id === 'kanna') for (const a of team) add(a, { healRecv: 0.2 }, 0.03)
  fx(s, { k: 'buffOn', x: u.x, y: u.y - 80, dur: 0.9, who: id })
  return true
}
/** 적·기둥을 누르면 집중 공격(다시 누르면 해제) */
export function setFocus(s: Sim, id: string | null) {
  if (id && s.focus !== id) { const u = s.units.find((e) => e.id === id && alive(e) && e.side === 'enemy'); if (!u) return false; s.focus = id; s.cnt.focus++; fx(s, { k: 'focus', x: u.x, y: u.y, dur: 0.6 }); return true }
  s.focus = null; return true
}
/** 장치를 누르면 가장 가까운 대원이 달려가 작동한다 */
export function useDevice(s: Sim, devId: string): boolean {
  const d = s.devices.find((x) => x.id === devId)
  if (!d || d.k !== 'shutter' || d.closed > 0 || d.cool > 0 || s.result) return false
  if (s.units.some((u) => u.task?.dev === devId)) return false
  const u = s.units.filter((a) => a.side === 'ally' && alive(a) && !a.task && a.stun <= 0 && a.act?.k !== 'dash').sort((a, b) => dist(a, d) - dist(b, d))[0]
  if (!u) return false
  u.task = { dev: devId, ph: 'go', t: 0 }
  fx(s, { k: 'word', x: u.x, y: u.y - headOf(u) - 20, dur: 1, text: '장치로!' })
  return true
}

function targets(s: Sim) { return s.units.filter((e) => e.side === 'enemy' && alive(e) && !e.entering) }
function pickTarget(s: Sim, u: Unit) {
  const f = s.units.find((e) => e.id === s.focus && alive(e))
  if (f && dist(u, f) <= u.range) return f
  const all = targets(s)
  const act = all.filter((e) => !e.passive)
  const pool = act.length ? act : all
  // 기본 우선순위: 가까운 적. 잠식충은 대원을 무시하고 지나가므로 집중 지정이 없으면 뒤로 밀린다
  let best: Unit | undefined, bd = 1e9
  for (const e of pool) { const d = dist(u, e) + (e.kind === 'mite' ? 240 : 0); if (d < bd && dist(u, e) <= u.range) { bd = d; best = e } }
  return best
}
function foeTarget(s: Sim, e: Unit): Unit | Device | undefined {
  const allies = s.units.filter((a) => a.side === 'ally' && alive(a))
  const relay = s.devices.find((d) => d.k === 'relay' && d.hp > 0)
  if (e.kind === 'mite' && relay) return relay
  const ian = allies.find((a) => a.kind === 'ian' && a.taunt > 0)
  if (ian && e.kind !== 'mite') return ian
  if (relay && e.kind === 'hound' && e.lv && (e.id.length + Math.floor(e.hy)) % 3 === 0) return relay
  let best: Unit | undefined, bd = 1e9
  for (const a of allies) { const d = dist(e, a) - (a.kind === 'ian' ? 60 : 0); if (d < bd) { bd = d; best = a } }
  return best
}
const isDev = (x: Unit | Device): x is Device => 'k' in x && !('side' in x)

function devDamage(s: Sim, d: Device, amt: number) {
  const v = Math.round(amt * (d.guard > 0 ? 0.25 : 1))
  d.hp = Math.max(0, d.hp - v)
  s.cnt.relayMin = Math.min(s.cnt.relayMin, d.hp / d.max)
  fx(s, { k: 'num', x: d.x, y: d.y - 150, dur: 0.8, v, text: 'dev' })
  fx(s, { k: 'hitD', x: d.x, y: d.y - 70, dur: 0.3 })
}

// ───────── 자동(AUTO): 액티브·버프만 쓴다. 집중 지정·장치는 하지 않는다 ─────────
function autoCast(s: Sim) {
  const foes = targets(s).filter((e) => !e.passive)
  const allies = s.units.filter((a) => a.side === 'ally' && alive(a))
  const low = (r: number) => allies.some((a) => a.hp < stat(a, 'maxHp') * r)
  const casting = foes.some((e) => e.tele && (e.tele.k === 'cast' || e.tele.k === 'noise' || e.tele.k === 'call'))
  const relay = s.devices.find((d) => d.k === 'relay' && d.hp > 0)
  for (const id of ALLY_ORDER) {
    const ab = s.abil[id]; if (!ab) continue
    if (ab.a.left === 0) {
      if (id === 'rion' && (foes.length >= 2 || casting)) castActive(s, id)
      else if (id === 'seren' && foes.length) castActive(s, id)
      else if (id === 'ian' && (low(0.75) || foes.some((e) => e.tele && e.tele.k === 'slam'))) castActive(s, id)
      else if (id === 'kanna' && (low(0.8) || foes.length >= 3)) castActive(s, id)
    }
    if (ab.b.left === 0 && foes.length) {
      if (id === 'ian' ? (relay ? relay.hp < relay.max * 0.9 : low(0.5)) : id === 'kanna' ? low(0.65) : foes.length >= 2) castBuff(s, id)
    }
  }
}

// ───────── 한 틱 ─────────
export function step(s: Sim, dt: number, auto: boolean) {
  for (const f of s.fx) f.t += dt
  s.fx = s.fx.filter((f) => f.t < f.dur)
  if (s.cutin && (s.cutin.t += dt) > 1.0) s.cutin = null
  if (s.tip && (s.tip.t += dt) > 5) s.tip = null
  if (s.result) return
  s.t += dt
  s.shake = Math.max(0, s.shake - dt)
  const due = s.timers.filter((x) => x.at <= s.t); s.timers = s.timers.filter((x) => x.at > s.t); due.forEach((x) => x.f())
  for (const id of Object.keys(s.abil)) { const a = s.abil[id]; a.a.left = Math.max(0, a.a.left - dt); a.b.left = Math.max(0, a.b.left - dt); a.b.on = Math.max(0, a.b.on - dt) }
  for (const d of s.devices) { if (d.guard > 0) d.guard -= dt; if (d.closed > 0 && (d.closed -= dt) <= 0) { d.closed = 0; d.cool = 25; fx(s, { k: 'word', x: d.x, y: d.y - 140, dur: 1.2, text: '셔터 열림' }) } else if (d.cool > 0) d.cool = Math.max(0, d.cool - dt) }
  if (auto) autoCast(s)
  scriptTick(s)

  for (const u of s.units) {
    if (u.dead) { u.dead += dt; continue }
    if (u.frz > 0) { u.frz -= dt; continue }
    if (u.act && (u.act.t += dt) >= u.act.dur) u.act = null
    if (u.shieldT > 0 && (u.shieldT -= dt) <= 0) u.shield = 0
    if (u.taunt > 0) u.taunt -= dt
    if (u.vuln > 0) u.vuln -= dt
    if (u.slowT > 0) u.slowT -= dt
    for (const b of u.buffs) { b.t -= dt; if (b.regen) heal(s, s.units.find((x) => x.id === b.src) ?? u, u, stat(u, 'maxHp') * b.regen * dt) }
    u.buffs = u.buffs.filter((b) => b.t > 0)
    if (u.stun > 0) { u.stun -= dt; continue }
    if (u.act?.k === 'stagger') continue
    if (u.side === 'ally') allyTick(s, u, dt)
    else foeTick(s, u, dt)
  }
  projTick(s, dt)
  separate(s, dt)
  s.units = s.units.filter((u) => u.side === 'ally' || u.dead < 1.4)
  checkEnd(s)
}

// 대원 이동: 역할마다 자리를 스스로 잡는다(이동 조작은 없지만 대원은 계속 움직인다)
// - 이안: 전선으로 나가 적을 몸으로 막는다 · 세렌: 검을 들고 파고들어 베고 빠진다
// - 라온·칸나: 거리를 유지하며 위치를 바꾼다(가까이 오면 뒤로 빠짐) · 칸나는 다친 대원 쪽으로
const SPEED: Record<string, number> = { ian: 250, seren: 400, rion: 270, kanna: 260 }
function steer(u: Unit, tx: number, ty: number, dt: number, speed: number) {
  tx = Math.max(70, Math.min(1180, tx)); ty = Math.max(305, Math.min(690, ty))
  const dx = tx - u.x, dy = ty - u.y, L = Math.hypot(dx, dy)
  const want = L < 8 ? 0 : Math.min(speed, L * 4)
  const k = Math.min(1, dt * 8)
  u.vx += ((L ? dx / L : 0) * want - u.vx) * k; u.vy += ((L ? dy / L : 0) * want - u.vy) * k
  u.x += u.vx * dt; u.y += u.vy * dt
  if (Math.abs(u.vx) > 30) u.face = u.vx > 0 ? 1 : -1
}
function nearestFoe(s: Sim, x: number, y: number, skipPassive = true) {
  let best: Unit | undefined, bd = 1e9
  for (const e of s.units) if (e.side === 'enemy' && alive(e) && !e.entering && !(skipPassive && e.passive)) { const d = Math.hypot(e.x - x, (e.y - y) * 1.5); if (d < bd) { bd = d; best = e } }
  return { e: best, d: bd }
}
function allyTick(s: Sim, u: Unit, dt: number) {
  u.hop = Math.max(0, u.hop - dt * 260)
  // 등장: 달려 들어온다
  if (u.entering) { steer(u, u.hx, u.hy, dt, 460); if (Math.abs(u.hx - u.x) < 10) u.entering = false; return }
  if (u.act?.k === 'dash') {
    const a = u.act; const k = a.t / a.dur; const p = k < 0.22 ? k / 0.22 : k > 0.78 ? (1 - k) / 0.22 : 1
    u.x = (a.fx ?? u.hx) + ((a.tx ?? u.hx) - (a.fx ?? u.hx)) * p; u.y = (a.fy ?? u.hy) + ((a.ty ?? u.hy) - (a.fy ?? u.hy)) * p
    u.vx = 0; u.vy = 0
    return
  }
  if (u.task) { taskTick(s, u, dt); return }
  const busy = u.act && (u.act.k === 'atk' || u.act.k === 'skill' || u.act.k === 'buff' || u.act.k === 'use')
  const t = pickTarget(s, u)
  const near = nearestFoe(s, u.x, u.y)
  const front = s.units.filter((e) => e.side === 'enemy' && alive(e) && !e.entering && !e.passive).reduce((m, e) => Math.min(m, e.x), 1300)
  const ph = s.t * 0.6 + u.hy * 0.013
  let tx = u.hx, ty = u.hy, sp = SPEED[u.kind] ?? 260
  if (u.kind === 'ian') {
    // 지킬 대상(장치 또는 팀) 앞 520 안에 들어온 적을 몸으로 막는다
    const g = near.e && Math.abs(near.e.x - u.hx) < 520 ? near.e : undefined
    if (g) { tx = g.x - 92; ty = g.y + 2 } else { tx = u.hx + Math.sin(ph) * 14; ty = u.hy + Math.cos(ph * 0.8) * 18 }
  } else if (u.kind === 'seren') {
    const mx = stat(u, 'maxHp')
    // 이안과 겹치지 않게 대각선 위·아래에서 파고든다
    if (t && u.hp > mx * 0.3) { tx = t.x - (t.kind === 'boss' ? 160 : 60); ty = t.y + (t.y < 600 ? 72 : -72) } else { tx = u.hx; ty = u.hy } // 이안(정면)과 겹치지 않게 앞쪽 대각선에서 벤다
  } else {
    // 원거리: 전선에서 거리를 두고 좌우·위아래로 자리를 바꾼다
    const keep = u.kind === 'rion' ? 330 : 360
    tx = Math.min(u.hx + 40, front - keep) + Math.sin(ph * 1.3) * 30
    ty = u.hy + Math.sin(ph) * 46
    if (u.kind === 'kanna') { const low = s.units.filter((a) => a.side === 'ally' && alive(a) && a !== u).sort((a, b) => a.hp / stat(a, 'maxHp') - b.hp / stat(b, 'maxHp'))[0]; if (low && low.hp < stat(low, 'maxHp') * 0.6) { tx = Math.min(tx, low.x - 130); ty = low.y + 30 } }
    if (near.e && near.d < 210) { const ang = Math.atan2(u.y - near.e.y, u.x - near.e.x); tx = u.x + Math.cos(ang) * 220 - 60; ty = u.y + Math.sin(ang) * 120; sp *= 1.5; if (u.hop === 0 && s.rnd() < dt * 2) u.hop = 26 }
  }
  // 서로 겹치지 않게
  for (const o of s.units) if (o !== u && o.side === 'ally' && alive(o)) { const d = Math.hypot(u.x - o.x, (u.y - o.y) * 1.6); if (d < 70) { tx += (u.x - o.x) / (d + 1) * 60; ty += (u.y - o.y) / (d + 1) * 40 } }
  if (!busy) steer(u, tx, ty, dt, sp); else { u.vx *= 0.8; u.vy *= 0.8 }
  if (t) u.face = t.x >= u.x ? 1 : -1

  u.cd -= dt * (1 + stat(u, 'atkSpd'))
  if (u.cd > 0 || busy || !t) return
  const hx = u.x + 50 * u.face, hy = u.y - (u.kind === 'rion' ? 115 : 85)
  if (u.kind === 'seren' || u.kind === 'ian') { if (Math.hypot(t.x - u.x, (t.y - u.y) * 1.5) > (u.kind === 'seren' ? 130 : 150) + (t.kind === 'boss' ? 110 : 0)) return }
  // 기본 공격은 3타 연속: 1·2타는 바로 이어지고, 3타(마무리)는 더 세게 치고 길게 쉰다. 평균 공격 속도는 예전과 같게 맞춤
  u.basicN++
  const n = ((u.basicN - 1) % 3) + 1
  const C = COMBO[u.kind as AllyKind]
  const dur = C.dur[n - 1], imp = C.imp[n - 1]
  u.cd = n < 3 ? 0.02 : Math.max(0.4, u.interval * 3 * (0.92 + s.rnd() * 0.16) - C.dur.reduce((x, y) => x + y, 0))
  const crit = s.rnd() < stat(u, 'critRate')
  const fin = n === 3
  u.act = { k: 'atk', t: 0, dur, n, imp, tx: t.x, ty: t.y }
  if (u.kind === 'rion') {
    later(s, imp, () => { if (alive(u)) s.proj.push({ id: s.seq++, k: 'ring', x: u.x + 50 * u.face, y: hy, tx: t.id, spd: fin ? 980 : 820, dmg: fin ? 1.3 : 0.85, from: u.id, crit, brk: fin ? 3 : 2, abil: false }) })
  } else if (u.kind === 'seren') {
    // 근접 베기: 1타 가로 베기 · 2타 올려 베기 · 3타 찌르기(크게 밀어냄). 치명타면 검기 한 줄이 더 날아간다
    later(s, imp, () => { if (alive(u) && alive(t)) { damage(s, u, t, fin ? 1.3 : 0.98, { crit, push: fin ? 46 : 14 }); fx(s, { k: fin ? 'slashBig' : 'slashHit', x: t.x, y: t.y - headOf(t) * 0.45, dur: 0.35, v: n }); fx(s, { k: 'swing', x: u.x + 40 * u.face, y: u.y - 70, dur: 0.25, v: u.face }) } })
    if (crit) later(s, imp + 0.06, () => { if (alive(u) && alive(t)) s.proj.push({ id: s.seq++, k: 'slash', x: hx, y: hy - 20, tx: t.id, spd: 1250, dmg: 0.5, from: u.id, crit: false, brk: 1, abil: false }) })
    if (fin && s.rnd() < 0.5) later(s, dur, () => { if (alive(u)) { u.vx = -u.face * 420; u.hop = 22 } })
  } else if (u.kind === 'kanna') {
    later(s, imp, () => { if (alive(u) && alive(t)) s.proj.push({ id: s.seq++, k: 'cube', x: u.x + 50 * u.face, y: hy, tx: t.id, spd: 640, dmg: fin ? 1.2 : 0.75, from: u.id, crit, brk: 1, abil: false }) })
    if (fin) { const low = s.units.filter((a) => a.side === 'ally' && alive(a)).sort((a, b) => a.hp / stat(a, 'maxHp') - b.hp / stat(b, 'maxHp'))[0]; later(s, imp, () => heal(s, u, low, stat(low, 'maxHp') * 0.08)) }
  } else if (u.kind === 'ian') {
    later(s, imp, () => { if (alive(u) && alive(t)) { damage(s, u, t, fin ? 1.1 : 0.72, { crit, push: fin ? 52 : 22 }); fx(s, { k: 'bash', x: t.x, y: t.y - headOf(t) * 0.45, dur: 0.35, v: n }); u.taunt = Math.max(u.taunt, 1.2) } })
  }
}
// 3타 연속 공격 시간(초): dur = 동작 길이, imp = 맞는 순간
const COMBO: Record<AllyKind, { dur: number[]; imp: number[] }> = {
  seren: { dur: [0.4, 0.4, 0.55], imp: [0.13, 0.13, 0.22] },
  ian: { dur: [0.45, 0.45, 0.6], imp: [0.16, 0.16, 0.27] },
  kanna: { dur: [0.5, 0.5, 0.6], imp: [0.2, 0.2, 0.26] },
  rion: { dur: [0.55, 0.55, 0.75], imp: [0.22, 0.22, 0.32] },
}
/** 몸끼리 겹치지 않게 밀어낸다(아군·적 모두). 돌진 중·고정체는 제외 */
const RAD: Partial<Record<Kind, number>> = { boss: 120, golem: 62, hound: 44, mite: 34, orb: 36, pylon: 50, caller: 56 }
function separate(s: Sim, dt: number) {
  const us = s.units.filter((u) => alive(u) && !u.entering && u.act?.k !== 'dash')
  for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) {
    const a = us[i], b = us[j]
    const ra = RAD[a.kind] ?? 40, rb = RAD[b.kind] ?? 40
    const dx = b.x - a.x, dy = (b.y - a.y) * 1.8, d = Math.hypot(dx, dy) || 0.01, min = ra + rb
    if (d >= min) continue
    const push = (min - d) * Math.min(1, dt * 10)
    const wa = a.statik ? 0 : b.statik ? 1 : (rb / (ra + rb)), wb = 1 - wa
    a.x -= dx / d * push * wa; a.y -= dy / d * push * wa * 0.55; b.x += dx / d * push * wb; b.y += dy / d * push * wb * 0.55
  }
  for (const u of us) { u.x = Math.max(50, Math.min(1250, u.x)); u.y = Math.max(300, Math.min(692, u.y)) }
}
function taskTick(s: Sim, u: Unit, dt: number) {
  const tk = u.task!; const d = s.devices.find((x) => x.id === tk.dev)!
  const go = (tx: number, ty: number) => { const dx = tx - u.x, dy = ty - u.y, L = Math.hypot(dx, dy); if (L < 6) return true; const sp = 420 * dt; u.x += dx / L * Math.min(sp, L); u.y += dy / L * Math.min(sp, L); u.face = dx >= 0 ? 1 : -1; return false }
  if (tk.ph === 'go') { if (go(d.x - 46, d.y + 4)) { tk.ph = 'use'; tk.t = 0; u.act = { k: 'use', t: 0, dur: 0.8 } } }
  else if (tk.ph === 'use') {
    if ((tk.t += dt) >= 0.8) {
      d.closed = 20; s.cnt.shutter++; s.shake = Math.max(s.shake, 0.25)
      fx(s, { k: 'shutter', x: d.x, y: LANE_Y[d.lane], dur: 1.2 }); fx(s, { k: 'banner', x: 640, y: 240, dur: 1.4, text: `${d.label} 봉쇄 · 20초` })
      // 그 길로 들어오던 적은 셔터에 밀려난다
      for (const e of s.units) if (e.side === 'enemy' && alive(e) && e.entering && Math.abs(e.y - LANE_Y[d.lane]) < 70) damage(s, u, e, 2.5, { abil: true })
      tk.ph = 'back'
    }
  } else if (go(u.hx, u.hy)) { u.task = null; u.face = 1 }
}

function foeTick(s: Sim, e: Unit, dt: number) {
  e.hop = Math.max(0, e.hop - dt * 260); e.vx *= 0.85
  const slow = e.slowT > 0 ? 0.8 : 1
  // 등장: 오른쪽에서 걸어 들어온다(정해진 자리까지)
  if (e.entering) {
    const dx = e.hx - e.x
    if (Math.abs(dx) > 3) { e.x += Math.sign(dx) * Math.min(Math.abs(dx), Math.max(150, FOE[e.kind as FoeKind].speed * 2.2) * dt); return }
    e.entering = false
  }
  if (e.statik) { tickTele(s, e, dt); return }
  if (e.act?.k === 'dash') {
    const a = e.act; const k = Math.min(1, a.t / a.dur)
    e.x = (a.fx ?? e.x) + ((a.tx ?? e.x) - (a.fx ?? e.x)) * k; e.y = (a.fy ?? e.y) + ((a.ty ?? e.y) - (a.fy ?? e.y)) * k
    return
  }
  if (e.tele) { tickTele(s, e, dt); return }
  e.teleCd -= dt; e.teleCd2 -= dt
  const t = foeTarget(s, e)
  if (!t) return
  const d = dist(e, t)
  if (startTele(s, e, t, d)) return
  if (e.kind === 'boss') bossTick(s, e)
  if (d > e.range) {
    const ang = Math.atan2(t.y - e.y, t.x - e.x)
    const sp = FOE[e.kind as FoeKind].speed * slow
    e.x += Math.cos(ang) * sp * dt; e.y += Math.sin(ang) * sp * dt * 0.75
    e.face = t.x < e.x ? -1 : 1
    for (const o of s.units) if (o !== e && o.side === 'enemy' && alive(o) && !o.statik) { const dd = dist(e, o); const r = e.kind === 'boss' || o.kind === 'boss' ? 150 : 64; if (dd < r) { e.x += (e.x - o.x) / (dd + 1) * 45 * dt; e.y += (e.y - o.y) / (dd + 1) * 30 * dt } }
    e.y = Math.max(300, Math.min(690, e.y))
    return
  }
  e.cd -= dt * slow
  if (e.cd > 0) return
  e.cd = e.interval * (0.9 + s.rnd() * 0.2)
  e.act = { k: 'atk', t: 0, dur: 0.5, tx: t.x, ty: t.y }
  if (e.kind === 'orb') { s.proj.push({ id: s.seq++, k: 'bolt', x: e.x - 30, y: e.y - 100, tx: isDev(t) ? t.id : t.id, spd: 560, dmg: 1, from: e.id, crit: false, brk: 1, abil: false }); return }
  later(s, 0.2, () => {
    if (!alive(e)) return
    if (isDev(t)) { if (t.hp > 0) devDamage(s, t, stat(e, 'atk') * (e.kind === 'mite' ? 0.75 : 0.8)) }
    else if (alive(t)) { damage(s, e, t, 1); if (e.kind === 'golem' || e.kind === 'boss') s.shake = Math.max(s.shake, 0.14) }
  })
}

/** 예고 시작 조건 */
function startTele(s: Sim, e: Unit, t: Unit | Device, d: number): boolean {
  if (e.teleCd > 0 || isDev(t)) return false
  const mx = stat(e, 'maxHp')
  if (e.kind === 'hound' && d > 170 && d < 620) {
    const ang = Math.atan2(t.y - e.y, t.x - e.x); const L = Math.hypot(t.x - e.x, t.y - e.y) + 90
    e.tele = { k: 'charge', name: '돌진', t: 0, dur: 1.15, x: e.x, y: e.y, x2: e.x + Math.cos(ang) * L, y2: e.y + Math.sin(ang) * L, r: 0, w: 78, need: mx * 0.2, acc: 0 }
    e.teleCd = 8 + s.rnd() * 4; return true
  }
  if (e.kind === 'golem' && d < 280) {
    e.tele = { k: 'slam', name: '강타', t: 0, dur: 1.6, x: t.x, y: t.y, x2: 0, y2: 0, r: 120, w: 0, need: mx * 0.14, acc: 0 }
    e.teleCd = 9 + s.rnd() * 2; return true
  }
  if (e.kind === 'orb' && d < 700) {
    e.tele = { k: 'cast', name: '결정 광선', t: 0, dur: 2.4, x: e.x, y: e.y, x2: 0, y2: 0, r: 0, w: 0, need: mx * 0.22, acc: 0 }
    e.teleCd = 8 + s.rnd() * 3; return true
  }
  if (e.kind === 'boss') {
    if (e.phase >= 3 && e.teleCd2 <= 0) {
      e.tele = { k: 'noise', name: '전역 노이즈', t: 0, dur: 3.8, x: e.x, y: e.y, x2: 0, y2: 0, r: 0, w: 0, need: mx * 0.055, acc: 0 }
      e.teleCd2 = 15; e.teleCd = Math.max(e.teleCd, 3); return true
    }
    if (d < 360 && s.rnd() < 0.6) {
      e.tele = { k: 'slam', name: '결정 강타', t: 0, dur: 1.5, x: t.x, y: t.y, x2: 0, y2: 0, r: 150, w: 0, need: Infinity, acc: 0 }
      e.teleCd = 7; return true
    }
    if (d > 200) {
      const ang = Math.atan2(t.y - e.y, t.x - e.x); const L = Math.hypot(t.x - e.x, t.y - e.y) + 120
      e.tele = { k: 'charge', name: '노이즈 돌진', t: 0, dur: 1.4, x: e.x, y: e.y, x2: e.x + Math.cos(ang) * L, y2: e.y + Math.sin(ang) * L, r: 0, w: 120, need: Infinity, acc: 0 }
      e.teleCd = 8; return true
    }
  }
  return false
}
function tickTele(s: Sim, e: Unit, dt: number) {
  if (e.kind === 'caller') {
    e.teleCd -= dt
    if (!e.tele && e.teleCd <= 0) { e.tele = { k: 'call', name: '호출', t: 0, dur: 3, x: e.x, y: e.y, x2: 0, y2: 0, r: 0, w: 0, need: stat(e, 'maxHp') * 0.12, acc: 0 }; e.teleCd = 10 }
  }
  const tl = e.tele
  if (!tl) return
  if ((tl.t += dt) < tl.dur) return
  e.tele = null
  const atk = stat(e, 'atk')
  const allies = s.units.filter((a) => a.side === 'ally' && alive(a))
  if (tl.k === 'slam') {
    s.shake = Math.max(s.shake, 0.35)
    fx(s, { k: 'slam', x: tl.x, y: tl.y, dur: 0.6, r: tl.r })
    e.act = { k: 'atk', t: 0, dur: 0.5 }
    for (const a of allies) if (Math.hypot(a.x - tl.x, (a.y - tl.y) * 1.6) < tl.r) damage(s, e, a, e.kind === 'boss' ? 2.6 : 2.4)
    for (const d of s.devices) if (d.k === 'relay' && Math.hypot(d.x - tl.x, (d.y - tl.y) * 1.6) < tl.r) devDamage(s, d, atk * 1.5)
  } else if (tl.k === 'charge') {
    e.act = { k: 'dash', t: 0, dur: 0.32, tx: tl.x2, ty: Math.max(300, Math.min(690, tl.y2)), fx: e.x, fy: e.y }
    later(s, 0.16, () => {
      if (!alive(e)) return
      for (const a of s.units.filter((x) => x.side === 'ally' && alive(x))) if (segDist(a.x, a.y, tl.x, tl.y, tl.x2, tl.y2) < tl.w * 0.6) { damage(s, e, a, e.kind === 'boss' ? 2.2 : 1.6); a.act = { k: 'hit', t: 0, dur: 0.3 } }
      fx(s, { k: 'chargeHit', x: tl.x, y: tl.y, x2: tl.x2, y2: tl.y2, dur: 0.4 })
    })
  } else if (tl.k === 'cast') {
    const tg = [...allies].sort((a, b) => a.hp / stat(a, 'maxHp') - b.hp / stat(b, 'maxHp'))[0]
    if (tg) { fx(s, { k: 'beam', x: e.x - 20, y: e.y - 110, x2: tg.x, y2: tg.y - 70, dur: 0.5 }); damage(s, e, tg, 4) }
    e.act = { k: 'atk', t: 0, dur: 0.5 }
  } else if (tl.k === 'call') {
    const open = s.devices.filter((d) => d.k === 'shutter' && d.closed <= 0).map((d) => d.lane)
    const lanes = s.devices.some((d) => d.k === 'shutter') ? open : [0, 2]
    if (!lanes.length) fx(s, { k: 'banner', x: 640, y: 240, dur: 1.3, text: '호출 실패 — 길이 막혔다' })
    for (const ln of lanes) spawn(s, { k: s.rnd() < 0.25 ? 'mite' : 'hound', lane: ln, x: 760 + s.rnd() * 200 })
    fx(s, { k: 'summon', x: e.x, y: e.y - 120, dur: 1 })
  } else if (tl.k === 'noise') {
    s.shake = Math.max(s.shake, 0.6)
    fx(s, { k: 'noise', x: 640, y: 360, dur: 1.2 })
    for (const a of allies) { damage(s, e, a, 0, { trueDmg: stat(a, 'maxHp') * 0.38 }); a.stun = Math.max(a.stun, 1) }
  }
}
function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1; const L = dx * dx + dy * dy || 1
  const k = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L))
  return Math.hypot(px - (x1 + dx * k), (py - (y1 + dy * k)) * 1.4)
}
function bossTick(s: Sim, e: Unit) {
  const r = e.hp / stat(e, 'maxHp')
  if (e.phase === 1 && r <= 0.7) {
    e.phase = 2; e.act = { k: 'roar', t: 0, dur: 1.2 }; s.shake = 0.5
    fx(s, { k: 'banner', x: 640, y: 240, dur: 1.8, text: '스태틱이 중계 기둥을 세웠다' })
    spawn(s, { k: 'pylon', x: 1190, y: 335 }); spawn(s, { k: 'pylon', x: 1185, y: 640 })
    s.flags.pylons = s.t
  }
  if (e.phase === 2 && r <= 0.35) {
    e.phase = 3; e.act = { k: 'roar', t: 0, dur: 1.2 }; s.shake = 0.5; e.teleCd2 = 2
    fx(s, { k: 'banner', x: 640, y: 240, dur: 1.8, text: '스태틱의 출력이 치솟는다' })
  }
  if (e.phase >= 2 && (s.flags.miteT ?? 0) <= s.t) { s.flags.miteT = s.t + 14; spawn(s, { k: 'mite', lane: 0, x: 900 }); spawn(s, { k: 'mite', lane: 2, x: 900 }) }
}

function projTick(s: Sim, dt: number) {
  for (const p of s.proj) {
    const from = s.units.find((u) => u.id === p.from)
    if (p.k === 'wave') {
      p.x += p.spd * dt; p.life! -= dt
      for (const e of s.units) if (e.side === 'enemy' && alive(e) && !e.entering && !p.seen!.includes(e.id) && Math.abs(e.x - p.x) < 46) { p.seen!.push(e.id); damage(s, from, e, p.dmg, { abil: true, brk: p.brk }) }
      if (p.x > 1360 || p.life! <= 0) p.spd = 0
      continue
    }
    const t = s.units.find((e) => e.id === p.tx) ?? s.devices.find((d) => d.id === p.tx)
    if (!t || (isDev(t) ? t.hp <= 0 : !alive(t))) { p.spd = 0; continue }
    const tx = t.x, ty = t.y - (isDev(t) ? 70 : headOf(t) * 0.5)
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy)
    if (d < p.spd * dt + 10) {
      p.spd = 0
      if (isDev(t)) { devDamage(s, t, from ? stat(from, 'atk') : 60); continue }
      damage(s, from, t, p.dmg, { crit: p.crit, brk: p.brk })
      if (p.k === 'cube') { fx(s, { k: 'cubePop', x: tx, y: ty, dur: 0.5 }); t.slowT = 2 }
      if (p.k === 'slash') fx(s, { k: 'slashHit', x: tx, y: ty, dur: 0.35 })
      if (p.k === 'ring') fx(s, { k: 'ringHit', x: tx, y: ty, dur: 0.4 })
    } else { p.x += dx / d * p.spd * dt; p.y += dy / d * p.spd * dt }
  }
  s.proj = s.proj.filter((p) => p.spd > 0)
}

// ───────── 스테이지 진행 ─────────
function scriptTick(s: Sim) {
  const def = s.def
  // 시간표 등장
  while (def.timeline && s.tl < def.timeline.length && def.timeline[s.tl].t <= s.t) { def.timeline[s.tl].spawn.forEach((sp, i) => spawn(s, sp, i * 0.5)); s.tl++ }
  // 웨이브
  const foes = s.units.filter((e) => e.side === 'enemy' && e.kind !== 'pylon')
  if (def.waves && s.wave < def.waves.length && !foes.some(alive) && foes.every((e) => e.dead > 0.6)) spawnWave(s)
  // 안내
  if (!s.tip) for (const tp of def.tips ?? []) if (!s.seenTips.includes(tp.id) && tp.when(s)) { s.seenTips.push(tp.id); s.tip = { id: tp.id, text: tp.text, at: tp.at, ref: tp.ref, t: 0 }; if (tp.slow) s.slowmo = 2.2; break }
}
function checkEnd(s: Sim) {
  const def = s.def
  if (!s.units.some((u) => u.side === 'ally' && alive(u))) { s.result = 'lose'; s.why = '대원이 모두 쓰러졌습니다'; return }
  const relay = s.devices.find((d) => d.k === 'relay')
  if (relay && relay.hp <= 0) { s.result = 'lose'; s.why = '중계기가 파괴됐습니다'; return }
  if (def.goal === 'defend' && s.t >= (def.defendT ?? 75)) {
    s.result = 'win'; s.why = '수신 완료'
    for (const e of s.units) if (e.side === 'enemy' && alive(e)) { e.dead = 0.0001; fx(s, { k: 'dieE', x: e.x, y: e.y - 40, dur: 0.9, who: e.kind }) }
    return
  }
  if (def.goal === 'target' && s.units.some((e) => e.kind === 'caller' && e.dead > 0)) { s.result = 'win'; s.why = '호출 결정체 제압'; for (const e of s.units) if (e.side === 'enemy' && alive(e)) e.dead = 0.0001; return }
  if (def.goal === 'boss' && s.units.some((e) => e.kind === 'boss' && e.dead > 0)) { s.result = 'win'; s.why = '스태틱 토벌'; for (const e of s.units) if (e.side === 'enemy' && alive(e)) e.dead = 0.0001; return }
  if (def.goal === 'eliminate' && def.waves && s.wave >= def.waves.length && !s.units.some((e) => e.side === 'enemy' && (alive(e) || e.dead < 0.6)) && !s.timers.length) { s.result = 'win'; s.why = '구역 확보'; return }
  if (s.t >= def.limit && def.goal !== 'defend') { s.result = 'lose'; s.why = '제한 시간 초과' }
}

/** 결과 판정용 별(1장 기준 3개) */
export function starsOf(s: Sim) { return s.def.stars.map((x) => s.result === 'win' && x.ok(s)) }
/** 테스트용: 남은 적 모두 쓰러뜨리기 */
export function killAll(s: Sim) { for (const e of s.units) if (e.side === 'enemy' && alive(e)) damage(s, undefined, e, 0, { trueDmg: 9e9, noNum: true }) }
