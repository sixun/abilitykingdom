import { useSyncExternalStore } from 'react'
import { LocalGameService } from './localService'
import { CHAR_BY_ID } from './data/characters'
import { ITEM_BY_ID, MISSIONS, NOTICES, EVENTS } from './data/catalog'
import { statsOf, powerOf } from './rules'
import type { GameState, TeamPreset } from './types'

export const game = new LocalGameService()
// 개발·검증용 핸들(자동 테스트에서 상태 확인에 사용)
;(window as unknown as { __AK__: unknown }).__AK__ = game

export function useGame(): GameState {
  return useSyncExternalStore((fn) => game.subscribe(fn), () => game.getState())
}

export function charPower(s: GameState, id: string) {
  const o = s.owned[id]
  if (!o) return 0
  return powerOf(statsOf(CHAR_BY_ID[id], o, ITEM_BY_ID))
}

export function teamPower(s: GameState, team: Pick<TeamPreset, 'slots'>) {
  return team.slots.reduce((sum, id) => sum + (id ? charPower(s, id) : 0), 0)
}

/** 알림 점: 실제 미확인/수령 가능 상태와 일치해야 한다 */
export function badges(s: GameState) {
  const mail = s.mails.some((m) => !m.claimed)
  const mission = MISSIONS.some((m) => (s.missions.progress[m.metric] ?? 0) >= m.target && !s.missions.claimed.includes(m.id))
  const attendance = game.canClaimAttendance()
  const notice = NOTICES.some((n) => !s.seenNotices.includes(n.id))
  const event = EVENTS.some((e) => !s.seenEvents.includes(e.id)) || attendance
  return { mail, mission, attendance, notice, event }
}
