import type {
  GameState, TeamPreset, RecruitmentTransaction, Reward, Settings, EquipmentSlots, CurrencyId,
  RecruitResultEntry, MissionMetric, OwnedCharacter,
} from './types'
import type { GameService, Result, ServiceError, BattleSession } from './service'
import { GAME_CONFIG } from './config'
import { CHARACTERS, CHAR_BY_ID } from './data/characters'
import {
  BANNER_BY_ID, PRODUCT_BY_ID, ITEM_BY_ID, MISSIONS, ATTENDANCE_REWARDS,
  STORY_CHAPTERS, DISTRICTS, WANTED, TRAININGS, RAIDS, ARENA_OPPONENTS,
} from './data/catalog'
import { expToNext, creditCostForLevel } from './rules'

const SAVE_KEY = 'ability-kingdom.save.v1'
const SCHEMA = 1
const LATENCY = 160

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = <T,>(error: ServiceError): Result<T> => ({ ok: false, error })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function emptyTeam(id: string, name: string, slots: (string | null)[], leaderId: string | null): TeamPreset {
  return { id, name, slots, leaderId, version: 1, savedAt: Date.now() }
}

export function createInitialState(): GameState {
  const now = Date.now()
  const ownedIds = ['jian', 'yujin', 'harin', 'doyun', 'sein', 'narin']
  const levels: Record<string, number> = { jian: 40, yujin: 40, harin: 40, doyun: 40, sein: 37, narin: 32 }
  const owned: Record<string, OwnedCharacter> = Object.fromEntries(ownedIds.map((id) => [id, {
    id, level: levels[id], obtainedAt: now, dupes: 0,
    equipment: { weapon: null, gear: null, accessory: null } as EquipmentSlots,
  }]))
  owned.jian.equipment.weapon = 'eq_blade'
  owned.yujin.equipment.gear = 'eq_jacket'
  return {
    schema: SCHEMA,
    playerName: '마유',
    playerLevel: 32,
    createdAt: now,
    wallet: { diamond: 3200, credit: 58000, ticket: 12, scoutPoint: 120, exchangeMedal: 40, stamina: 120 },
    owned,
    teams: [
      emptyTeam('team1', '팀 01', ['jian', 'yujin', 'harin', 'doyun'], 'jian'),
      emptyTeam('team2', '팀 02', ['sein', 'narin', 'yujin', null], 'sein'),
      emptyTeam('team3', '팀 03', [null, null, null, null], null),
    ],
    activeTeamId: 'team1',
    lobby: { characterId: 'jian', background: 'lobby', entrancePolicy: 'first-and-change', lastEntranceFor: null },
    inventory: [
      { itemId: 'exp_s', qty: 24 }, { itemId: 'exp_m', qty: 10 }, { itemId: 'exp_l', qty: 3 }, { itemId: 'part', qty: 18 },
      { itemId: 'eq_baton', qty: 1 }, { itemId: 'eq_vest', qty: 1 }, { itemId: 'eq_phones', qty: 1 }, { itemId: 'eq_card', qty: 2 },
      { itemId: 'box_dia', qty: 2 }, { itemId: 'drink', qty: 3 },
    ],
    recruitTx: [],
    purchases: [],
    content: { storyCleared: [], wins: 0, battles: [], arenaPoints: 1200, arenaRecord: { win: 0, lose: 0 }, arenaDefenseTeam: 'team1', wantedCleared: [], raidBest: {} },
    mails: [
      { id: 'mail1', title: '프로토타입 접속 보상', body: '어빌리티킹덤 프로토타입에 오신 것을 환영합니다.', from: '운영팀', rewards: [{ kind: 'currency', id: 'diamond', qty: 500 }, { kind: 'currency', id: 'ticket', qty: 3 }], claimed: false, receivedAt: now, expiresAt: '2026-11-11' },
      { id: 'mail2', title: '편성 화면 리뉴얼 기념', body: '지하철 플랫폼 편성 화면이 적용되었습니다.', from: '운영팀', rewards: [{ kind: 'item', id: 'exp_m', qty: 5 }], claimed: false, receivedAt: now - 3600_000, expiresAt: '2026-11-01' },
      { id: 'mail3', title: '점검 보상(샘플)', body: '샘플 우편입니다.', from: '운영팀', rewards: [{ kind: 'currency', id: 'credit', qty: 10000 }], claimed: false, receivedAt: now - 86400_000, expiresAt: '2026-10-25' },
    ],
    missions: { progress: { login: 1 }, claimed: [], day: today() },
    attendance: { claimedDays: 2, lastClaimDay: null },
    seenNotices: [],
    seenEvents: [],
    settings: { bgm: 0.6, sfx: 0.8, voice: 0.8, quality: 'high', reduceMotion: false, openingSeen: false },
    processed: {},
  }
}

