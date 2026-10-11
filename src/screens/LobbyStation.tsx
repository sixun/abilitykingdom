import { useEffect, useRef, useState } from 'react'
import { useNav, type ScreenName } from '../app/nav'
import { audio } from '../app/audio'
import { useGame, badges } from '../game/store'
import { CHAR_BY_ID } from '../game/data/characters'
import { BANNERS, STORY_CHAPTERS } from '../game/data/catalog'
import { Modal, Btn, ConfirmDialog } from '../ui/components'
import { RefStage, RefLayers, Hit, TextlessPatch, rectOf, useNow, type RefLayout, type TextlessMeta } from '../ui/ref'
import layoutJson from '../game/data/ref-station.json'
import textless from '../game/data/ref-textless.json'

// 역 승강장 로비 원본(1672×941)을 원본 조각 26개로 재현.
// - 기본 표시는 원본 조각 그대로. 원본과 값이 다른 부분(재화·프로필·목표·타이머)만
//   글자를 지운 근사 패치(tools/make_textless.py) + 실제 텍스트로 덮는다.
// - 알림 표시(점·N·!)는 실제 상태가 없으면 지운 패치로 덮고, 있으면 원본 그림을 그대로 보인다.
// - 조각은 배경을 포함한 정적 크롭이라 이동시키지 않는다(진입 효과는 불투명도만).
const L = layoutJson as RefLayout
const T = textless.station as Record<string, TextlessMeta>

