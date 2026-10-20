// 팀장 프로필 데이터 규칙(기기 저장만, 서버 계정 미연동).
// - 팀장 기본 아바타(남성형/여성형)와 프로필 아이콘은 서로 독립: 아이콘은 기본 아바타 2종 + 보유한 대원의 초상화
// - 대표 팀원 5칸은 전투 편성과 별개
// - 칭호·전시 배경은 아직 획득 경로가 정해지지 않아 '기본 제공' 항목만 둔다(임의 해금 조건을 만들지 않음)
import type { CommanderProfile, GameState } from '../types'
import { CHAR_BY_ID, CHARACTERS } from './characters'

export const SHOWCASE_SIZE = 5
export const BIO_MAX = 40
/** 소속(세계관 고정값: docs/Ability-Kingdom-Worldbuilding.md — 플레이어는 도시 대응본부 A7 현장팀의 팀장) */
export const AFFILIATION = '도시 대응본부 A7'

/** 팀장 기본 아바타 그림: 한 장에 남(왼쪽)·여(오른쪽) 정사각형 두 칸 */
export const COMMANDER_SHEET = 'profile/commander.webp'

export type IconOption = { id: string; label: string; src: string; sheet?: 'm' | 'f'; locked: boolean; lockNote?: string; group: '팀장' | '대원' }

export const TITLES = [{ id: 'a7-leader', name: 'A7 현장팀장', note: '기본 칭호 · 다른 칭호는 획득 경로가 정해지면 추가' }]

/** 개인 프로필 전시 배경(대원증 아래 띠에 보인다). 공통 지휘실 배경과는 별개 */
export const PROFILE_BGS = [
  { id: 'none', name: '별빛 야경', note: '기본', src: '' },
  { id: 'platform', name: '승강장의 오후', note: '기본 제공', src: 'assets/bg/platform.webp' },
  { id: 'map', name: '도시 전경', note: '기본 제공', src: 'assets/bg/map.webp' },
  { id: 'story', name: '끊어진 신호', note: '기본 제공', src: 'assets/bg/story.webp' },
]

export function commanderOf(s: GameState): CommanderProfile {
  if (s.commander) return s.commander
  // 아직 고르지 않은 계정: 화면에서 기본 아바타를 먼저 고르게 하고, 그 전까지 쓰는 기본값
  const owned = CHARACTERS.filter((c) => s.owned[c.id]).sort((a, b) => b.rarity - a.rarity).map((c) => c.id)
  return { avatar: 'm', iconId: 'cmd-m', bio: '', titleId: 'a7-leader', backgroundId: 'none', showcase: Array.from({ length: SHOWCASE_SIZE }, (_, i) => owned[i] ?? null) }
}

export function iconUnlocked(s: GameState, id: string) {
  if (id === 'cmd-m' || id === 'cmd-f') return true
  if (id.startsWith('char:')) return !!s.owned[id.slice(5)] && !!CHAR_BY_ID[id.slice(5)]
  return false
}

export function iconOptions(s: GameState): IconOption[] {
  return [
    { id: 'cmd-m', label: '팀장 · 남성형', src: COMMANDER_SHEET, sheet: 'm', locked: false, group: '팀장' },
    { id: 'cmd-f', label: '팀장 · 여성형', src: COMMANDER_SHEET, sheet: 'f', locked: false, group: '팀장' },
    ...CHARACTERS.filter((c) => !c.pending).map((c) => ({
      id: `char:${c.id}`, label: c.name, src: c.assets.portrait, locked: !s.owned[c.id], lockNote: '이 대원을 영입하면 해금', group: '대원' as const,
    })),
  ]
}

/** 아이콘 그림 정보(기본 아바타는 한 장에서 반쪽을 잘라 쓴다) */
export function iconArt(id: string): { src: string; half?: 'm' | 'f' } {
  if (id === 'cmd-m' || id === 'cmd-f') return { src: COMMANDER_SHEET, half: id === 'cmd-m' ? 'm' : 'f' }
  const c = CHAR_BY_ID[id.slice(5)]
  return c ? { src: c.assets.portrait } : { src: COMMANDER_SHEET, half: 'm' }
}