const ALL_STAGES = (() => {
  const m: Record<string, { staminaCost: number; rewards: Reward[] }> = {}
  for (const ch of STORY_CHAPTERS) for (const s of ch.stages) m[s.id] = s
  for (const d of DISTRICTS) for (const s of d.incidents) m[s.id] = s
  for (const w of WANTED) m[w.id] = w as never
  for (const t of TRAININGS) for (const s of t.levels) m[s.id] = s
  for (const r of RAIDS) for (const s of r.levels) m[s.id] = s
  for (const o of ARENA_OPPONENTS) m[o.id] = { staminaCost: 5, rewards: [{ kind: 'currency', id: 'exchangeMedal', qty: 5 }] }
  return m
})()

export class LocalGameService implements GameService {
  private state: GameState
  private listeners = new Set<() => void>()
  private failureRate = 0
  private storageOk = true

  constructor() {
    this.state = this.load()
    this.rollDay()
  }

  // ───────── 저장 ─────────
  private load(): GameState {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw) {
        const s = JSON.parse(raw) as GameState
        if (s.schema === SCHEMA) return s
      }
    } catch {
      this.storageOk = false
    }
    return createInitialState()
  }
  private persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state))
    } catch {
      this.storageOk = false
    }
  }
  private commit(mut: (s: GameState) => void) {
    const next = clone(this.state)
    mut(next)
    this.state = next
    this.persist()
    this.listeners.forEach((l) => l())
  }
  private rollDay() {
    if (this.state.missions.day !== today()) {
      this.commit((s) => { s.missions = { progress: { login: 1 }, claimed: [], day: today() } })
    }
  }
  isStorageAvailable() { return this.storageOk }

  getState() { return this.state }
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }

  setFailureRate(rate: number) { this.failureRate = rate }
  getFailureRate() { return this.failureRate }

  /**
   * 서버 왕복을 흉내낸다. 실패 시뮬레이션 시 절반은 '처리 전 실패', 절반은 '처리 후 응답 유실'.
   * 응답 유실 후 같은 requestId로 재시도하면 저장된 결과를 그대로 돌려준다(중복 차감/지급 없음).
   */
  private async rpc<T>(requestId: string | null, run: () => Result<T>): Promise<Result<T>> {
    await sleep(LATENCY)
    if (requestId && requestId in this.state.processed) return this.state.processed[requestId] as Result<T>
    const roll = Math.random()
    if (roll < this.failureRate / 2) return fail({ code: 'NETWORK' })
    const res = run()
    if (requestId && res.ok) this.commit((s) => { s.processed[requestId] = res })
    if (roll < this.failureRate) return fail({ code: 'NETWORK' })
    return res
  }

  // ───────── 내부 도우미 ─────────
  private grant(s: GameState, rewards: Reward[]) {
    for (const r of rewards) {
      if (r.kind === 'currency') {
        const id = r.id as CurrencyId
        s.wallet[id] = (s.wallet[id] ?? 0) + r.qty
        if (id === 'stamina') s.wallet.stamina = Math.min(s.wallet.stamina, GAME_CONFIG.staminaMax * 3)
      } else if (r.id.startsWith('char:')) {
        const cid = r.id.slice(5)
        if (s.owned[cid]) s.owned[cid].dupes += 1
        else s.owned[cid] = { id: cid, level: 1, obtainedAt: Date.now(), dupes: 0, equipment: { weapon: null, gear: null, accessory: null } }
      } else {
        const e = s.inventory.find((i) => i.itemId === r.id)
        if (e) e.qty += r.qty
        else s.inventory.push({ itemId: r.id, qty: r.qty })
      }
    }
  }
  private itemQty(s: GameState, id: string) { return s.inventory.find((i) => i.itemId === id)?.qty ?? 0 }
  private takeItem(s: GameState, id: string, qty: number) {
    const e = s.inventory.find((i) => i.itemId === id)
    if (!e || e.qty < qty) throw new Error('item')
    e.qty -= qty
    if (e.qty === 0) s.inventory = s.inventory.filter((i) => i !== e)
  }
  private bump(s: GameState, metric: MissionMetric, n = 1) {
    s.missions.progress[metric] = (s.missions.progress[metric] ?? 0) + n
  }
  private equippedCount(s: GameState, itemId: string) {
    let n = 0
    for (const o of Object.values(s.owned)) for (const v of Object.values(o.equipment)) if (v === itemId) n++
    return n
  }

  // ───────── 편성 ─────────
  validateTeam(team: TeamPreset): string | null {
    if (team.slots.length !== GAME_CONFIG.teamSize) return '슬롯 수가 맞지 않습니다.'
    const ids = team.slots.filter(Boolean) as string[]
    if (!GAME_CONFIG.allowDuplicateInTeam && new Set(ids).size !== ids.length) return '같은 캐릭터를 두 번 배치할 수 없습니다.'
    for (const id of ids) if (!this.state.owned[id]) return '보유하지 않은 캐릭터가 포함되어 있습니다.'
    if (team.leaderId && !ids.includes(team.leaderId)) return '리더가 팀에 없습니다.'
    if (team.name.trim().length === 0 || team.name.length > 12) return '팀 이름은 1~12자로 입력해 주세요.'
    return null
  }

  async saveTeam(team: TeamPreset, expectedVersion: number) {
    return this.rpc<TeamPreset>(null, () => {
      const cur = this.state.teams.find((t) => t.id === team.id)
      if (!cur) return fail({ code: 'INVALID', message: '팀을 찾을 수 없습니다.' })
      if (cur.version !== expectedVersion) return fail({ code: 'VERSION_CONFLICT' })
      const err = this.validateTeam(team)
      if (err) return fail({ code: 'INVALID', message: err })
      const ids = team.slots.filter(Boolean) as string[]
      const saved: TeamPreset = { ...clone(team), leaderId: team.leaderId && ids.includes(team.leaderId) ? team.leaderId : ids[0] ?? null, version: cur.version + 1, savedAt: Date.now() }
      this.commit((s) => {
        s.teams = s.teams.map((t) => (t.id === saved.id ? saved : t))
        this.bump(s, 'saveTeam')
      })
      return ok(saved)
    })
  }
  async setActiveTeam(teamId: string) {
    this.commit((s) => { s.activeTeamId = teamId })
    return ok(true as const)
  }
  async setLobbyCharacter(characterId: string) {
    if (!this.state.owned[characterId]) return fail<true>({ code: 'INVALID', message: '보유하지 않은 캐릭터입니다.' })
    this.commit((s) => { s.lobby.characterId = characterId })
    return ok(true as const)
  }
  markLobbyEntrance(characterId: string) {
    this.commit((s) => { s.lobby.lastEntranceFor = characterId })
  }

  // ───────── 영입 ─────────
  async recruit(bannerId: string, count: number, requestId: string) {
    return this.rpc<RecruitmentTransaction>(requestId, () => {
      const b = BANNER_BY_ID[bannerId]
      if (!b) return fail({ code: 'INVALID', message: '배너 없음' })
      if (b.end && today() > b.end) return fail({ code: 'EXPIRED' })
      const cost = { currency: b.costPerPull.currency, amount: b.costPerPull.amount * count }
      const have = this.state.wallet[cost.currency]
      if (have < cost.amount) return fail({ code: 'INSUFFICIENT', currency: cost.currency, need: cost.amount, have })

      const results: RecruitResultEntry[] = []
      const ownedNow = new Set(Object.keys(this.state.owned))
      for (let i = 0; i < count; i++) {
        // 프로토타입 샘플 확률. 운영 가챠로 사용 금지(서버에서 결정해야 함).
        let r = Math.random(), rarity = 3, acc = 0
        for (const x of b.rates) { acc += x.rate; if (r < acc) { rarity = x.rarity; break } }
        const pool = b.pool.filter((id) => CHAR_BY_ID[id].rarity === rarity)
        let pick = pool[Math.floor(Math.random() * pool.length)]
        let isPickup = false
        if (rarity === CHAR_BY_ID[b.featuredId].rarity && b.pickupShare > 0 && Math.random() < b.pickupShare) { pick = b.featuredId; isPickup = true }
        if (pick === b.featuredId && b.pickupShare > 0) isPickup = true
        results.push({ characterId: pick, rarity, isNew: !ownedNow.has(pick), isPickup })
        ownedNow.add(pick)
      }
      const pointsGained = b.kind === 'limited' ? 10 * count : 0
      const tx: RecruitmentTransaction = { requestId, bannerId, count, cost, results, pointsGained, status: 'granted', createdAt: Date.now() }
      this.commit((s) => {
        s.wallet[cost.currency] -= cost.amount
        s.wallet.scoutPoint += pointsGained
        for (const res of results) this.grant(s, [{ kind: 'item', id: `char:${res.characterId}`, qty: 1 }])
        s.recruitTx.unshift(tx)
        s.recruitTx = s.recruitTx.slice(0, 50)
        this.bump(s, 'recruit', count)
      })
      return ok(tx)
    })
  }

  // ───────── 상점 ─────────
  purchasedCount(productId: string) { return this.state.purchases.filter((p) => p.productId === productId).length }
  async purchase(productId: string, requestId: string) {
    return this.rpc<{ rewards: Reward[] }>(requestId, () => {
      const p = PRODUCT_BY_ID[productId]
      if (!p) return fail({ code: 'INVALID', message: '상품 없음' })
      if (p.price.type === 'real') return fail({ code: 'NOT_SUPPORTED', message: '실결제는 아직 연동되지 않았습니다.' })
      if (p.endsAt && today() > p.endsAt) return fail({ code: 'EXPIRED' })
      if (p.limit !== null && this.purchasedCount(productId) >= p.limit) return fail({ code: 'LIMIT_REACHED' })
      const have = this.state.wallet[p.price.currency]
      if (have < p.price.amount) return fail({ code: 'INSUFFICIENT', currency: p.price.currency, need: p.price.amount, have })
      const rewards: Reward[] = p.contents.map((c) => ({ kind: c.kind, id: c.id, qty: c.qty }))
      const price = p.price
      this.commit((s) => {
        s.wallet[price.currency] -= price.amount
        this.grant(s, rewards)
        s.purchases.push({ requestId, productId, createdAt: Date.now() })
        this.bump(s, 'purchase')
      })
      return ok({ rewards })
    })
  }

  // ───────── 가방·장비·성장 ─────────
  async useItem(itemId: string, requestId: string) {
    return this.rpc<{ rewards: Reward[] }>(requestId, () => {
      const def = ITEM_BY_ID[itemId]
      if (!def?.use) return fail({ code: 'INVALID', message: '사용할 수 없는 아이템입니다.' })
      if (this.itemQty(this.state, itemId) < 1) return fail({ code: 'INSUFFICIENT', currency: itemId, need: 1, have: 0 })
      const rewards: Reward[] = Object.entries(def.use.grant).map(([id, qty]) => ({ kind: 'currency', id, qty: qty! }))
      this.commit((s) => { this.takeItem(s, itemId, 1); this.grant(s, rewards) })
      return ok({ rewards })
    })
  }
  setItemLock(itemId: string, locked: boolean) {
    this.commit((s) => { const e = s.inventory.find((i) => i.itemId === itemId); if (e) e.locked = locked })
  }
  freeQty(itemId: string) { return this.itemQty(this.state, itemId) - this.equippedCount(this.state, itemId) }
  async equip(characterId: string, slot: keyof EquipmentSlots, itemId: string | null) {
    return this.rpc<true>(null, () => {
      const o = this.state.owned[characterId]
      if (!o) return fail({ code: 'INVALID', message: '캐릭터 없음' })
      if (itemId) {
        const def = ITEM_BY_ID[itemId]
        if (!def || def.equipSlot !== slot) return fail({ code: 'INVALID', message: '해당 슬롯에 장착할 수 없습니다.' })
        if (o.equipment[slot] !== itemId && this.freeQty(itemId) < 1) return fail({ code: 'INSUFFICIENT', currency: itemId, need: 1, have: 0 })
      }
      this.commit((s) => { s.owned[characterId].equipment[slot] = itemId })
      return ok(true as const)
    })
  }
  planLevelUp(characterId: string, levels: number) {
    const o = this.state.owned[characterId]
    const target = Math.min(GAME_CONFIG.maxLevel, o.level + levels)
    let expNeed = 0, credit = 0
    for (let lv = o.level; lv < target; lv++) { expNeed += expToNext(lv); credit += creditCostForLevel(lv) }
    // 큰 칩부터 사용, 남는 경험치는 버림(임시 규칙)
    const use: Record<string, number> = { exp_l: 0, exp_m: 0, exp_s: 0 }
    let remain = expNeed
    for (const id of ['exp_l', 'exp_m', 'exp_s']) {
      const val = ITEM_BY_ID[id].expValue!
      const have = this.itemQty(this.state, id)
      const n = Math.min(have, Math.floor(remain / val))
      use[id] = n
      remain -= n * val
    }
    for (const id of ['exp_s', 'exp_m', 'exp_l']) {
      if (remain <= 0) break
      const have = this.itemQty(this.state, id) - use[id]
      if (have > 0) { use[id] += 1; remain -= ITEM_BY_ID[id].expValue! }
    }
    const expShort = Math.max(0, remain)
    const creditShort = Math.max(0, credit - this.state.wallet.credit)
    return { from: o.level, to: target, expNeed, credit, use, expShort, creditShort, feasible: target > o.level && expShort === 0 && creditShort === 0 }
  }
  async levelUp(characterId: string, levels: number, requestId: string) {
    return this.rpc<{ from: number; to: number }>(requestId, () => {
      if (!this.state.owned[characterId]) return fail({ code: 'INVALID', message: '캐릭터 없음' })
      const plan = this.planLevelUp(characterId, levels)
      if (plan.to <= plan.from) return fail({ code: 'INVALID', message: '최대 레벨입니다.' })
      if (plan.creditShort > 0) return fail({ code: 'INSUFFICIENT', currency: 'credit', need: plan.credit, have: this.state.wallet.credit })
      if (plan.expShort > 0) return fail({ code: 'INSUFFICIENT', currency: 'exp', need: plan.expNeed, have: plan.expNeed - plan.expShort })
      this.commit((s) => {
        for (const [id, n] of Object.entries(plan.use)) if (n > 0) this.takeItem(s, id, n)
        s.wallet.credit -= plan.credit
        s.owned[characterId].level = plan.to
        this.bump(s, 'levelUp')
      })
      return ok({ from: plan.from, to: plan.to })
    })
  }

  // ───────── 콘텐츠·테스트 전투 ─────────
  async deploy(contentId: string, stageId: string, teamId: string, requestId: string) {
    return this.rpc<BattleSession>(requestId, () => {
      const st = ALL_STAGES[stageId]
      if (!st) return fail({ code: 'INVALID', message: '스테이지 없음' })
      const team = this.state.teams.find((t) => t.id === teamId)
      const n = team?.slots.filter(Boolean).length ?? 0
      if (n < GAME_CONFIG.minMembersToDeploy) return fail({ code: 'INVALID', message: `최소 ${GAME_CONFIG.minMembersToDeploy}명이 필요합니다.` })
      if (this.state.wallet.stamina < st.staminaCost) return fail({ code: 'INSUFFICIENT', currency: 'stamina', need: st.staminaCost, have: this.state.wallet.stamina })
      const session: BattleSession = { battleId: requestId, contentId, stageId, teamId, status: 'pending' }
      this.commit((s) => { s.wallet.stamina -= st.staminaCost; s.processed[`battle:${requestId}`] = session })
      return ok(session)
    })
  }
  async finishBattle(battleId: string, won: boolean) {
    return this.rpc<BattleSession>(null, () => {
      const key = `battle:${battleId}`
      const cur = this.state.processed[key] as BattleSession | undefined
      if (!cur) return fail({ code: 'INVALID', message: '전투 기록 없음' })
      if (cur.status === 'done') return ok(cur) // 보상 중복 지급 방지
      const st = ALL_STAGES[cur.stageId]
      const rewards = won ? st.rewards : []
      const done: BattleSession = { ...cur, status: 'done', won, rewards }
      this.commit((s) => {
        s.processed[key] = done
        this.grant(s, rewards)
        s.content.battles.unshift({ requestId: battleId, contentId: cur.contentId, stageId: cur.stageId, won, rewards, createdAt: Date.now() })
        s.content.battles = s.content.battles.slice(0, 30)
        if (won) {
          s.content.wins += 1
          this.bump(s, 'battleWin')
          if (cur.contentId === 'story' && !s.content.storyCleared.includes(cur.stageId)) s.content.storyCleared.push(cur.stageId)
          if (cur.contentId === 'wanted' && !s.content.wantedCleared.includes(cur.stageId)) s.content.wantedCleared.push(cur.stageId)
        }
        if (cur.contentId === 'arena') {
          if (won) { s.content.arenaRecord.win++; s.content.arenaPoints += 25 } else { s.content.arenaRecord.lose++; s.content.arenaPoints = Math.max(0, s.content.arenaPoints - 15) }
        }
        if (cur.contentId === 'raid' && won) s.content.raidBest[cur.stageId] = (s.content.raidBest[cur.stageId] ?? 0) + 1
      })
      return ok(done)
    })
  }

  // ───────── 운영 ─────────
  async claimMail(mailIds: string[], requestId: string) {
    return this.rpc<{ rewards: Reward[] }>(requestId, () => {
      const targets = this.state.mails.filter((m) => mailIds.includes(m.id) && !m.claimed)
      if (targets.length === 0) return fail({ code: 'INVALID', message: '받을 수 있는 우편이 없습니다.' })
      const rewards = targets.flatMap((m) => m.rewards)
      this.commit((s) => {
        for (const m of s.mails) if (targets.some((t) => t.id === m.id)) m.claimed = true
        this.grant(s, rewards)
      })
      return ok({ rewards })
    })
  }
  missionStatus(id: string) {
    const m = MISSIONS.find((x) => x.id === id)!
    const p = this.state.missions.progress[m.metric] ?? 0
    const claimed = this.state.missions.claimed.includes(id)
    return { def: m, progress: Math.min(p, m.target), done: p >= m.target, claimed }
  }
  async claimMission(missionId: string, requestId: string) {
    return this.rpc<{ rewards: Reward[] }>(requestId, () => {
      const st = this.missionStatus(missionId)
      if (st.claimed) return fail({ code: 'INVALID', message: '이미 받은 보상입니다.' })
      if (!st.done) return fail({ code: 'INVALID', message: '아직 완료하지 않았습니다.' })
      this.commit((s) => { s.missions.claimed.push(missionId); this.grant(s, st.def.rewards) })
      return ok({ rewards: st.def.rewards })
    })
  }
  canClaimAttendance() { return this.state.attendance.lastClaimDay !== today() && this.state.attendance.claimedDays < ATTENDANCE_REWARDS.length }
  async claimAttendance(requestId: string) {
    return this.rpc<{ rewards: Reward[]; day: number }>(requestId, () => {
      if (!this.canClaimAttendance()) return fail({ code: 'INVALID', message: '오늘은 이미 출석했습니다.' })
      const day = this.state.attendance.claimedDays
      const rewards = [ATTENDANCE_REWARDS[day]]
      this.commit((s) => { s.attendance.claimedDays += 1; s.attendance.lastClaimDay = today(); this.grant(s, rewards) })
      return ok({ rewards, day: day + 1 })
    })
  }
  markSeen(kind: 'notice' | 'event', id: string) {
    const list = kind === 'notice' ? this.state.seenNotices : this.state.seenEvents
    if (list.includes(id)) return
    this.commit((s) => { (kind === 'notice' ? s.seenNotices : s.seenEvents).push(id) })
  }

  setArenaDefense(teamId: string) { this.commit((s) => { s.content.arenaDefenseTeam = teamId }) }
  updateSettings(patch: Partial<Settings>) { this.commit((s) => { s.settings = { ...s.settings, ...patch } }) }
  resetAll() {
    const keepSettings = { ...this.state.settings }
    this.state = createInitialState()
    this.state.settings = { ...keepSettings }
    this.persist()
    this.listeners.forEach((l) => l())
  }
}

export const ALL_CHARACTER_COUNT = CHARACTERS.length
