import { useEffect, useRef, useState } from 'react'
import { useNav, type ScreenName } from '../app/nav'
import { audio } from '../app/audio'
import { useGame, badges } from '../game/store'
import { CHAR_BY_ID } from '../game/data/characters'
import { BANNERS, STORY_CHAPTERS } from '../game/data/catalog'
import { Modal, Btn, ConfirmDialog } from '../ui/components'
import { RefLayers, Hit, TextlessPatch, rectOf, useNow, type RefLayout, type TextlessMeta } from '../ui/ref'
import layoutJson from '../game/data/ref-station.json'
import fitJson from '../game/data/motion-fit.json'
import matteJson from '../game/data/ref-matte.json'
import { MotionVideo, fitBox } from '../ui/motion'
import '../styles/motion.css'
import { LOBBY_SCENES } from '../game/data/lobbyScenes'
import { BannerCarousel } from '../ui/BannerCarousel'
import { QuickBtn, useLobbyQuick } from '../ui/LobbyQuick'
import { ProfileIcon } from '../ui/ProfileIcon'
import { HomeIcon } from '../ui/navicons/HomeIcon'
import { LiveNavIcon } from '../ui/navicons/LiveNavIcon'
import { commanderOf } from '../game/data/profile'
import { MotionStage as RefStage, MotionItem, MotionTicker, SceneCue, AmbientFx, Fx } from '../ui/ui-motion'
import textless from '../game/data/ref-textless.json'

// 역 승강장 로비 원본(1672×941)을 원본 조각 26개로 재현.
// - 기본 표시는 원본 조각 그대로. 원본과 값이 다른 부분(재화·프로필·목표·타이머)만
//   글자를 지운 근사 패치(tools/make_textless.py) + 실제 텍스트로 덮는다.
// - 알림 표시(점·N·!)는 실제 상태가 없으면 지운 패치로 덮고, 있으면 원본 그림을 그대로 보인다.
// - 장면은 UI 없는 지안 역 로비 대기 영상(motion/station.mp4). UI 조각·패치는 배경을 걷어낸 매트를 쓴다(tools/build_motion_mattes.py).
const L = layoutJson as RefLayout
const T = textless.station as Record<string, TextlessMeta>

const GROUPS: Record<string, string[]> = {
  top: ['profile', 'currency-gems', 'currency-coins', 'notice', 'mail', 'menu'],
  left: ['pickup', 'messages', 'events', 'coupon', 'costume', 'wanted', 'shop', 'training'],
  right: ['quest', 'attendance', 'arena', 'raid', 'exploration', 'story'],
  bottom: ['characters', 'formation', 'home', 'bag', 'recruitment'],
}
// 진입: 장면 0ms → 상단 80 → 좌 130 → 우 170 → 하단 220ms(각 240ms 이동+페이드, 0.46초 안에 정착)
const DELAY = { top: 380, left: 520, right: 600, bottom: 700 }
const FIT = fitJson as unknown as Record<string, { s: number; x: number; y: number }>
const MATTE = (matteJson as Record<string, Record<string, string>>).station
const TM = (matteJson as Record<string, Record<string, string>>)['station-textless']
const NOBADGE = (matteJson as Record<string, Record<string, string>>)['station-nobadge']
const REF = { diamond: 830, credit: 598_000, level: 32, name: '지안' }

const kfmt = (n: number) => (n >= 1000 ? `${Math.floor(n / 1000)} K` : String(n))
const untilMidnight = (now: number) => {
  const d = new Date(now); const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
  const s = Math.max(0, Math.floor((end - now) / 1000))
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':')
}

type Pop = null | 'coins' | 'menu' | 'messages' | 'coupon' | 'costume'

