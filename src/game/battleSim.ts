// 전투 테스트용 실시간 전투 시뮬레이션(화면과 분리된 순수 로직). 좌표는 1280×720 캔버스, 발 위치 기준.
// 값은 테스트용 샘플이며 실제 전투 규칙·수치는 아직 정해지지 않았다.
export type Side = 'ally' | 'enemy'
export type Kind = 'rion' | 'seren' | 'ian' | 'kanna' | 'hound' | 'golem' | 'orb'
export interface Ent {
  id: string; side: Side; kind: Kind; name: string
  x: number; y: number; hx: number; hy: number // 현재 / 제자리
  hp: number; max: number; atk: number; range: number; speed: number; interval: number
  cd: number; shield: number; shieldT: number; taunt: number
  act: { k: 'atk' | 'skill' | 'hit' | 'dash'; t: number; dur: number; tx?: number; ty?: number } | null
  dead: number // 쓰러진 뒤 지난 시간(0 = 살아 있음)
  entering: boolean // 등장 중(제자리까지 걸어 들어옴)
  dealt: number; heal: number
}
export interface Proj { id: number; k: 'ring' | 'cube' | 'slash' | 'bolt' | 'skillRing'; x: number; y: number; tx: string; spd: number; dmg: number; from: string; crit?: boolean; hitAll?: boolean; seen?: Set<string> }
export interface Fx { id: number; k: string; x: number; y: number; t: number; dur: number; v?: number; crit?: boolean; heal?: boolean; shield?: boolean; text?: string }
export interface Skill { id: Kind; name: string; cd: number; left: number }
export interface Sim {
  t: number; limit: number; wave: number; waves: number
  ents: Ent[]; proj: Proj[]; fx: Fx[]; skills: Record<string, Skill>
  shake: number; result: null | 'win' | 'lose'; seq: number; cutin: null | { kind: Kind; name: string; t: number }
}

const R = Math.random
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.6)
const alive = (e: Ent) => e.dead === 0

const ALLY: Record<string, Omit<Ent, 'id' | 'side' | 'x' | 'y' | 'hp' | 'cd' | 'shield' | 'shieldT' | 'taunt' | 'act' | 'dead' | 'dealt' | 'heal' | 'entering'>> = {
  rion: { kind: 'rion', name: 'RION', hx: 520, hy: 560, max: 2187, atk: 118, range: 900, speed: 0, interval: 2.4 },
  seren: { kind: 'seren', name: 'SEREN', hx: 540, hy: 318, max: 2034, atk: 150, range: 900, speed: 0, interval: 1.6 },
  ian: { kind: 'ian', name: 'IAN', hx: 285, hy: 345, max: 2861, atk: 72, range: 900, speed: 0, interval: 1.8 },
  kanna: { kind: 'kanna', name: 'KANNA', hx: 185, hy: 490, max: 1924, atk: 96, range: 900, speed: 0, interval: 2.0 },
}
export const SKILLS: Record<string, { name: string; cd: number; desc: string }> = {
  rion: { name: '주파수 폭발', cd: 6, desc: '앞의 적 모두에게 음파를 날린다' },
  seren: { name: '월광 일섬', cd: 6, desc: '가장 체력이 많은 적에게 달려가 3연속 베기' },
  ian: { name: '방벽 전개', cd: 8, desc: '아군 전원 보호막 + 적의 공격을 끈다' },
  kanna: { name: '큐브 낙하', cd: 5, desc: '적에게 큐브를 떨어뜨리고 아군을 회복' },
}
const FOE: Record<string, { name: string; max: number; atk: number; range: number; speed: number; interval: number }> = {
  hound: { name: '결정 사냥개', max: 2100, atk: 118, range: 70, speed: 78, interval: 1.3 },
  golem: { name: '결정 거인', max: 6800, atk: 260, range: 95, speed: 40, interval: 2.3 },
  orb: { name: '결정 구체', max: 1300, atk: 92, range: 520, speed: 30, interval: 2.0 },
}
const WAVES: [string, number, number][][] = [
  [['hound', 880, 250], ['hound', 870, 340], ['hound', 1060, 430], ['golem', 1040, 250], ['orb', 1190, 300]],
  [['hound', 1180, 300], ['hound', 1210, 420], ['orb', 1150, 210], ['orb', 1230, 360], ['golem', 1230, 520]],
]

