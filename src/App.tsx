import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavContext, ScreenKey, TRANSITION, type LeaveGuard, type Nav, type Route, type ScreenName } from './app/nav'
import { audio, DEFAULT_LOBBY_TRACK } from './app/audio'
import { useGame } from './game/store'
import { MOTION } from './game/config'

import Boot from './screens/Boot'
import Opening from './screens/Opening'
import Lobby from './screens/Lobby'
import Formation from './screens/Formation'
import Pass from './screens/Pass'
import PassSummer from './screens/PassSummer'
import BattleTest from './screens/BattleTest'
import Characters from './screens/Characters'
import CharacterDetail from './screens/CharacterDetail'
import Recruit from './screens/Recruit'
import RecruitResult from './screens/RecruitResult'
import RecruitHistory from './screens/RecruitHistory'
import Shop from './screens/Shop'
import Bag from './screens/Bag'
// 스토리 = 2.5D 탐색 필드(예전 스테이지 목록 화면 content/Story.tsx는 쓰지 않음)
import Explore from './screens/content/Explore'
import Wanted from './screens/content/Wanted'
import Training from './screens/content/Training'
import Arena from './screens/content/Arena'
import Raid from './screens/content/Raid'
import Prep from './screens/content/Prep'
import Battle from './screens/content/Battle'
import CaseFile from './screens/case/CaseFile'
import CaseBattle from './screens/case/CaseBattle'
import StoryField from './screens/story/StoryField'
import { Mail, Missions, Notices, Events, Attendance } from './screens/Ops'
import CommanderProfile from './screens/CommanderProfile'
import Settings from './screens/Settings'

const SCREENS: Record<ScreenName, (p: { params: Record<string, unknown> }) => ReactNode> = {
  boot: Boot, opening: Opening, lobby: Lobby, formation: Formation, characters: Characters, characterDetail: CharacterDetail,
  recruit: Recruit, recruitResult: RecruitResult, recruitHistory: RecruitHistory, shop: Shop, bag: Bag,
  story: StoryField, explore: Explore, wanted: Wanted, training: Training, arena: Arena, raid: Raid, prep: Prep, battle: Battle,
  mail: Mail, missions: Missions, notices: Notices, events: Events, attendance: Attendance, profile: CommanderProfile, settings: Settings, pass: Pass, passSummer: PassSummer, battleTest: BattleTest, caseFile: CaseFile, caseBattle: CaseBattle, storyField: StoryField,
}

let keySeq = 1
const mkRoute = (name: ScreenName, params: Record<string, unknown> = {}): Route => ({ key: keySeq++, name, params })

interface Toast { id: number; msg: string; tone: 'info' | 'ok' | 'warn' }

export default function App() {
  const s = useGame()
  const [stack, setStack] = useState<Route[]>(() => {
    // 개발·검증용: ?screen=formation 처럼 특정 화면으로 바로 진입
    const q = new URLSearchParams(location.search).get('screen') as ScreenName | null
    const id = new URLSearchParams(location.search).get('id') // 예: ?screen=characterDetail&id=kiyomi, ?screen=recruit&id=b_omp
    if (q && q in SCREENS && q !== 'boot') return q === 'lobby' ? [mkRoute('lobby')] : [mkRoute('lobby'), mkRoute(q, id ? { id, bannerId: id } : undefined)]
    return [mkRoute('boot')]
  })
  const [leaving, setLeaving] = useState<{ route: Route; dir: 'fwd' | 'back' } | null>(null)
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')
  const [toasts, setToasts] = useState<Toast[]>([])
  const guard = useRef<LeaveGuard | null>(null)
  const leaveTimer = useRef<number | null>(null)

  // 설정 반영: 연출 감소, 음량
  useEffect(() => {
    const prefersReduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    document.documentElement.classList.toggle('reduce-motion', s.settings.reduceMotion || false)
    document.documentElement.classList.toggle('low-quality', s.settings.quality === 'low')
    if (prefersReduce && !s.settings.reduceMotion) document.documentElement.classList.add('prefers-reduce')
    audio.setVolumes(s.settings.bgm, s.settings.sfx)
    audio.setLobbyTrack(s.settings.lobbyBgm ?? DEFAULT_LOBBY_TRACK)
  }, [s.settings])

  const stackRef = useRef(stack)
  const transitionTo = useCallback((next: Route[], d: 'fwd' | 'back') => {
    const prevTop = stackRef.current[stackRef.current.length - 1]
    stackRef.current = next
    if (prevTop && prevTop.key !== next[next.length - 1].key) {
      if (leaveTimer.current) clearTimeout(leaveTimer.current)
      setLeaving({ route: prevTop, dir: d })
      // 이전 화면은 전환 직후 언마운트(숨겨진 화면의 영상·소리·애니메이션 정지)
      leaveTimer.current = window.setTimeout(() => setLeaving(null), MOTION.screen)
    }
    setDir(d)
    setStack(next)
  }, [])

  const guarded = useCallback((go: () => void) => {
    const g = guard.current
    if (g) {
      const allow = g(() => { guard.current = null; go() })
      if (!allow) return
    }
    guard.current = null
    go()
  }, [])

  const nav: Nav = useMemo(() => ({
    stack,
    push: (name, params) => guarded(() => transitionTo([...stackRef.current, mkRoute(name, params)], 'fwd')),
    replace: (name, params) => guarded(() => transitionTo([...stackRef.current.slice(0, -1), mkRoute(name, params)], 'fwd')),
    back: () => guarded(() => { if (stackRef.current.length > 1) transitionTo(stackRef.current.slice(0, -1), 'back') }),
    home: () => guarded(() => {
      const prev = stackRef.current
      const i = prev.findIndex((r) => r.name === 'lobby')
      transitionTo(i >= 0 ? prev.slice(0, i + 1) : [mkRoute('lobby')], 'back')
    }),
    reset: (name, params) => guarded(() => transitionTo([mkRoute(name, params)], 'fwd')),
    setGuard: (g, key) => { if (key === undefined || key === stackRef.current[stackRef.current.length - 1].key) guard.current = g },
    toast: (msg, tone = 'info') => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t.slice(-2), { id, msg, tone }])
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
    },
  }), [stack, guarded, transitionTo])

  // 브라우저 뒤로가기 키(Escape)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.modal-back, .pr-overlay, .ss')) { const top = stack[stack.length - 1]; if (!['boot', 'opening', 'lobby', 'battle', 'battleTest', 'caseBattle', 'storyField', 'story'].includes(top.name)) nav.back() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [nav, stack])

  const top = stack[stack.length - 1]

  return (
    <NavContext.Provider value={nav}>
      <div className="stage" data-screen={top.name}>
        {(leaving ? [leaving.route, top] : [top]).map((r) => {
          const S = SCREENS[r.name]
          const isTop = r.key === top.key
          const cls = isTop ? `screen screen-active ${TRANSITION[r.name] ?? 't-fade'} ${dir === 'back' ? 'enter-back' : 'enter-fwd'}` : `screen screen-leaving ${leaving?.dir === 'back' ? 'leave-back' : 'leave-fwd'}`
          return (
            <div className={cls} key={r.key} aria-hidden={!isTop} {...(!isTop ? { inert: '' } : {})}>
              <ScreenKey.Provider value={r.key}><S params={r.params} /></ScreenKey.Provider>
            </div>
          )
        })}
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.msg}</div>)}
        </div>
      </div>
    </NavContext.Provider>
  )
}
