// 서비스 인터페이스. 현재는 LocalGameService(브라우저 저장)가 구현한다.
// 운영 전 재화·영입·구매·보상은 같은 인터페이스의 서버 구현으로 교체해야 한다(기획서 14항).

import type {
  GameState, TeamPreset, RecruitmentTransaction, Reward, Settings, EquipmentSlots, LobbyTheme, CommanderProfile,
} from './types'

export type ServiceError =
  | { code: 'INSUFFICIENT'; currency: string; need: number; have: number }
  | { code: 'LIMIT_REACHED' }
  | { code: 'EXPIRED' }
  | { code: 'INVALID'; message: string }
  | { code: 'VERSION_CONFLICT' }
  | { code: 'NETWORK' }
  | { code: 'NOT_SUPPORTED'; message: string }

export type Result<T> = { ok: true; value: T } | { ok: false; error: ServiceError }

export interface BattleSession { battleId: string; contentId: string; stageId: string; teamId: string; status: 'pending' | 'done'; won?: boolean; rewards?: Reward[] }

export interface GameService {
  getState(): GameState
  subscribe(fn: () => void): () => void

  saveTeam(team: TeamPreset, expectedVersion: number): Promise<Result<TeamPreset>>
  setActiveTeam(teamId: string): Promise<Result<true>>
  setLobbyCharacter(characterId: string): Promise<Result<true>>
  setLobbyTheme(theme: LobbyTheme): void
  markLobbyEntrance(characterId: string): void

  recruit(bannerId: string, count: number, requestId: string): Promise<Result<RecruitmentTransaction>>
  purchase(productId: string, requestId: string): Promise<Result<{ rewards: Reward[] }>>
  useItem(itemId: string, requestId: string): Promise<Result<{ rewards: Reward[] }>>
  setItemLock(itemId: string, locked: boolean): void
  equip(characterId: string, slot: keyof EquipmentSlots, itemId: string | null): Promise<Result<true>>
  levelUp(characterId: string, levels: number, requestId: string): Promise<Result<{ from: number; to: number }>>

  deploy(contentId: string, stageId: string, teamId: string, requestId: string): Promise<Result<BattleSession>>
  finishBattle(battleId: string, won: boolean): Promise<Result<BattleSession>>

  claimMail(mailIds: string[], requestId: string): Promise<Result<{ rewards: Reward[] }>>
  claimMission(missionId: string, requestId: string): Promise<Result<{ rewards: Reward[] }>>
  claimAttendance(requestId: string): Promise<Result<{ rewards: Reward[]; day: number }>>
  markSeen(kind: 'notice' | 'event', id: string): void

  /** 팀장 프로필 저장(기기 저장). 보유하지 않은 캐릭터 아이콘·대표 팀원은 거절 */
  updateCommander(patch: Partial<CommanderProfile>): Promise<Result<true>>
  setArenaDefense(teamId: string): void
  updateSettings(patch: Partial<Settings>): void
  resetAll(): void

  /** 개발용: 요청 실패 시뮬레이션 비율(0~1) */
  setFailureRate(rate: number): void
  getFailureRate(): number
}

export const newRequestId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