function mk(side: Side, kind: Kind, id: string, hx: number, hy: number, d: { name: string; max: number; atk: number; range: number; speed: number; interval: number }): Ent {
  return { id, side, kind, name: d.name, x: side === 'enemy' ? hx + 260 : hx - 220, y: hy, hx, hy, hp: d.max, max: d.max, atk: d.atk, range: d.range, speed: d.speed, interval: d.interval, cd: 0.6 + R() * 1.2, shield: 0, shieldT: 0, taunt: 0, act: null, dead: 0, dealt: 0, heal: 0, entering: true }
}
export function newSim(): Sim {
  const ents: Ent[] = Object.entries(ALLY).map(([k, d]) => mk('ally', k as Kind, k, d.hx, d.hy, d))
  const s: Sim = { t: 0, limit: 90, wave: 1, waves: WAVES.length, ents, proj: [], fx: [], skills: {}, shake: 0, result: null, seq: 1, cutin: null }
  for (const [k, v] of Object.entries(SKILLS)) s.skills[k] = { id: k as Kind, name: v.name, cd: v.cd, left: v.cd }
  spawn(s, 0)
  return s
}
function spawn(s: Sim, w: number) {
  WAVES[w].forEach(([k, x, y], i) => s.ents.push(mk('enemy', k as Kind, `${k}${w}${i}`, x, y, FOE[k])))
}
const fx = (s: Sim, f: Omit<Fx, 'id' | 't'>) => { s.fx.push({ ...f, id: s.seq++, t: 0 }) }

function damage(s: Sim, from: Ent | undefined, to: Ent, amt: number, crit = false) {
  if (!alive(to)) return
  let v = Math.round(amt * (0.9 + R() * 0.2) * (crit ? 1.6 : 1))
  if (to.shield > 0) { const a = Math.min(to.shield, v); to.shield -= a; v -= a; if (a > 0) fx(s, { k: 'num', x: to.x, y: to.y - 150, dur: 0.9, v: a, shield: true }) }
  to.hp = Math.max(0, to.hp - v)
  if (from) from.dealt += v
  if (v > 0) fx(s, { k: 'num', x: to.x + (R() - 0.5) * 30, y: to.y - (to.side === 'enemy' ? 120 : 150), dur: 0.9, v, crit })
  fx(s, { k: to.side === 'enemy' ? 'hitE' : 'hitA', x: to.x, y: to.y - 50, dur: 0.4 })
  to.act = to.act && to.act.k !== 'hit' ? to.act : { k: 'hit', t: 0, dur: 0.22 }
  if (to.hp <= 0) { to.dead = 0.0001; to.act = null; fx(s, { k: to.side === 'enemy' ? 'dieE' : 'dieA', x: to.x, y: to.y - 40, dur: 0.8 }) }
}
function healUnit(s: Sim, from: Ent, to: Ent, amt: number) {
  if (!alive(to)) return
  const v = Math.min(to.max - to.hp, Math.round(amt))
  to.hp += v; from.heal += v
  if (v >= 5) fx(s, { k: 'num', x: to.x, y: to.y - 160, dur: 1, v, heal: true })
  fx(s, { k: 'heal', x: to.x, y: to.y - 40, dur: 0.9 })
}
function nearest(s: Sim, e: Ent, side: Side) {
  let best: Ent | undefined, bd = 1e9
  for (const o of s.ents) if (o.side === side && alive(o)) { const d = dist(e, o); if (d < bd) { bd = d; best = o } }
  return best
}
function foeTarget(s: Sim, e: Ent) {
  const ian = s.ents.find((o) => o.kind === 'ian' && alive(o))
  if (ian && ian.taunt > 0) return ian
  return nearest(s, e, 'ally')
}
const handPos = (e: Ent) => e.kind === 'rion' ? { x: e.x + 60, y: e.y - 120 } : e.kind === 'kanna' ? { x: e.x + 55, y: e.y - 90 } : e.kind === 'seren' ? { x: e.x + 70, y: e.y - 60 } : e.kind === 'ian' ? { x: e.x + 60, y: e.y - 90 } : e.kind === 'orb' ? { x: e.x - 30, y: e.y - 70 } : { x: e.x, y: e.y - 60 }

