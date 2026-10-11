import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/lobby.css'
import { useNav, type ScreenName } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame, badges } from '../game/store'
import { CHAR_BY_ID, CHARACTERS } from '../game/data/characters'
import { EVENTS, STORY_CHAPTERS, WANTED } from '../game/data/catalog'
import { MOTION, ROLE_LABEL } from '../game/config'
import { CurrencyChip, Dot, Modal, Btn } from '../ui/components'
import {
  IconMail, IconBell, IconGear, IconList, IconEye, IconEyeOff, IconUsers, IconPerson, IconBag, IconCart, IconSpark, IconSwap,
  IconBook, IconMap, IconTarget, IconDumbbell, IconSwords, IconSkull, IconCalendar, RoleGlyph,
} from '../ui/icons'

const CONTENTS: { id: ScreenName; name: string; en: string; bg: string; icon: JSX.Element }[] = [
  { id: 'story', name: '스토리', en: 'STORY', bg: 'assets/bg/story.webp', icon: <IconBook size="2.2rem" /> },
  { id: 'explore', name: '도시 탐색', en: 'CITY', bg: 'assets/bg/map.webp', icon: <IconMap size="2.2rem" /> },
  { id: 'wanted', name: '현상수배', en: 'WANTED', bg: 'assets/bg/wanted.webp', icon: <IconTarget size="2.2rem" /> },
  { id: 'training', name: '훈련', en: 'TRAINING', bg: 'assets/bg/training.webp', icon: <IconDumbbell size="2.2rem" /> },
  { id: 'arena', name: '아레나', en: 'ARENA', bg: 'assets/bg/arena.webp', icon: <IconSwords size="2.2rem" /> },
  { id: 'raid', name: '레이드', en: 'RAID', bg: 'assets/bg/raid.webp', icon: <IconSkull size="2.2rem" /> },
]