const GROUPS: Record<string, string[]> = {
  top: ['profile', 'currency-gems', 'currency-coins', 'notice', 'mail', 'menu'],
  left: ['pickup', 'messages', 'events', 'coupon', 'costume', 'wanted', 'shop', 'training'],
  right: ['quest', 'attendance', 'arena', 'raid', 'exploration', 'story'],
  bottom: ['characters', 'formation', 'home', 'bag', 'recruitment'],
}
// 진입 순서: 배경 → 캐릭터(장면) → 상단 → 좌측 → 우측 → 하단. 전체 365ms 안에 끝난다
const DELAY: Record<string, number> = { scene: 0, top: 120, left: 155, right: 190, bottom: 225 }
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
  const lobbyChar = CHAR_BY_ID[s.lobby.characterId] ?? CHAR_BY_ID.jian
  const pickup = BANNERS.find((x) => x.kind === 'limited')
  const allStages = STORY_CHAPTERS.flatMap((c) => c.stages)
  const goal = allStages.find((st) => !s.content.storyCleared.includes(st.id))
  const fade = (g: keyof typeof DELAY) => ({ animationDelay: `${DELAY[g]}ms` })

  const talk = () => {
    // 준비된 대사만 표시(음성 파일 없음). 연속 클릭은 1.5초 간격
    if (Date.now() - lineAt.current < 1500) return
    lineAt.current = Date.now()
    audio.sfx('tap')
    setLine(lobbyChar.tagline)
    window.clearTimeout(lineTimer.current)
    lineTimer.current = window.setTimeout(() => setLine(null), 2600)
  }

  if (viewing) {
    return (
      <div className="scr rs" onClick={() => setViewing(false)}>
        <RefStage canvas={L.canvas}>
          <img className="ref-bg" src="ref/restored/station-bg.webp" alt="" />
          <RefLayers layout={L} ids={['scene-remainder']} z={1} />
          <Hit r={{ x: 0, y: 0, w: 1672, h: 941 }} label="UI 다시 표시" onClick={() => setViewing(false)} />
        </RefStage>
      </div>
    )
  }

  const dot = (on: boolean, key: string, g: keyof typeof DELAY) => (on ? null : <TextlessPatch key={key} m={T[key]} z={20} className="rs-in" style={fade(g)} />)

  return (
    <div className="scr rs">
      <RefStage canvas={L.canvas}>
        {/* 조각이 아직 안 보이는 순간 빈 곳은 복원 배경으로 채운다 */}
        <img className="ref-bg" src="ref/restored/station-bg.webp" alt="" />
        <RefLayers layout={L} ids={['scene-remainder']} z={1} className="rs-in" style={fade('scene')} />
        {Object.entries(GROUPS).map(([g, ids]) => <RefLayers key={g} layout={L} ids={ids} z={2} className="rs-in" style={fade(g as keyof typeof DELAY)} />)}

        {/* 동적 값: 원본 값과 다를 때만 글자 없는 패치 + 실제 텍스트 */}
        {W.diamond !== REF.diamond && (
          <TextlessPatch m={T['gems-num']} className="rs-in" style={fade('top')}>
            <span className="abs rs-num" style={{ right: 4, top: 6 }}>{W.diamond}</span>
          </TextlessPatch>
        )}
        {kfmt(W.credit) !== kfmt(REF.credit) && (
          <TextlessPatch m={T['coins-num']} className="rs-in" style={fade('top')}>
            <span className="abs rs-num" style={{ right: 15, top: 6 }}>{kfmt(W.credit)}</span>
          </TextlessPatch>
        )}
        {s.playerLevel !== REF.level && (
          <TextlessPatch m={T['profile-lv']} className="rs-in" style={fade('top')}>
            <span className="abs rs-lv" style={{ left: 4, top: 3 }}><small>Lv.</small>{s.playerLevel}</span>
          </TextlessPatch>
        )}
        {s.playerName !== REF.name && (
          <TextlessPatch m={T['profile-name']} className="rs-in" style={fade('top')}>
            <span className="abs rs-name" style={{ left: 6, top: 3 }}>{s.playerName}</span>
          </TextlessPatch>
        )}
        <TextlessPatch m={T['quest-text']} className="rs-in" style={fade('right')}>
          <span className="abs rs-quest" style={{ left: 8, top: 5 }}>{goal ? <><b>{goal.id}</b> 클리어하기</> : '모든 스토리 클리어'}</span>
        </TextlessPatch>
        <TextlessPatch m={T['attendance-timer']} className="rs-in" style={fade('right')}>
          <span className="abs rs-timer num-tab" style={{ left: 6, top: 3 }}>{untilMidnight(now)}</span>
        </TextlessPatch>

        {/* 알림: 실제 상태가 없으면 원본 표시를 지운다 */}
        {dot(false, 'badge-profile', 'top')}
        {dot(b.notice, 'badge-notice', 'top')}
        {dot(b.mission, 'badge-menu', 'top')}
        {dot(b.event, 'badge-events', 'left')}
        {dot(false, 'badge-training', 'left')}
        {dot(false, 'badge-exploration', 'right')}
        {dot(false, 'badge-story', 'right')}
        {dot(false, 'badge-formation', 'bottom')}
        {dot(false, 'badge-recruitment', 'bottom')}
        {/* 우편은 원본에 표시가 없어, 공지의 원본 점 그림을 같은 크기로 재사용 */}
        {b.mail && <img className="ref-layer rs-in" src={T['badge-notice'].sprite} alt="" style={{ left: 1532, top: 19, width: T['badge-notice'].w, height: T['badge-notice'].h, zIndex: 21, ...fade('top') }} />}

        {/* 로비 테마 전환(원본에 없는 추가 버튼, 얼굴·카드와 겹치지 않는 상단 빈 영역) */}
        <div className="rs-theme rs-in" style={{ left: 1268, top: 22, width: 126, height: 50, ...fade('top') }} aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 11a8 8 0 0 1 16 0v5H4z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M2 16h20M7 16v3M17 16v3" stroke="currentColor" strokeWidth="2" /></svg>
          <span>카페 로비</span>
        </div>
        <Hit r={{ x: 1268, y: 22, w: 126, h: 50 }} label="로비 테마 변경: 카페(소파) 로비로" sfx="none" onClick={() => { audio.sfx('swap'); onTheme() }} />

        {line && (
          <div className="rs-line" role="status"><b>{lobbyChar.name}</b>{line}</div>
        )}

        {/* 조작 영역. 겹치는 카드는 실제 앞뒤 순서대로: 현상수배 > 훈련 > 상점, 스토리 > 도시 탐색 */}
        <Hit r={{ x: 470, y: 110, w: 520, h: 680 }} z={40} sfx="none" label={`${lobbyChar.name}에게 말 걸기`} onClick={talk} className="rs-char" />
        <Hit r={rectOf(L, 'profile')} label={`프로필: ${s.playerName}, 레벨 ${s.playerLevel}`} onClick={() => go('profile')} />
        <Hit r={rectOf(L, 'currency-gems')} label={`다이아 ${W.diamond}, 충전`} onClick={() => go('shop', { tab: 'currency' })} />
        <Hit r={rectOf(L, 'currency-coins')} label={`크레딧 ${W.credit.toLocaleString()}, 자세히`} onClick={() => setPop('coins')} />
        <Hit r={rectOf(L, 'notice')} label={`공지${b.notice ? ', 읽지 않은 공지 있음' : ''}`} onClick={() => go('notices')} />
        <Hit r={rectOf(L, 'mail')} label={`우편${b.mail ? ', 받을 보상 있음' : ''}`} onClick={() => go('mail')} />
        <Hit r={rectOf(L, 'menu')} label="전체 메뉴" onClick={() => setPop((p) => (p === 'menu' ? null : 'menu'))} />
        <Hit r={rectOf(L, 'pickup')} label={`픽업 영입${pickup ? `: ${pickup.title}` : ''}`} onClick={() => go('recruit', { bannerId: pickup?.id })} className="st-card" />
        <Hit r={rectOf(L, 'quest')} label={goal ? `메인 목표: ${goal.id} 클리어하기` : '메인 목표 없음'} onClick={() => go('story', { stageId: goal?.id })} className="st-card" />
        <Hit r={rectOf(L, 'attendance')} label={`출석 이벤트${b.attendance ? ', 오늘 보상 받기 가능' : ''}`} onClick={() => go('attendance')} className="st-card" />
        <Hit r={rectOf(L, 'messages')} label="메시지" onClick={() => setPop('messages')} />
        <Hit r={rectOf(L, 'events')} label={`이벤트${b.event ? ', 새 이벤트 있음' : ''}`} onClick={() => go('events')} />
        <Hit r={rectOf(L, 'coupon')} label="쿠폰 이벤트" onClick={() => { setCoupon(''); setCouponMsg(''); setPop('coupon') }} />
        <Hit r={rectOf(L, 'costume')} label="코스튬" onClick={() => setPop('costume')} />
        <Hit r={rectOf(L, 'arena')} label="아레나" onClick={() => go('arena')} />
        <Hit r={rectOf(L, 'raid')} label="레이드" onClick={() => go('raid')} />
        <Hit r={rectOf(L, 'wanted')} z={53} label="현상수배" onClick={() => go('wanted')} className="st-card" />
        <Hit r={{ x: 125, y: 638, w: 284, h: 62 }} z={51} label="상점" onClick={() => go('shop')} className="st-card" />
        <Hit r={{ x: 47, y: 705, w: 391, h: 207 }} z={52} label="훈련" onClick={() => go('training')} className="st-card" />
        <Hit r={{ x: 1238, y: 502, w: 396, h: 163 }} label="도시 탐색" onClick={() => go('explore')} className="st-card" />
        <Hit r={{ x: 1195, y: 665, w: 440, h: 233 }} z={51} label="스토리" onClick={() => go('story')} className="st-card" />
        <Hit r={rectOf(L, 'characters')} label="캐릭터" onClick={() => go('characters')} />
        <Hit r={rectOf(L, 'formation')} label="편성" onClick={() => go('formation')} />
        <Hit r={rectOf(L, 'home')} label="홈 (현재 로비)" onClick={() => setPop(null)} />
        <Hit r={rectOf(L, 'bag')} label="가방" onClick={() => go('bag')} />
        <Hit r={rectOf(L, 'recruitment')} label="영입" onClick={() => go('recruit')} />

        {pop === 'menu' && (
          <div className="rl-more rs-menu" style={{ left: 1196, top: 90 }} onClick={(e) => e.stopPropagation()}>
            {([
              ['미션', 'missions', b.mission], ['출석', 'attendance', b.attendance], ['우편함', 'mail', b.mail], ['공지', 'notices', b.notice],
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