export function castSkill(s: Sim, id: string): boolean {
  const sk = s.skills[id]; const u = s.ents.find((e) => e.id === id)
  if (!sk || !u || !alive(u) || sk.left > 0 || s.result) return false
  const foes = s.ents.filter((e) => e.side === 'enemy' && alive(e))
  if (!foes.length && id !== 'ian' && id !== 'kanna') return false
  sk.left = sk.cd
  s.cutin = { kind: u.kind, name: sk.name, t: 0 }
  s.shake = Math.max(s.shake, 0.25)
  u.act = { k: 'skill', t: 0, dur: 0.6 }
  if (id === 'rion') {
    const h = handPos(u)
    for (let i = 0; i < 3; i++) s.proj.push({ id: s.seq++, k: 'skillRing', x: h.x - i * 50, y: h.y, tx: '', spd: 900, dmg: u.atk * 1.2, from: u.id, hitAll: true, seen: new Set(), crit: i === 0 })
  } else if (id === 'seren') {
    const t = foes.sort((a, b) => b.hp - a.hp)[0]
    u.act = { k: 'dash', t: 0, dur: 1.1, tx: t.x - 90, ty: t.y }
    for (let i = 0; i < 3; i++) setTimeoutSim(s, 0.3 + i * 0.18, () => { if (alive(t)) { damage(s, u, t, u.atk * 1.4, i === 2); fx(s, { k: 'slashBig', x: t.x, y: t.y - 60, dur: 0.45, v: i }) } })
  } else if (id === 'ian') {
    for (const a of s.ents) if (a.side === 'ally' && alive(a)) { a.shield = Math.max(a.shield, 420); a.shieldT = 6; fx(s, { k: 'shieldOn', x: a.x, y: a.y - 70, dur: 0.8 }) }
    u.taunt = 6
    fx(s, { k: 'wall', x: u.x + 90, y: u.y - 80, dur: 1.2 })
  } else if (id === 'kanna') {
    foes.slice(0, 5).forEach((t, i) => setTimeoutSim(s, 0.15 + i * 0.12, () => { fx(s, { k: 'cubeDrop', x: t.x, y: t.y - 60, dur: 0.7 }); setTimeoutSim(s, 0.42, () => damage(s, u, t, u.atk * 1.5)) }))
    for (const a of s.ents) if (a.side === 'ally' && alive(a)) healUnit(s, u, a, 260)
  }
  return true
}
// 시뮬레이션 시간 기준 예약(일시정지·배속을 따른다)
type Timer = { at: number; f: () => void }
const timers = new WeakMap<Sim, Timer[]>()
function setTimeoutSim(s: Sim, dt: number, f: () => void) { const l = timers.get(s) ?? []; l.push({ at: s.t + dt, f }); timers.set(s, l) }

