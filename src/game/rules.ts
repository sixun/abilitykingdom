// 임시 규칙 모음. 전투력·레벨업 비용·자동 편성 기준은 확정 전까지 여기서만 정의하고
// UI 코드에 수식을 직접 쓰지 않는다. (기획서 8·7항)

import type { CharacterDefinition, OwnedCharacter, ItemDefinition } from './types'

export const RULES_ARE_PROVISIONAL = true

export function statsOf(def: CharacterDefinition, owned: OwnedCharacter, items: Record<string, ItemDefinition>, levelOverride?: number) {
  const lv = levelOverride ?? owned.level
  const g = 1 + (lv - 1) * 0.045
  let hp = Math.round(def.baseStats.hp * g)
  let atk = Math.round(def.baseStats.atk * g)
  let defn = Math.round(def.baseStats.def * g)
  for (const id of Object.values(owned.equipment)) {
    if (!id) continue
    const b = items[id]?.bonus
    if (!b) continue
    hp += b.hp ?? 0
    atk += b.atk ?? 0
    defn += b.def ?? 0
  }
  return { hp, atk, def: defn }
}

/** 표시 배율: 원본 편성 화면의 기본 팀(지안·유진·하린·도윤 Lv.40)이 24,680이 되도록 맞춘 임시 값 */
const POWER_SCALE = 3.12456
export function powerOf(stats: { hp: number; atk: number; def: number }) {
  return Math.round((stats.hp * 0.1 + stats.atk * 1.6 + stats.def * 1.1) * POWER_SCALE)
}

/** 다음 레벨까지 필요한 경험치(임시) */
export function expToNext(level: number) {
  return 120 + level * 40
}

/** 레벨업 1회 크레딧 비용(임시) */
export function creditCostForLevel(level: number) {
  return 300 + level * 60
}

/** 자동 편성 임시 알고리즘: 전투력 높은 순. 역할·속성 시너지 미반영 */
export const AUTO_FORMATION_RULE_LABEL = '임시 규칙: 전투력 높은 순 (역할·속성 시너지 미반영)'
