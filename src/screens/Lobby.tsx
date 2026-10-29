import '../styles/lobby.css' // 역 로비 메뉴(.rl-more)도 이 스타일을 쓴다
import '../styles/motion.css'
import LobbyStation from './LobbyStation'

// 로비 = 역 승강장 로비 하나.
// 카페(소파) 로비는 폐기(2026-10-29). 코드는 아래에 주석으로만 남겨 둔다(다시 쓰려면 주석을 풀고 테마 전환을 되살리면 됨).
// 저장값 lobby.theme 는 더 이상 보지 않는다: 'sofa'로 저장된 기기도 역 로비로 열린다.
export default function Lobby() {
  return <LobbyStation key="station" />
}

// ───────────── 폐기: 카페(소파) 로비 (2026-10-29) ─────────────
// import { useEffect, useState } from 'react'
// import '../styles/lobby.css'
// import { useNav, type ScreenName } from '../app/nav'
// import { audio } from '../app/audio'
// import { game, useGame, badges } from '../game/store'
// import { CHAR_BY_ID } from '../game/data/characters'
// import { GAME_CONFIG } from '../game/config'
// import { ConfirmDialog } from '../ui/components'
// import { IconGrid } from '../ui/icons'
// import { RefLayers, Hit, Patch, rectOf, type RefLayout } from '../ui/ref'
// import { MotionVideo, fitBox } from '../ui/motion'
// import fitJson from '../game/data/motion-fit.json'
// import matteJson from '../game/data/ref-matte.json'
// import '../styles/motion.css'
// import { MotionStage as RefStage, MotionItem, MotionTicker, SceneCue, AmbientFx, Fx } from '../ui/ui-motion'
// import layoutJson from '../game/data/ref-lobby.json'
// import LobbyStation from './LobbyStation'
// import { QuickBtn, useLobbyQuick } from '../ui/LobbyQuick'
// import { ProfileIcon } from '../ui/ProfileIcon'
// import { LiveRef } from '../ui/live/LiveRef'
// import { commanderOf } from '../game/data/profile'
// import { LOBBY_SCENES } from '../game/data/lobbyScenes'
//
// // 소파 로비 원본(1456×818)을 원본 조각 23개로 재현.
// // 재화·레벨은 원본 값과 같으면 원본 조각 그대로, 바뀌면 숫자 영역만 덮어 실제 텍스트로 표시한다.
// // 장면은 UI 없는 지안 소파 대기 영상(motion/sofa.mp4)이고, 원본 UI 조각은 배경을 걷어낸 매트로 그 위에 올린다.
// // 로비 캐릭터는 지안 장면만 있다(다른 캐릭터 로비 포즈 없음 → 선택 불가).
// const L = layoutJson as RefLayout
// const FIT = fitJson as unknown as Record<string, { s: number; x: number; y: number }>
// const MATTE = (matteJson as Record<string, Record<string, string>>).lobby
// const NAV_IDS = ['nav-story', 'nav-explore', 'nav-wanted', 'nav-training', 'nav-arena', 'nav-raid', 'nav-characters', 'nav-formation', 'nav-shop', 'nav-recruit']
// const GROUP = {
//   top: ['topbar-remainder', 'back', 'profile', 'stamina', 'currency-coins', 'currency-gems'],
//   left: ['character-switch'],
//   right: ['event-terminal', 'event-story', 'event-explore', 'event-wanted'],
//   bottom: ['navbar-remainder', ...NAV_IDS],
// }
// // 진입: 장면(줌아웃 2초) → 상단 380 → 좌 520 → 우 600 → 하단 700ms (그룹 1초, 안의 카드·메뉴는 차례로 튀어 오름, 약 2.4초)
// const DELAY = { top: 380, left: 520, right: 600, bottom: 700 }
// const REF = { stamina: 187, staminaMax: 240, credit: 388434, medal: 1443, level: 15, name: '마유' }
// const PILL_BG = '#070707'
//
// const NAV: { id: string; screen: ScreenName; label: string }[] = [
//   { id: 'nav-story', screen: 'story', label: '스토리' },
//   { id: 'nav-explore', screen: 'explore', label: '도시 탐색' },
//   { id: 'nav-wanted', screen: 'wanted', label: '현상수배' },
//   { id: 'nav-training', screen: 'training', label: '훈련' },
//   { id: 'nav-arena', screen: 'arena', label: '아레나' },
//   { id: 'nav-raid', screen: 'raid', label: '레이드' },
//   { id: 'nav-characters', screen: 'characters', label: '캐릭터' },
//   { id: 'nav-formation', screen: 'formation', label: '편성' },
//   { id: 'nav-shop', screen: 'shop', label: '상점' },
//   { id: 'nav-recruit', screen: 'recruit', label: '소환(영입)' },
// ]
//
// function Padded({ n, digits = 8 }: { n: number; digits?: number }) {
//   const s = String(Math.max(0, n)).padStart(digits, '0')
//   const lead = s.length - String(Math.max(0, n)).length
//   return <><span style={{ color: '#6d6d6d' }}>{s.slice(0, lead)}</span>{s.slice(lead)}</>
// }
//
// /** 로비 테마 선택: 소파 카페(기존) / 역 승강장. 선택은 저장되고 두 로비 모두 버튼으로 오갈 수 있다 */
// export default function Lobby(p: { params: Record<string, unknown> }) {
//   const s = useGame()
//   const theme = s.lobby.theme ?? 'sofa'
//   const toggle = () => game.setLobbyTheme(theme === 'sofa' ? 'station' : 'sofa')
//   return theme === 'station' ? <LobbyStation key="station" onTheme={toggle} /> : <SofaLobby key="sofa" {...p} onTheme={toggle} />
// }
//
// function SofaLobby({ onTheme }: { params: Record<string, unknown>; onTheme: () => void }) {
//   const s = useGame()
//   const nav = useNav()
//   const b = badges(s)
//   const quick = useLobbyQuick()
//   const [more, setMore] = useState(false)
//   const [viewing, setViewing] = useState(false)
//   const [toTitle, setToTitle] = useState(false)
//   // 전용 로비 장면이 있는 캐릭터면 지안 소파 영상 대신 그 장면(인물 포함 정지 그림)을 쓴다 → 두 인물이 겹치지 않는다
//   // 전용 장면이 없는 대원: 성수 거리 배경판 + 그 대원의 전신 그림(잘리지 않게 높이에 맞춤)
//   const lobbyChar = CHAR_BY_ID[s.lobby.characterId] ?? CHAR_BY_ID.rion
//   const own = LOBBY_SCENES[s.lobby.characterId]
//   const scene = own ?? { poster: lobbyChar.assets.stand, amb: 'city' as const, place: 'CITY' }
//
//   useEffect(() => { audio.bgm('lobby') }, [])
//   const go = (sc: ScreenName, p?: Record<string, unknown>) => { setMore(false); nav.push(sc, p) }
//
//   const W = s.wallet
//   const numText = { fontFamily: "Anton, 'Black Han Sans', sans-serif", fontSize: 26, letterSpacing: '0.02em', color: '#f4f4f4' } as const
//   const pillPatch = (x: number, w: number, children: React.ReactNode, key: string) => (
//     <Patch key={key} r={{ x, y: 27, w, h: 30 }} bg={PILL_BG} z={30} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', ...numText }}>
//       <span className="num-tab">{children}</span>
//     </Patch>
//   )
//
//   // 버튼 그림 자체가 움직인다(src/ui/live). 누르거나 마우스를 올리면 그 버튼이 바로 크게 한 번
//   const [kicks, setKicks] = useState<Record<string, number>>({})
//   const kick = (k: string) => setKicks((v) => ({ ...v, [k]: (v[k] ?? 0) + 1 }))
//   const press = (k: string, el: React.ReactNode) => <span className="live-press" onPointerDown={() => kick(k)} onPointerEnter={() => kick(k)}>{el}</span>
//   const live = (id: string) => {
//     const l = L.layers.find((q) => q.id === id)!
//     return <LiveRef id={`sofa:${id}`} src={MATTE[id] ?? l.file} x={l.x} y={l.y} w={l.width} h={l.height} z={1} kick={kicks[id] ?? 0} />
//   }
//   const LIVE_TOP = ['back', 'stamina', 'currency-coins', 'currency-gems']
//
//   const g = (k: keyof typeof DELAY) => ({ animationDelay: `${DELAY[k]}ms` })
//   return (
//     <div className="scr">
//       <RefStage canvas={L.canvas} className="ui-sofa">
//         {/* 장면: UI 없는 지안 소파 영상(배경+인물 한 장면). 감상 모드에서도 같은 영상을 그대로 쓴다 */}
//         {own
//           ? <img className="mv scene" src={scene.poster} alt="" draggable={false} style={{ left: 0, top: 0, width: 1456, height: 818 }} />
//           : scene
//           ? <div className="mv scene lb-fallback" style={{ left: 0, top: 0, width: 1456, height: 818 }}>
//               <img className="lb-fb-bg" src="ref/battle/plate.webp" alt="" draggable={false} />
//               <i className="lb-fb-glow" style={{ '--c': lobbyChar.accent } as React.CSSProperties} />
//               <img className="lb-fb-char" key={lobbyChar.id} src={lobbyChar.assets.stand} alt="" draggable={false} />
//             </div>
//           : <MotionVideo src="motion/sofa.mp4" poster="motion/sofa-poster.webp" style={fitBox(FIT.sofa, L.canvas)} />}
//         {/* 장면 공기(창가 햇살·먼지 / 캐릭터 장면별 입자). 장면 위, UI 아래 */}
//         <AmbientFx key={scene ? scene.poster : 'sofa'} kind={scene ? scene.amb : 'dust'} box={{ x: 0, y: 0, w: 1456, h: 818 }} count={30} />
//
//         <div className={`mg-wrap ${viewing ? 'hide' : ''}`} aria-hidden={viewing}>
//           <MotionTicker text="ABILITY KINGDOM / CITY RESPONSE UNIT" className="ui-lobby-ticker" />
//           <SceneCue title={scene ? scene.place : 'LOUNGE'} subtitle="ABILITY KINGDOM / LOBBY" />
//           {/* 상단 띠 */}
//           <div className="mg mg-top" style={g('top')}>
//             <RefLayers layout={L} ids={GROUP.top.filter((id) => !LIVE_TOP.includes(id))} z={1} />
//             {LIVE_TOP.map((id) => <span key={id}>{live(id)}</span>)}
//             {/* 원형 프로필 사진: 팀장 정보에서 장착한 프로필 아이콘 */}
//             <ProfileIcon id={commanderOf(s).iconId} style={{ position: 'absolute', left: 139, top: 19, width: 42, height: 42, borderRadius: '50%', zIndex: 2, backgroundRepeat: 'no-repeat', boxShadow: '0 0 0 2px #141414' }} />
//             {W.stamina !== REF.stamina && pillPatch(912, 98, <>{W.stamina} / {GAME_CONFIG.staminaMax}</>, 'st')}
//             {W.credit !== REF.credit && pillPatch(1075, 100, <Padded n={W.credit} />, 'cr')}
//             {W.exchangeMedal !== REF.medal && pillPatch(1247, 100, <Padded n={W.exchangeMedal} />, 'md')}
//             {(s.playerLevel !== REF.level || s.playerName !== REF.name) && (
//               <Patch r={{ x: 192, y: 19, w: 180, h: 44 }} bg="#141414" z={30}>
//                 <b style={{ position: 'absolute', left: 6, top: 3, fontSize: 19, fontWeight: 900 }}>{s.playerName}</b>
//                 <span style={{ position: 'absolute', right: 14, top: 4, fontFamily: 'Anton, sans-serif', fontSize: 30 }}>{s.playerLevel}</span>
//               </Patch>
//             )}
//             {/* 추가 메뉴(원본에 없는 보조 메뉴 진입점: 가방·우편·미션·공지·이벤트·출석·설정) */}
//             <Patch r={{ x: 822, y: 20, w: 50, h: 44 }} bg="#141414" z={30} style={{ borderRadius: 10, display: 'grid', placeItems: 'center', boxShadow: 'inset 0 0 0 1px #3a3a3a' }}>
//               <IconGrid size={24} />
//               {(b.mail || b.mission || b.notice || b.attendance) && <span style={{ position: 'absolute', right: 5, top: 5, width: 9, height: 9, borderRadius: 5, background: '#ff4d4f' }} />}
//             </Patch>
//             {/* 로비 테마 전환(원본에 없는 추가 버튼) */}
//             <Patch r={{ x: 700, y: 20, w: 112, h: 44 }} bg="#141414" z={30} className="rl-theme" style={{ borderRadius: 10, boxShadow: 'inset 0 0 0 1px #3a3a3a' }}>
//               <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><rect x="5" y="3" width="14" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M5 11h14M8 21l2-4M16 21l-2-4" stroke="currentColor" strokeWidth="2" /><circle cx="9" cy="14" r="1" fill="currentColor" /><circle cx="15" cy="14" r="1" fill="currentColor" /></svg>
//               <span>역 로비</span>
//             </Patch>
//             {/* 로비 배경음악 고르기(추가 버튼) */}
//             <QuickBtn kind="bgm" r={{ x: 636, y: 14, w: 56, h: 56 }} label="로비 배경음악 고르기" onClick={() => quick.open('bgm')} />
//             <Hit r={{ x: 822, y: 20, w: 50, h: 44 }} label="더보기 메뉴" onClick={() => setMore((v) => !v)} />
//             <Hit r={{ x: 700, y: 20, w: 112, h: 44 }} label="로비 테마 변경: 역 승강장 로비로" sfx="none" onClick={() => { audio.sfx('swap'); onTheme() }} />
//             {press('back', <Hit r={rectOf(L, 'back')} label="타이틀 화면으로" onClick={() => setToTitle(true)} />)}
//             <Hit r={rectOf(L, 'profile')} label="프로필" onClick={() => go('profile')} />
//             {press('stamina', <Hit r={rectOf(L, 'stamina')} label={`행동력 ${W.stamina} / ${GAME_CONFIG.staminaMax}, 충전`} onClick={() => go('shop', { tab: 'currency' })} />)}
//             {press('currency-coins', <Hit r={rectOf(L, 'currency-coins')} label={`크레딧 ${W.credit}`} onClick={() => go('shop', { tab: 'currency' })} />)}
//             {press('currency-gems', <Hit r={rectOf(L, 'currency-gems')} label={`교환 메달 ${W.exchangeMedal}`} onClick={() => go('shop', { tab: 'exchange' })} />)}
//           </div>
//           {/* 왼쪽: 로비 캐릭터 변경 */}
//           <div className="mg mg-left" style={g('left')}>
//             {live('character-switch')}
//             <Fx r={{ x: 57, y: 585, w: 84, h: 53 }} className="ui-ring" z={2} />
//             {press('character-switch', <Hit r={rectOf(L, 'character-switch')} label="로비 캐릭터 변경" onClick={() => quick.open('char')} />)}
//           </div>
//           {/* 오른쪽: 이벤트 패널 */}
//           <div className="mg mg-right" style={g('right')}>
//             <RefLayers layout={L} ids={['event-terminal']} z={1} files={MATTE} />
//             {([{ id: 'event-story', screen: 'story', label: '스토리' }, { id: 'event-explore', screen: 'explore', label: '도시 탐색' }, { id: 'event-wanted', screen: 'wanted', label: '현상수배' }] as const).map((n, i) => (
//               <MotionItem key={n.id} order={i} className="ui-side-card" idle={false}>
//                 {live(n.id)}
//                 {press(n.id, <Hit r={rectOf(L, n.id)} label={`이벤트: ${n.label}`} onClick={() => go(n.screen)} />)}
//               </MotionItem>
//             ))}
//           </div>
//           {/* 하단 메뉴 띠 */}
//           <div className="mg mg-bottom" style={g('bottom')}>
//             <RefLayers layout={L} ids={['navbar-remainder']} z={1} files={MATTE} />
//             {NAV.map((n, i) => <MotionItem key={n.id} order={i} className="ui-nav-item" idle={false}>
//               {live(n.id)}
//               {press(n.id, <Hit r={rectOf(L, n.id)} label={n.label} onClick={() => go(n.screen)} className={`lb-nav-${n.screen}`} />)}
//             </MotionItem>)}
//           </div>
//         </div>
//
//         {viewing && <Hit r={{ x: 0, y: 0, w: 1456, h: 818 }} z={70} label="UI 다시 표시" onClick={() => setViewing(false)} />}
//         {more && !viewing && (
//           <div className="rl-more" style={{ left: 450, top: 72 }} onClick={(e) => e.stopPropagation()}>
//             {([
//               ['가방', 'bag', false], ['패스', 'pass', false], ['썸머 패스', 'passSummer', false], ['1장 · 끊어진 신호', 'caseFile', false], ['전투 테스트', 'battleTest', false], ['우편함', 'mail', b.mail], ['미션', 'missions', b.mission], ['공지', 'notices', b.notice],
//               ['이벤트', 'events', b.event], ['출석', 'attendance', b.attendance], ['프로필', 'profile', false], ['설정', 'settings', false],
//             ] as [string, ScreenName, boolean][]).map(([label, sc, dot]) => (
//               <button key={sc} onClick={() => { audio.sfx('tap'); go(sc) }}>{label}{dot && <span className="dot" />}</button>
//             ))}
//             <button onClick={() => { audio.sfx('tap'); setMore(false); setViewing(true) }}>감상 모드</button>
//             <button onClick={() => { audio.sfx('swap'); setMore(false); onTheme() }}>역 로비로</button>
//           </div>
//         )}
//       </RefStage>
//
//       {quick.modal}
//       {toTitle && (
//         <ConfirmDialog title="타이틀 화면으로 돌아갈까요?" body="진행 상황은 이 기기에 저장되어 있습니다." actions={[
//           { label: '취소', variant: 'ghost', onClick: () => setToTitle(false) },
//           { label: '타이틀로', variant: 'primary', onClick: () => { setToTitle(false); nav.reset('boot') } },
//         ]} />
//       )}
//     </div>
//   )
// }