export function step(s: Sim, dt: number, auto: boolean) {
  if (s.result) { s.fx = s.fx.filter((f) => (f.t += dt) < f.dur); return }
  s.t += dt
  s.shake = Math.max(0, s.shake - dt)
  if (s.cutin && (s.cutin.t += dt) > 1.1) s.cutin = null
  const tl = timers.get(s); if (tl) { const due = tl.filter((x) => x.at <= s.t); timers.set(s, tl.filter((x) => x.at > s.t)); due.forEach((x) => x.f()) }
  for (const sk of Object.values(s.skills)) sk.left = Math.max(0, sk.left - dt)
  if (auto) for (const id of Object.keys(s.skills)) if (s.skills[id].left === 0 && (id !== 'kanna' || s.ents.some((a) => a.side === 'ally' && alive(a) && a.hp < a.max * 0.8)) && (id !== 'ian' || s.ents.some((a) => a.side === 'ally' && alive(a) && a.hp < a.max * 0.9))) castSkill(s, id)

  for (const e of s.ents) {
    if (e.dead) { e.dead += dt; continue }
    if (e.act && (e.act.t += dt) >= e.act.dur) e.act = null
    if (e.shieldT > 0 && (e.shieldT -= dt) <= 0) e.shield = 0
    if (e.taunt > 0) e.taunt -= dt
    // 진입: 제자리로 걸어 들어온다
    if (e.entering || e.side === 'ally') {
      const dx = e.hx - e.x
      if (Math.abs(dx) > 1 && !(e.act && e.act.k === 'dash')) { e.x += Math.sign(dx) * Math.min(Math.abs(dx), (e.side === 'ally' ? 420 : 300) * dt); continue }
      e.entering = false
    }
    if (e.act && e.act.k === 'dash') {
      const k = e.act.t / e.act.dur; const p = k < 0.25 ? k / 0.25 : k > 0.75 ? (1 - k) / 0.25 : 1
      e.x = e.hx + ((e.act.tx ?? e.hx) - e.hx) * p; e.y = e.hy + ((e.act.ty ?? e.hy) - e.hy) * p
      continue
    } else if (e.side === 'ally') { e.x = e.hx; e.y = e.hy }
    e.cd -= dt
    if (e.side === 'ally') {
      const t = nearest(s, e, 'enemy')
      if (t && e.cd <= 0) {
        e.cd = e.interval * (0.9 + R() * 0.2)
        e.act = { k: 'atk', t: 0, dur: e.kind === 'rion' ? 2.25 : 0.45 }
        const h = handPos(e); const crit = R() < 0.15
        if (e.kind === 'rion') setTimeoutSim(s, 0.55, () => { if (alive(e)) s.proj.push({ id: s.seq++, k: 'ring', x: h.x, y: h.y, tx: t.id, spd: 760, dmg: e.atk, from: e.id, crit }) })
        else if (e.kind === 'kanna') s.proj.push({ id: s.seq++, k: 'cube', x: h.x, y: h.y, tx: t.id, spd: 620, dmg: e.atk, from: e.id, crit })
        else if (e.kind === 'seren') s.proj.push({ id: s.seq++, k: 'slash', x: h.x, y: h.y, tx: t.id, spd: 1100, dmg: e.atk, from: e.id, crit })
        else { setTimeoutSim(s, 0.12, () => { if (alive(t)) { damage(s, e, t, e.atk, crit); fx(s, { k: 'bash', x: t.x, y: t.y - 60, dur: 0.35 }) } }) ; e.taunt = Math.max(e.taunt, 1.2) }
      }
    } else {
      const t = foeTarget(s, e)
      if (!t) continue
      const d = dist(e, t)
      if (d > e.range) {
        const ang = Math.atan2(t.y - e.y, t.x - e.x)
        e.x += Math.cos(ang) * e.speed * dt; e.y += Math.sin(ang) * e.speed * dt * 0.7
        // 서로 겹치지 않게
        for (const o of s.ents) if (o !== e && o.side === 'enemy' && alive(o)) { const dd = dist(e, o); if (dd < 70) { e.x += (e.x - o.x) / (dd + 1) * 40 * dt; e.y += (e.y - o.y) / (dd + 1) * 25 * dt } }
      } else if (e.cd <= 0) {
        e.cd = e.interval * (0.9 + R() * 0.2)
        e.act = { k: 'atk', t: 0, dur: 0.5, tx: t.x, ty: t.y }
        if (e.kind === 'orb') { const h = handPos(e); s.proj.push({ id: s.seq++, k: 'bolt', x: h.x, y: h.y, tx: t.id, spd: 520, dmg: e.atk, from: e.id }) }
        else setTimeoutSim(s, 0.22, () => { if (alive(e) && alive(t)) { damage(s, e, t, e.atk); if (e.kind === 'golem') s.shake = Math.max(s.shake, 0.18) } })
      }
    }
  }
  // 투사체
  for (const p of s.proj) {
    if (p.k === 'skillRing') {
      p.x += p.spd * dt; p.y -= p.spd * dt * 0.18
      for (const e of s.ents) if (e.side === 'enemy' && alive(e) && !p.seen!.has(e.id) && Math.abs(e.x - p.x) < 50) { p.seen!.add(e.id); damage(s, s.ents.find((u) => u.id === p.from), e, p.dmg, p.crit) }
      if (p.x > 1400) p.spd = 0
      continue
    }
    const t = s.ents.find((e) => e.id === p.tx)
    if (!t || !alive(t)) { p.spd = 0; continue }
    const tx = t.x, ty = t.y - (t.kind === 'orb' ? 70 : 60)
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy)
    if (d < p.spd * dt + 8) { p.spd = 0; damage(s, s.ents.find((u) => u.id === p.from), t, p.dmg, p.crit); if (p.k === 'cube') fx(s, { k: 'cubePop', x: tx, y: ty, dur: 0.5 }); if (p.k === 'slash') fx(s, { k: 'slashHit', x: tx, y: ty, dur: 0.35 }) }
    else { p.x += dx / d * p.spd * dt; p.y += dy / d * p.spd * dt }
  }
  s.proj = s.proj.filter((p) => p.spd > 0)
  s.fx = s.fx.filter((f) => (f.t += dt) < f.dur)
  s.ents = s.ents.filter((e) => e.side === 'ally' || e.dead < 1.2)
  // 승패·웨이브
  const foes = s.ents.filter((e) => e.side === 'enemy')
  if (!foes.some(alive) && !(timers.get(s) ?? []).length) {
    if (s.wave < s.waves && foes.length === 0) { spawn(s, s.wave); s.wave++; fx(s, { k: 'wave', x: 640, y: 300, dur: 1.6, text: `WAVE ${s.wave}/${s.waves}` }) }
    else if (s.wave >= s.waves && foes.length === 0) s.result = 'win'
  }
  if (!s.ents.some((e) => e.side === 'ally' && alive(e))) s.result = 'lose'
  if (s.t >= s.limit && !s.result) s.result = 'lose'
}

/** 테스트용: 남은 적 모두 쓰러뜨리기 */
export function killAll(s: Sim) { for (const e of s.ents) if (e.side === 'enemy' && alive(e)) damage(s, undefined, e, e.hp * 10 + 99999) }