export default function LobbyStation({ onTheme }: { onTheme: () => void }) {
  const s = useGame()
  const nav = useNav()
  const b = badges(s)
  const now = useNow(1000)
  const [pop, setPop] = useState<Pop>(null)
  const quick = useLobbyQuick()
  // 하단 메뉴 아이콘: 손가락을 대거나 마우스를 올리면 그 아이콘이 크게 한 번 움직인다
  const [kicks, setKicks] = useState({ characters: 0, formation: 0, bag: 0, recruitment: 0 })
  const kick = (k: keyof typeof kicks) => setKicks((v) => ({ ...v, [k]: v[k] + 1 }))
  const [viewing, setViewing] = useState(false)
  const [toTitle, setToTitle] = useState(false)
  const [line, setLine] = useState<string | null>(null)
  const lineAt = useRef(0)
  const lineTimer = useRef<number>(0)
  const [coupon, setCoupon] = useState('')
  const [couponMsg, setCouponMsg] = useState('')
  useEffect(() => { audio.bgm('lobby') }, [])
  useEffect(() => () => window.clearTimeout(lineTimer.current), [])

  const go = (sc: ScreenName, p?: Record<string, unknown>) => { setPop(null); nav.push(sc, p) }
  const W = s.wallet
  const lobbyChar = CHAR_BY_ID[s.lobby.characterId] ?? CHAR_BY_ID.rion
  // 전용 로비 장면이 있는 캐릭터면 지안 역 영상 대신 그 장면을 쓴다(인물 중복 방지)
  const scene = LOBBY_SCENES[s.lobby.characterId]
  const pickup = BANNERS.find((x) => x.kind === 'limited')
  const allStages = STORY_CHAPTERS.flatMap((c) => c.stages)
  const goal = allStages.find((st) => !s.content.storyCleared.includes(st.id))

  const talk = () => {
    // 준비된 대사만 표시(음성 파일 없음). 연속 클릭은 1.5초 간격
    if (Date.now() - lineAt.current < 1500) return
    lineAt.current = Date.now()
    audio.sfx('tap')
    setLine(lobbyChar.tagline)
    window.clearTimeout(lineTimer.current)
    lineTimer.current = window.setTimeout(() => setLine(null), 2600)
  }

  const g = (k: keyof typeof DELAY) => ({ animationDelay: `${DELAY[k]}ms` })
  const tl = (k: string) => ({ ...T[k], file: TM[k] ?? T[k].file })
  // 알림 표시: 실제 상태가 있으면 원본 그림(표시 포함), 없으면 표시를 지운 판을 쓴다
  const badgeOn: Record<string, boolean> = { profile: false, notice: b.notice, menu: b.mission, events: b.event, training: false, exploration: false, story: false, formation: false, recruitment: false }
  const files = { ...MATTE, ...Object.fromEntries(Object.entries(badgeOn).filter(([, on]) => !on).map(([id]) => [id, NOBADGE[id]])) }

  return (
    <div className="scr rs">
      <RefStage canvas={L.canvas} className="ui-station">
        {/* 장면: UI 없는 지안 역 로비 영상. 감상 모드에서도 같은 영상을 그대로 쓴다 */}
        {scene
          ? <img className="mv scene" src={scene.poster} alt="" draggable={false} style={{ left: 0, top: 0, width: 1672, height: 941 }} />
          : <MotionVideo src="motion/station.mp4" poster="motion/station-poster.webp" style={fitBox(FIT.station, L.canvas)} />}
        {/* 승강장 빛 입자 + 가끔 지나가는 열차 불빛 / 캐릭터 장면별 입자(장면 위, UI 아래) */}
        <AmbientFx key={scene ? scene.poster : 'station'} kind={scene ? scene.amb : 'city'} box={{ x: 0, y: 0, w: 1672, h: 941 }} count={28} />
        {line && !viewing && <div className="rs-line" role="status"><b>{lobbyChar.name}</b>{line}</div>}
        {!viewing && <Hit r={{ x: 470, y: 110, w: 520, h: 680 }} z={5} sfx="none" label={`${lobbyChar.name}에게 말 걸기`} onClick={talk} className="rs-char" />}

        <div className={`mg-wrap ${viewing ? 'hide' : ''}`} aria-hidden={viewing}>
          <MotionTicker text="ABILITY KINGDOM / CITY RESPONSE UNIT" className="ui-lobby-ticker" />
          <SceneCue title={scene ? scene.place : 'CITY LINE'} subtitle="ABILITY KINGDOM / LOBBY" />
          {/* 상단: 프로필·재화·공지/우편/메뉴·테마 */}
          <div className="mg mg-top" style={g('top')}>
            <RefLayers layout={L} ids={GROUPS.top} z={2} files={files} />
            {/* 원형 프로필 사진: 팀장 정보에서 장착한 프로필 아이콘(대원증 사진과 같은 값) */}
            <ProfileIcon id={commanderOf(s).iconId} className="lobby-pi" style={{ position: 'absolute', left: 31, top: 15, width: 76, height: 76, borderRadius: '50%', zIndex: 3, backgroundRepeat: 'no-repeat' }} />
            {W.diamond !== REF.diamond && (
              <TextlessPatch m={tl('gems-num')}><span className="abs rs-num" style={{ right: 8, top: 6 }}>{W.diamond}</span></TextlessPatch>
            )}
            {kfmt(W.credit) !== kfmt(REF.credit) && (
              <TextlessPatch m={tl('coins-num')}><span className="abs rs-num" style={{ right: 15, top: 6 }}>{kfmt(W.credit)}</span></TextlessPatch>
            )}
            {s.playerLevel !== REF.level && (
              <TextlessPatch m={tl('profile-lv')}><span className="abs rs-lv" style={{ left: 4, top: 3 }}><small>Lv.</small>{s.playerLevel}</span></TextlessPatch>
            )}
            {s.playerName !== REF.name && (
              <TextlessPatch m={tl('profile-name')}><span className="abs rs-name" style={{ left: 6, top: 3 }}>{s.playerName}</span></TextlessPatch>
            )}
            {/* 우편은 원본에 표시가 없어, 공지의 원본 점 그림을 같은 크기로 재사용 */}
            {b.mail && <img className="ref-layer" src={T['badge-notice'].sprite} alt="" style={{ left: 1532, top: 19, width: T['badge-notice'].w, height: T['badge-notice'].h, zIndex: 21 }} />}
            {b.notice && <Fx r={{ x: 1451, y: 27, w: 13, h: 13 }} className="ui-ping" z={22} />}
            {b.mission && <Fx r={{ x: 1624, y: 27, w: 13, h: 13 }} className="ui-ping" z={22} />}
            {b.mail && <Fx r={{ x: 1540, y: 27, w: 13, h: 13 }} className="ui-ping" z={22} />}
            {/* 로비 배경음악·캐릭터 고르기(추가 버튼, 재화 띠와 테마 버튼 사이 빈 곳) */}
            <QuickBtn kind="bgm" r={{ x: 1132, y: 16, w: 58, h: 58 }} label="로비 배경음악 고르기" onClick={() => quick.open('bgm')} />
            <QuickBtn kind="char" r={{ x: 1198, y: 16, w: 58, h: 58 }} label={`로비 캐릭터 고르기 (지금: ${lobbyChar.name})`} onClick={() => quick.open('char')} />
            {/* 로비 테마 전환(원본에 없는 추가 버튼, 얼굴·카드와 겹치지 않는 상단 빈 영역) */}
            <div className="rs-theme" style={{ left: 1268, top: 22, width: 126, height: 50 }} aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 11a8 8 0 0 1 16 0v5H4z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M2 16h20M7 16v3M17 16v3" stroke="currentColor" strokeWidth="2" /></svg>
              <span>카페 로비</span>
            </div>
            <Hit r={{ x: 1268, y: 22, w: 126, h: 50 }} label="로비 테마 변경: 카페(소파) 로비로" sfx="none" onClick={() => { audio.sfx('swap'); onTheme() }} />
            <Hit r={rectOf(L, 'profile')} label={`프로필: ${s.playerName}, 레벨 ${s.playerLevel}`} onClick={() => go('profile')} />
            <Hit r={rectOf(L, 'currency-gems')} label={`다이아 ${W.diamond}, 충전`} onClick={() => go('shop', { tab: 'currency' })} />
            <Hit r={rectOf(L, 'currency-coins')} label={`크레딧 ${W.credit.toLocaleString()}, 자세히`} onClick={() => setPop('coins')} />
            <Hit r={rectOf(L, 'notice')} label={`공지${b.notice ? ', 읽지 않은 공지 있음' : ''}`} onClick={() => go('notices')} />
            <Hit r={rectOf(L, 'mail')} label={`우편${b.mail ? ', 받을 보상 있음' : ''}`} onClick={() => go('mail')} />
            <Hit r={rectOf(L, 'menu')} label="전체 메뉴" onClick={() => setPop((p) => (p === 'menu' ? null : 'menu'))} />
          </div>

          {/* 왼쪽: 픽업·아이콘·카드. 겹친 카드는 실제 앞뒤 순서대로 클릭(현상수배 > 훈련 > 상점) */}
          <div className="mg mg-left" style={g('left')}>
            {/* 픽업 배너 → 슬라이드(원본 픽업 배너 + S01 패스 + FP1 썸머 패스). 원본에 그려진 점 표시는 가리고 실제 장 수만큼 점을 그린다 */}
            <MotionItem order={0} z={50} className="ui-side-card" idle={false}>
              <BannerCarousel x={27} y={124} w={353} h={113} dotsY={247} mask={files.pickup}
                slides={[
                  { id: 'pickup', label: `픽업 영입${pickup ? `: ${pickup.title}` : ''}`, onOpen: () => go('recruit', { bannerId: pickup?.id }),
                    art: <img src={files.pickup} alt="" draggable={false} className="bc-zoom" style={{ left: 0, top: 0, width: 353, height: 133 }} /> },
                  { id: 'pass', label: 'S01 패스: 센카', onOpen: () => go('pass'),
                    art: <><img src="ref/pass/banner-s01.webp" alt="" draggable={false} className="bc-zoom" style={{ left: 0, top: -3, width: 353, height: 118 }} /><b className="bc-tag">SEASON PASS</b></> },
                  { id: 'summer', label: 'FP1 썸머 패스', onOpen: () => go('passSummer'),
                    art: <img src="ref/pass/banner-summer.webp" alt="" draggable={false} className="bc-zoom" style={{ left: 0, top: -3, width: 353, height: 118 }} /> },
                ]} />
            </MotionItem>
            <MotionItem order={1} z={50} className="ui-side-card">
              <RefLayers layout={L} ids={['messages']} z={2} files={files} />

              <Hit r={rectOf(L, 'messages')} label="메시지" onClick={() => setPop('messages')} />
            </MotionItem>
            <MotionItem order={2} z={50} className="ui-side-card">
              <RefLayers layout={L} ids={['events']} z={2} files={files} />
              {b.event && <Fx r={{ x: 106, y: 364, w: 13, h: 12 }} className="ui-ping" z={22} />}

              <Hit r={rectOf(L, 'events')} label={`이벤트${b.event ? ', 새 이벤트 있음' : ''}`} onClick={() => go('events')} />
            </MotionItem>
            <MotionItem order={3} z={50} className="ui-side-card">
              <RefLayers layout={L} ids={['coupon']} z={2} files={files} />

              <Hit r={rectOf(L, 'coupon')} label="쿠폰 이벤트" onClick={() => { setCoupon(''); setCouponMsg(''); setPop('coupon') }} />
            </MotionItem>
            <MotionItem order={4} z={50} className="ui-side-card">
              <RefLayers layout={L} ids={['costume']} z={2} files={files} />

              <Hit r={rectOf(L, 'costume')} label="코스튬" onClick={() => setPop('costume')} />
            </MotionItem>
            <MotionItem order={5} z={53} className="ui-side-card">
              <RefLayers layout={L} ids={['wanted']} z={2} files={files} />

              <Hit r={rectOf(L, 'wanted')} z={53} label="현상수배" onClick={() => go('wanted')} className="st-card" />
            </MotionItem>
            <MotionItem order={6} z={51} className="ui-side-card">
              <RefLayers layout={L} ids={['shop']} z={2} files={files} />

              <Hit r={{ x: 125, y: 638, w: 284, h: 62 }} z={51} label="상점" onClick={() => go('shop')} className="st-card" />
            </MotionItem>
            <MotionItem order={7} z={52} className="ui-side-card">
              <RefLayers layout={L} ids={['training']} z={2} files={files} />

              <Hit r={{ x: 47, y: 705, w: 391, h: 207 }} z={52} label="훈련" onClick={() => go('training')} className="st-card" />
            </MotionItem>
          </div>

          {/* 오른쪽: 메인 목표·출석·아레나·레이드·도시 탐색·스토리 */}
          <div className="mg mg-right" style={g('right')}>

            <MotionItem order={0} z={50} className="ui-side-card">
              <RefLayers layout={L} ids={['quest']} z={2} files={files} />
              <TextlessPatch m={tl('quest-text')}>
              <span className="abs rs-quest" style={{ left: 8, top: 5 }}>{goal ? <><b>{goal.id}</b> 클리어하기</> : '모든 스토리 클리어'}</span>
            </TextlessPatch>
              <Hit r={rectOf(L, 'quest')} label={goal ? `메인 목표: ${goal.id} 클리어하기` : '메인 목표 없음'} onClick={() => go('story', { stageId: goal?.id })} className="st-card" />
            </MotionItem>
            <MotionItem order={1} z={50} className="ui-side-card">
              <RefLayers layout={L} ids={['attendance']} z={2} files={files} />
              <TextlessPatch m={tl('attendance-timer')}>
              <span className="abs rs-timer num-tab" style={{ left: 6, top: 3 }}>{untilMidnight(now)}</span>
            </TextlessPatch>
              <Hit r={rectOf(L, 'attendance')} label={`출석 이벤트${b.attendance ? ', 오늘 보상 받기 가능' : ''}`} onClick={() => go('attendance')} className="st-card" />
            </MotionItem>
            <MotionItem order={2} z={50} className="ui-side-card">
              <RefLayers layout={L} ids={['arena']} z={2} files={files} />

              <Hit r={rectOf(L, 'arena')} label="아레나" onClick={() => go('arena')} />
            </MotionItem>
            <MotionItem order={3} z={50} className="ui-side-card">
              <RefLayers layout={L} ids={['raid']} z={2} files={files} />

              <Hit r={rectOf(L, 'raid')} label="레이드" onClick={() => go('raid')} />
            </MotionItem>
            <MotionItem order={4} z={50} className="ui-side-card">
              <RefLayers layout={L} ids={['exploration']} z={2} files={files} />

              <Hit r={{ x: 1238, y: 502, w: 396, h: 163 }} label="도시 탐색" onClick={() => go('explore')} className="st-card" />
            </MotionItem>
            <MotionItem order={5} z={51} className="ui-side-card">
              <RefLayers layout={L} ids={['story']} z={2} files={files} />

              <Hit r={{ x: 1195, y: 665, w: 440, h: 233 }} z={51} label="스토리" onClick={() => go('story')} className="st-card" />
            </MotionItem>
          </div>

          {/* 하단 메뉴(인물 위에 그려진 흰 아이콘·글자만 남긴 매트) */}
          <div className="mg mg-bottom" style={g('bottom')}>
            <MotionItem order={0} z={50} className="ui-nav-item" idle={false}>
              <LiveNavIcon kind="characters" x={rectOf(L, 'characters').x} y={rectOf(L, 'characters').y} kick={kicks.characters} />

              <span onPointerDown={() => kick('characters')} onPointerEnter={() => kick('characters')}><Hit r={rectOf(L, 'characters')} label="캐릭터" onClick={() => go('characters')} /></span>
            </MotionItem>
            <MotionItem order={1} z={50} className="ui-nav-item" idle={false}>
              <LiveNavIcon kind="formation" x={rectOf(L, 'formation').x} y={rectOf(L, 'formation').y} kick={kicks.formation} />

              <span onPointerDown={() => kick('formation')} onPointerEnter={() => kick('formation')}><Hit r={rectOf(L, 'formation')} label="편성" onClick={() => go('formation')} /></span>
            </MotionItem>
            <MotionItem order={2} z={50} className="ui-nav-item" idle={false}>
              {/* 하단 메뉴: 원본 그림 자체가 움직이는 아이콘(src/ui/navicons) */}
              <HomeIcon x={rectOf(L, 'home').x} y={rectOf(L, 'home').y} />

              <Hit r={rectOf(L, 'home')} label="홈 (현재 로비)" onClick={() => setPop(null)} />
            </MotionItem>
            <MotionItem order={3} z={50} className="ui-nav-item" idle={false}>
              <LiveNavIcon kind="bag" x={rectOf(L, 'bag').x} y={rectOf(L, 'bag').y} kick={kicks.bag} />

              <span onPointerDown={() => kick('bag')} onPointerEnter={() => kick('bag')}><Hit r={rectOf(L, 'bag')} label="가방" onClick={() => go('bag')} /></span>
            </MotionItem>
            <MotionItem order={4} z={50} className="ui-nav-item" idle={false}>
              <LiveNavIcon kind="recruitment" x={rectOf(L, 'recruitment').x} y={rectOf(L, 'recruitment').y} kick={kicks.recruitment} />

              <span onPointerDown={() => kick('recruitment')} onPointerEnter={() => kick('recruitment')}><Hit r={rectOf(L, 'recruitment')} label="영입" onClick={() => go('recruit')} /></span>
            </MotionItem>
          </div>
        </div>
        {viewing && <Hit r={{ x: 0, y: 0, w: 1672, h: 941 }} z={70} label="UI 다시 표시" onClick={() => setViewing(false)} />}

        {pop === 'menu' && (
          <div className="rl-more rs-menu" style={{ left: 1196, top: 90 }} onClick={(e) => e.stopPropagation()}>
            {([
              ['미션', 'missions', b.mission], ['패스', 'pass', false], ['썸머 패스', 'passSummer', false], ['1장 · 끊어진 신호', 'caseFile', false], ['전투 테스트', 'battleTest', false], ['출석', 'attendance', b.attendance], ['우편함', 'mail', b.mail], ['공지', 'notices', b.notice],
              ['이벤트', 'events', b.event], ['가방', 'bag', false], ['프로필', 'profile', false], ['설정', 'settings', false],
            ] as [string, ScreenName, boolean][]).map(([label, sc, d]) => (
              <button key={sc} onClick={() => { audio.sfx('tap'); go(sc) }}>{label}{d && <span className="dot" />}</button>
            ))}
            <button onClick={() => { audio.sfx('tap'); setPop(null); setViewing(true) }}>감상 모드</button>
            <button onClick={() => { audio.sfx('swap'); setPop(null); onTheme() }}>카페 로비로</button>
            <button onClick={() => { audio.sfx('tap'); setPop(null); setToTitle(true) }}>타이틀로</button>
          </div>
        )}
      </RefStage>
      {quick.modal}

      {pop === 'coins' && (
        <Modal onClose={() => setPop(null)} labelledBy="coin-title">
          <h2 id="coin-title">크레딧</h2>
          <p className="rs-pop-big num">{W.credit.toLocaleString()}</p>
          <p className="rs-pop-note">획득 경로: 스토리·도시 탐색·현상수배·훈련 보상, 우편, 미션. 사용처: 캐릭터 성장.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setPop(null)}>닫기</Btn></div>
        </Modal>
      )}
      {pop === 'messages' && (
        <Modal onClose={() => setPop(null)} labelledBy="msg-title">
          <h2 id="msg-title">메시지</h2>
          <p className="rs-pop-note">캐릭터 대화(메시지) 기능은 아직 기획이 확정되지 않아 대화 데이터가 없습니다.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setPop(null)}>닫기</Btn></div>
        </Modal>
      )}
      {pop === 'costume' && (
        <Modal onClose={() => setPop(null)} labelledBy="cos-title">
          <h2 id="cos-title">코스튬 · {lobbyChar.name}</h2>
          <p className="rs-pop-note">코스튬 시스템은 후보 단계라 보유·미리보기 데이터가 없습니다. 현재 기본 의상만 있습니다.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setPop(null)}>닫기</Btn></div>
        </Modal>
      )}
      {pop === 'coupon' && (
        <Modal onClose={() => setPop(null)} labelledBy="cp-title">
          <h2 id="cp-title">쿠폰 이벤트</h2>
          <form className="rs-coupon" onSubmit={(e) => { e.preventDefault(); audio.sfx('error'); setCouponMsg(coupon.trim() ? '등록되지 않은 쿠폰 코드입니다. (쿠폰 서버 미연동 · 개발용 확인만 가능)' : '쿠폰 코드를 입력하세요.') }}>
            <input aria-label="쿠폰 코드" value={coupon} maxLength={20} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="COUPON CODE" />
            <Btn variant="primary" type="submit">확인</Btn>
          </form>
          {couponMsg && <p className="rs-pop-note" role="alert">{couponMsg}</p>}
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setPop(null)}>닫기</Btn></div>
        </Modal>
      )}
      {toTitle && (
        <ConfirmDialog title="타이틀 화면으로 돌아갈까요?" body="진행 상황은 이 기기에 저장되어 있습니다." actions={[
          { label: '취소', variant: 'ghost', onClick: () => setToTitle(false) },
          { label: '타이틀로', variant: 'primary', onClick: () => { setToTitle(false); nav.reset('boot') } },
        ]} />
      )}
    </div>
  )
}

