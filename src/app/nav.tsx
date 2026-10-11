import { createContext, useContext } from 'react'

export type ScreenName =
  | 'boot' | 'opening' | 'lobby' | 'formation' | 'characters' | 'characterDetail'
  | 'recruit' | 'recruitResult' | 'recruitHistory' | 'shop' | 'bag'
  | 'story' | 'explore' | 'wanted' | 'training' | 'arena' | 'raid'
  | 'prep' | 'battle' | 'mail' | 'missions' | 'notices' | 'events' | 'attendance' | 'profile' | 'settings'

export interface Route { key: number; name: ScreenName; params: Record<string, unknown> }

/** 화면을 떠나기 전 확인(편성 저장 전 이탈 등). true면 이동 허용 */
export type LeaveGuard = (proceed: () => void) => boolean

export interface Nav {
  stack: Route[]
  push(name: ScreenName, params?: Record<string, unknown>): void
  replace(name: ScreenName, params?: Record<string, unknown>): void
  back(): void
  home(): void
  reset(name: ScreenName, params?: Record<string, unknown>): void
  setGuard(g: LeaveGuard | null, screenKey?: number): void
  toast(msg: string, tone?: 'info' | 'ok' | 'warn'): void
}

export const NavContext = createContext<Nav>(null as unknown as Nav)
export const useNav = () => useContext(NavContext)
export const ScreenKey = createContext<number>(0)
export const useScreenKey = () => useContext(ScreenKey)

/** 화면별 전환 연출. 같은 카드 전환을 반복하지 않는다 */
export const TRANSITION: Partial<Record<ScreenName, string>> = {
  lobby: 't-fade',
  formation: 't-train',
  characters: 't-slide',
  characterDetail: 't-zoom',
  recruit: 't-glitch',
  recruitResult: 't-flash',
  shop: 't-shutter',
  bag: 't-slide',
  story: 't-wipe',
  explore: 't-zoom',
  wanted: 't-wipe',
  training: 't-slide',
  arena: 't-glitch',
  raid: 't-shake',
  prep: 't-wipe',
  battle: 't-flash',
}
