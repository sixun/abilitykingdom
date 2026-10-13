import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import '../styles/charlist.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame, charPower } from '../game/store'
import { CHARACTERS } from '../game/data/characters'
import type { CharacterDefinition } from '../game/types'
import { MotionStage, MotionTitle } from '../ui/ui-motion'
import { useReduceMotion } from '../ui/motion'

// 캐릭터 목록(시안: CHARACTERS 그리드). 캔버스 1672×941 고정 배율, 라이트/다크, 정렬, 왼쪽 필터(전체·즐겨찾기·미보유·Ex).
// 움직임: 진입(헤더·사이드바·카드 대각선 순차), 정렬·필터 변경 시 카드가 새 자리로 미끄러짐(FLIP),
//         호버 들어올림·반짝임, 누르면 눌림 → 카드가 커지며 상세로 이동, 대기 중 반짝임 파도.
//         지안·리온은 대기 모션 영상이 있어 카드에 마우스를 올리면 실제로 움직인다(알파 영상 미지원 환경은 그림 유지).
type Filter = 'all' | 'fav' | 'locked' | 'ex'
type Sort = 'rarity' | 'level' | 'power' | 'name'
const SORTS: { id: Sort; label: string }[] = [{ id: 'rarity', label: '등급순' }, { id: 'level', label: '레벨순' }, { id: 'power', label: '전투력순' }, { id: 'name', label: '이름순' }]
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: '전체' }, { id: 'fav', label: '즐겨찾기' }, { id: 'locked', label: '미보유' }, { id: 'ex', label: 'Ex' }]
const COLS = 8
const MAX_STARS = 5

// 카드 안 대기 모션(알파 WebM, 1080×1080): 얼굴 근처를 카드 그림 칸(146×178)에 맞춘 배치
const CARD_MOTION: Record<string, { src: string; s: number; x: number; y: number }> = {
  jian: { src: 'motion/detail.webm', s: 0.487, x: -195, y: -47 },
  rion: { src: 'motion/recruit.webm', s: 0.521, x: -172, y: 0 },
}
const ALPHA_OK = (() => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return false
  if (/^((?!chrome|chromium|crios|android|edg).)*safari/i.test(ua)) return false
  return document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== ''
})()