export default function Lobby({ params }: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const b = badges(s)
  const charId = s.lobby.characterId
  const c = CHAR_BY_ID[charId]
  const [hidden, setHidden] = useState(false)
  const [picker, setPicker] = useState(false)
  const [bubble, setBubble] = useState(0)
  const [eventIdx, setEventIdx] = useState(0)
  // 첫 진입·대표 캐릭터 변경 시에만 긴 등장 연출, 메뉴 복귀는 짧게
  const initialMode = useRef<'entrance' | 'return'>(params.first || s.lobby.lastEntranceFor !== charId ? 'entrance' : 'return')
  const [mode, setMode] = useState<{ kind: 'entrance' | 'return'; key: number }>({ kind: initialMode.current, key: 0 })
  const lastChar = useRef(charId)

  useEffect(() => { audio.bgm('lobby') }, [])

  useEffect(() => {
    if (lastChar.current !== charId) { lastChar.current = charId; setMode((m) => ({ kind: 'entrance', key: m.key + 1 })) }
  }, [charId])

  useEffect(() => {
    if (mode.kind !== 'entrance') return
    audio.sfx(c.lobby.entrance === 'slash' ? 'slash' : 'whoosh')
    const t = setTimeout(() => game.markLobbyEntrance(charId), MOTION.entrance)
    return () => clearTimeout(t)
  }, [mode, charId, c.lobby.entrance])

  useEffect(() => {
    const t = setInterval(() => setEventIdx((i) => (i + 1) % EVENTS.length), 5000)
    return () => clearInterval(t)
  }, [])

  const go = (name: ScreenName, p?: Record<string, unknown>) => { audio.sfx('tap'); nav.push(name, p) }
  const ev = EVENTS[eventIdx]

  const storyNext = useMemo(() => {
    for (const ch of STORY_CHAPTERS) for (const st of ch.stages) if (!s.content.storyCleared.includes(st.id)) return st.id
    return '완료'
  }, [s.content.storyCleared])
  const contentStatus: Record<string, string> = {
    story: `다음 ${storyNext}`,
    explore: '사건 5건',
    wanted: `수배 ${WANTED.length - s.content.wantedCleared.length}명`,
    training: '재료 획득',
    arena: `${s.content.arenaPoints}점`,
    raid: '보스 출현',
  }

  return (
    <div className={`lb ${hidden ? 'lb-hidden' : ''}`} onClick={hidden ? () => { audio.sfx('tap'); setHidden(false) } : undefined}>
      <LobbyScene charId={charId} mode={mode} bubble={bubble} viewing={hidden} onTap={() => { if (hidden) { setHidden(false); return } audio.sfx('select'); setBubble((n) => n + 1) }} />
      {hidden && <button className="lb-show-ui" aria-label="UI 표시"><IconEye size="2.4rem" />UI 표시</button>}
      {!hidden && <>

      {/* 상단 */}
      <header className="lb-top">
        <button className="lb-profile" onClick={() => go('profile')} aria-label="프로필">
          <img src={c.assets.portrait} alt="" />
          <span className="lb-profile-text">
            <strong>{s.playerName}</strong>
            <span className="num">Lv.{s.playerLevel}</span>
            <i className="lb-exp"><b style={{ width: '62%' }} /></i>
          </span>
        </button>
        <div className="lb-top-right">
          <CurrencyChip id="stamina" onAdd={() => nav.push('shop', { tab: 'currency' })} />
          <CurrencyChip id="credit" />
          <CurrencyChip id="diamond" onAdd={() => nav.push('shop', { tab: 'currency' })} />
          <div className="lb-icons">
            <button onClick={() => go('mail')} aria-label="우편함"><IconMail size="2.4rem" /><Dot show={b.mail} /></button>
            <button onClick={() => go('missions')} aria-label="미션"><IconList size="2.4rem" /><Dot show={b.mission} /></button>
            <button onClick={() => go('notices')} aria-label="공지"><IconBell size="2.4rem" /><Dot show={b.notice} /></button>
            <button onClick={() => go('settings')} aria-label="설정"><IconGear size="2.4rem" /></button>
          </div>
        </div>
      </header>

      {/* 왼쪽: 이벤트 배너 · 출석 · 감상/변경 */}
      <aside className="lb-left">
        <button className="lb-event" onClick={() => go('events', { focus: ev.id })} style={{ ['--a' as string]: ev.accent }} aria-label={`이벤트 ${ev.title}`}>
          <img src={ev.image} alt="" key={ev.id} />
          <span className="lb-event-text">
            <small>EVENT · {ev.period}</small>
            <strong>{ev.title}</strong>
          </span>
          <span className="lb-event-dots">{EVENTS.map((e, i) => <i key={e.id} className={i === eventIdx ? 'on' : ''} />)}</span>
          <Dot show={b.event} />
        </button>
        <div className="lb-left-row">
          <button className="lb-mini" onClick={() => go('attendance')}><IconCalendar size="2.2rem" />출석<Dot show={b.attendance} /></button>
          <button className="lb-mini" onClick={() => go('events')}><IconSpark size="2.2rem" />이벤트</button>
        </div>
        <div className="lb-left-row">
          <button className="lb-mini" onClick={() => { audio.sfx('tap'); setPicker(true) }}><IconSwap size="2.2rem" />대표 변경</button>
          <button className="lb-mini" onClick={() => { audio.sfx('tap'); setHidden(true) }}><IconEyeOff size="2.2rem" />감상 모드</button>
        </div>
      </aside>

      {/* 오른쪽: 여섯 플레이 콘텐츠 */}
      <nav className="lb-contents" aria-label="플레이 콘텐츠">
        {CONTENTS.map((ct, i) => (
          <button key={ct.id} className={`lb-ct lb-ct-${ct.id}`} onClick={() => go(ct.id)} style={{ animationDelay: `${120 + i * 50}ms` }}>
            <img src={ct.bg} alt="" loading="lazy" />
            <span className="lb-ct-shade" />
            <span className="lb-ct-icon">{ct.icon}</span>
            <span className="lb-ct-text">
              <small>{ct.en}</small>
              <strong>{ct.name}</strong>
            </span>
            <span className="lb-ct-status">{contentStatus[ct.id]}</span>
          </button>
        ))}
      </nav>

      {/* 하단: 관리 메뉴 */}
      <nav className="lb-manage" aria-label="관리 메뉴">
        {[
          { id: 'characters' as const, label: '캐릭터', icon: <IconPerson size="2.8rem" /> },
          { id: 'formation' as const, label: '편성', icon: <IconUsers size="2.8rem" /> },
          { id: 'bag' as const, label: '가방', icon: <IconBag size="2.8rem" /> },
          { id: 'recruit' as const, label: '영입', icon: <IconSpark size="2.8rem" />, accent: true },
          { id: 'shop' as const, label: '상점', icon: <IconCart size="2.8rem" /> },
        ].map((m) => (
          <button key={m.id} className={`lb-m ${m.accent ? 'accent' : ''}`} onClick={() => go(m.id)}>
            {m.icon}<span>{m.label}</span>
          </button>
        ))}
      </nav>

      </>}
      {picker && (
        <Modal className="lb-picker" onClose={() => setPicker(false)} labelledBy="pick-title">
          <h2 id="pick-title">대표 캐릭터 선택</h2>
          <p className="lb-picker-note">로비에 전시할 캐릭터입니다. 팀 리더와는 따로 저장됩니다.</p>
          <div className="lb-picker-grid">
            {CHARACTERS.filter((x) => s.owned[x.id]).map((x) => (
              <button key={x.id} className={x.id === charId ? 'on' : ''} onClick={async () => { audio.sfx('select'); await game.setLobbyCharacter(x.id); setPicker(false) }}>
                <img src={x.assets.portrait} alt="" />
                <span><RoleGlyph role={x.role} size="1.4rem" /> {x.name}</span>
              </button>
            ))}
          </div>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setPicker(false)}>닫기</Btn></div>
        </Modal>
      )}
    </div>
  )
}

function LobbyScene({ charId, mode, onTap, bubble, viewing }: { charId: string; mode: { kind: 'entrance' | 'return'; key: number }; onTap: () => void; bubble: number; viewing?: boolean }) {
  const c = CHAR_BY_ID[charId]
  return (
    <div className={`lb-scene ${viewing ? 'viewing' : ''}`}>
      <img className="lb-bg" src="assets/bg/lobby.webp" alt="" />
      <div className="lb-bg-shade" />
      <div className={`lb-char ${mode.kind}`} key={`${charId}-${mode.key}-${mode.kind}`} style={{ ['--a' as string]: c.accent, ['--seed' as string]: c.idleSeed }}>
        {mode.kind === 'entrance' && (
          <>
            <div className={`fx fx-${c.lobby.entrance}`} aria-hidden><i /><i /><i /><i /><i /><i /></div>
            <img className="lb-action" src={c.assets.action} alt="" />
          </>
        )}
        <button className="lb-stand" onClick={(e) => { e.stopPropagation(); onTap() }} aria-label={`${c.name}`}>
          <img src={c.assets.stand} alt="" className={`idle-${c.lobby.idle}`} />
        </button>
        {bubble > 0 && !viewing && (
          <div className="lb-bubble" key={bubble}>
            <small>{c.name} · {ROLE_LABEL[c.role]}</small>
            {c.tagline}
          </div>
        )}
      </div>
    </div>
  )
}