export default function Characters(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const reduce = useReduceMotion()
  const theme = s.settings.charListTheme ?? 'light'
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('rarity')
  const [sortOpen, setSortOpen] = useState(false)
  const [launch, setLaunch] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [burst, setBurst] = useState<string | null>(null)
  const favs = useMemo(() => new Set(s.favorites ?? []), [s.favorites])

  const list = useMemo(() => {
    let l: CharacterDefinition[] = CHARACTERS
    if (filter === 'fav') l = l.filter((c) => favs.has(c.id))
    if (filter === 'locked') l = l.filter((c) => !s.owned[c.id])
    if (filter === 'ex') l = l.filter((c) => c.ex)
    const lv = (c: CharacterDefinition) => s.owned[c.id]?.level ?? 0
    return [...l].sort((a, b) => {
      if (!!a.pending !== !!b.pending) return a.pending ? 1 : -1 // 설정 미정(신규)은 항상 뒤
      const oa = !!s.owned[a.id], ob = !!s.owned[b.id]
      if (sort === 'rarity') return b.rarity - a.rarity || (oa !== ob ? (oa ? -1 : 1) : 0) || lv(b) - lv(a)
      if (oa !== ob) return oa ? -1 : 1
      if (sort === 'level') return lv(b) - lv(a) || b.rarity - a.rarity
      if (sort === 'power') return charPower(s, b.id) - charPower(s, a.id)
      return a.name.localeCompare(b.name, 'ko')
    })
  }, [filter, sort, s, favs])

  // FLIP: 정렬·필터가 바뀌면 남아 있는 카드는 예전 자리에서 새 자리로 미끄러진다(오프셋은 캔버스 좌표라 배율과 무관)
  const cells = useRef(new Map<string, HTMLDivElement>())
  const prev = useRef(new Map<string, { x: number; y: number }>())
  const first = useRef(true)
  useLayoutEffect(() => {
    const now = new Map<string, { x: number; y: number }>()
    cells.current.forEach((el, id) => { if (el.isConnected) now.set(id, { x: el.offsetLeft, y: el.offsetTop }) })
    if (!first.current && !reduce) {
      now.forEach((p, id) => {
        const o = prev.current.get(id); const el = cells.current.get(id)
        if (!o || !el || (o.x === p.x && o.y === p.y)) return
        el.style.transition = 'none'
        el.style.translate = `${o.x - p.x}px ${o.y - p.y}px`
        void el.offsetWidth
        el.style.transition = 'translate 520ms cubic-bezier(.16, 1, .3, 1)'
        el.style.translate = '0px 0px'
      })
    }
    prev.current = now
    first.current = false
  }, [list, reduce])

  const open = (c: CharacterDefinition) => {
    if (launch) return
    audio.sfx('select')
    setLaunch(c.id)
    window.setTimeout(() => nav.push('characterDetail', { id: c.id }), reduce ? 0 : 260)
  }
  const toggleFav = (id: string) => {
    audio.sfx('tap'); game.toggleFavorite(id)
    setBurst(id); window.setTimeout(() => setBurst((b) => (b === id ? null : b)), 700)
  }
  const setTheme = (t: 'light' | 'dark') => { if (t !== theme) { audio.sfx('swap'); game.updateSettings({ charListTheme: t }) } }
  const fIdx = FILTERS.findIndex((f) => f.id === filter)

  return (
    <div className="scr chars">
      <MotionStage canvas={{ width: 1672, height: 941 }} className={`ui-clist cl-${theme}`}>
        <div className="cl-bg" aria-hidden><i className="b1" /><i className="b2" /><i className="b3" /></div>
        {/* 테마 바꿀 때 토글 자리에서 퍼지는 원 */}
        <div className="cl-theme-wave" key={theme} aria-hidden />

        <header className="cl-head">
          <button type="button" className="cl-back" aria-label="뒤로" onClick={() => { audio.sfx('tap'); nav.back() }}>
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <i className="cl-vbar" aria-hidden style={{ left: 160 }} />
          <h1 className="cl-title"><MotionTitle text="CHARACTERS" /></h1>

          <div className="cl-theme" role="group" aria-label="목록 테마">
            <i className="pill" aria-hidden style={{ left: theme === 'light' ? 0 : 144 }} />
            <button type="button" className={theme === 'light' ? 'on' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
              <svg className="sun" viewBox="0 0 24 24" width="30" height="30" aria-hidden><circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth="2" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M12 2.2v2.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" transform={`rotate(${a} 12 12)`} />)}</svg>
              <span>LIGHT</span>
            </button>
            <button type="button" className={theme === 'dark' ? 'on' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
              <svg className="moon" viewBox="0 0 24 24" width="28" height="28" aria-hidden><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor" /></svg>
              <span>DARK</span>
            </button>
          </div>
          <i className="cl-vbar" aria-hidden style={{ left: 1413 }} />
          <div className="cl-sort">
            <button type="button" className="cl-sort-btn" aria-haspopup="listbox" aria-expanded={sortOpen} aria-label={`정렬: ${SORTS.find((x) => x.id === sort)?.label}`} onClick={() => { audio.sfx('tap'); setSortOpen((v) => !v) }}>
              <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden><path d="M3 6h18M3 12h12M3 18h7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              <span key={sort} className="lbl">{SORTS.find((x) => x.id === sort)?.label}</span>
              <svg className="chev" viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {sortOpen && (
              <div className="cl-sort-menu" role="listbox" aria-label="정렬 기준">
                {SORTS.map((o, i) => (
                  <button type="button" role="option" aria-selected={o.id === sort} key={o.id} className={o.id === sort ? 'on' : ''} style={{ animationDelay: `${i * 30}ms` }}
                    onClick={() => { audio.sfx('select'); setSort(o.id); setSortOpen(false) }}>{o.label}</button>
                ))}
              </div>
            )}
          </div>
        </header>

        <nav className="cl-side" aria-label="캐릭터 필터">
          <i className="cl-side-hl" aria-hidden style={{ top: 30 + fIdx * 86 }} />
          {FILTERS.map((f, i) => (
            <button type="button" key={f.id} className={`cl-side-item ${f.id === filter ? 'on' : ''}`} style={{ top: 30 + i * 86, animationDelay: `${300 + i * 70}ms` }}
              aria-pressed={f.id === filter} onClick={() => { if (f.id !== filter) { audio.sfx('select'); setFilter(f.id) } }}>
              <span className="ic">{f.id === 'all' ? <IcGrid /> : f.id === 'fav' ? <IcHeart filled={false} /> : f.id === 'locked' ? <IcLock /> : <IcEx />}</span>
              <span className="tx">{f.label}</span>
            </button>
          ))}
        </nav>

        <div className="cl-grid" role="list" onClick={() => setSortOpen(false)}>
          {list.length === 0 && (
            <div className="cl-empty" role="status">
              <b>{filter === 'fav' ? '즐겨찾기한 캐릭터가 없습니다' : filter === 'ex' ? 'Ex 캐릭터가 아직 없습니다' : '미보유 캐릭터가 없습니다'}</b>
              <span>{filter === 'fav' ? '카드 오른쪽 위 하트를 눌러 추가하세요.' : filter === 'ex' ? 'Ex 체계가 정해지면 여기에 표시됩니다.' : '모든 캐릭터를 보유하고 있습니다.'}</span>
            </div>
          )}
          {list.map((c, i) => {
            const o = s.owned[c.id]
            const fav = favs.has(c.id)
            const mv = CARD_MOTION[c.id]
            const playing = !!mv && ALPHA_OK && !reduce && hover === c.id
            const row = Math.floor(i / COLS), col = i % COLS
            return (
              <div key={c.id} role="listitem" className={`cl-cell ${launch === c.id ? 'launch' : ''} ${launch && launch !== c.id ? 'dim' : ''}`}
                ref={(el) => { if (el) cells.current.set(c.id, el); else cells.current.delete(c.id) }}
                style={{ '--d': `${(first.current ? 380 : 40) + (row + col) * (first.current ? 55 : 22)}ms`, '--i': row + col, '--a': c.accent } as CSSProperties}
                onPointerEnter={() => setHover(c.id)} onPointerLeave={() => setHover((h) => (h === c.id ? null : h))}>
                <button type="button" className={`ccard ${o ? '' : 'unowned'} ${c.pending ? 'pending' : ''}`} onClick={() => open(c)}
                  aria-label={`${c.name}${c.pending ? ', 신규 · 설정 미정' : ''}${o ? `, 레벨 ${o.level}` : ', 미보유'}${fav ? ', 즐겨찾기' : ''}`}>
                  <span className="art">
                    <img src={c.assets.portrait} alt="" loading="lazy" draggable={false} />
                    {playing && <video className="mv-card" src={mv.src} muted loop autoPlay playsInline aria-hidden style={{ width: 1080 * mv.s, height: 1080 * mv.s, left: mv.x, top: mv.y }} />}
                    <i className="shine" aria-hidden />
                    {c.ex && <b className="ex" aria-hidden>Ex</b>}
                    {c.pending && <b className="new" aria-hidden>NEW</b>}
                    {o ? <em className="lv">Lv.{o.level}</em> : <em className="lock" aria-hidden><IcLock /></em>}
                  </span>
                  <strong className={`nm ${c.name.length > 7 ? 'long' : ''}`}>{c.name}</strong>
                  {c.pending
                    ? <span className="tbd">신규 · 획득 불가</span>
                    : <span className="stars" aria-hidden>{Array.from({ length: MAX_STARS }, (_, k) => <i key={k} className={k < c.rarity ? 'on' : ''} style={{ '--k': k } as CSSProperties}>★</i>)}</span>}
                </button>
                <button type="button" className={`cl-fav ${fav ? 'on' : ''} ${burst === c.id ? 'burst' : ''}`} aria-pressed={fav} aria-label={`${c.name} 즐겨찾기${fav ? ' 해제' : ''}`} onClick={() => toggleFav(c.id)}>
                  <IcHeart filled={fav} />
                </button>
              </div>
            )
          })}
        </div>
      </MotionStage>
    </div>
  )
}

function IcGrid() {
  return <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden>{[[3, 3], [13, 3], [3, 13], [13, 13]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="8" height="8" rx="2" fill="currentColor" />)}</svg>
}
function IcHeart({ filled }: { filled: boolean }) {
  return <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.5 4 4.5 7.3 4.5c2 0 3.5 1.1 4.7 2.8 1.2-1.7 2.7-2.8 4.7-2.8 3.3 0 5.7 3 4.5 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /></svg>
}
function IcLock() {
  return <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden><rect x="5" y="10.5" width="14" height="10.5" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.9" /><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" fill="none" stroke="currentColor" strokeWidth="1.9" /><circle cx="12" cy="15.3" r="1.4" fill="currentColor" /></svg>
}
function IcEx() {
  return <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden><rect x="2.5" y="2.5" width="19" height="19" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" /><text x="12" y="16.4" textAnchor="middle" fontSize="11" fontStyle="italic" fontWeight="700" fill="currentColor" fontFamily="Inter, sans-serif">Ex</text></svg>
}
