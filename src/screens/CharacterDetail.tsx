import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/screens.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import { CHARACTERS, CHAR_BY_ID } from '../game/data/characters'
import { ITEMS, ITEM_BY_ID } from '../game/data/catalog'
import { GAME_CONFIG } from '../game/config'
import { statsOf, RULES_ARE_PROVISIONAL } from '../game/rules'
import type { EquipmentSlots, OwnedCharacter } from '../game/types'
import { fmt, Btn, useAction, ErrorBanner, Modal, ProvisionalTag } from '../ui/components'
import { RoleGlyph, ItemGlyph, IconPlus, IconChevron } from '../ui/icons'
import { RefLayers, Hit, TextlessPatch, rectOf, type RefLayout, type TextlessMeta } from '../ui/ref'
import layoutJson from '../game/data/ref-detail.json'
import textless from '../game/data/ref-textless.json'
import artJson from '../game/data/ref-detail-art.json'
import fillJson from '../game/data/detail-fill.json'
import { LOBBY_SCENES } from '../game/data/lobbyScenes'
import fitJson from '../game/data/motion-fit.json'
import { MotionVideo } from '../ui/motion'
import '../styles/motion.css'
import { MotionStage as RefStage, MotionTitle, MotionTicker, AmbientFx, Fx, Glint, glintOf } from '../ui/ui-motion'

// 캐릭터 상세 원본(지안, 1672×941)을 원본 조각 29개로 재현.
// - 능력치 조각은 유지하고, 이름·배경 타이포·탭은 실제 텍스트/그래픽으로 연출한다.
// - 다른 캐릭터는 원본 상세 일러스트가 없어 왼쪽 인물 영역을 임시 아트로 대체한다(화면에 표시).
// - 표기는 원본대로 영문. SKILLS/GEAR는 확정 시안이 없어 오른쪽 능력치 칸만 기존 기능 목록으로 바꾼다.
const L = layoutJson as RefLayout
const T = textless.detail as Record<string, TextlessMeta>
const ART = artJson as Record<string, { src: string; kind: string; w: number; h: number; top: number; bodyH: number; headX: number; heroH?: number }>
const REF = { id: 'jian', level: 40, hp: 18600, atk: 3240, def: 1280, critRate: 22.5, critDmg: 150, speed: 108, role: 'attack' }
const ROLE_EN: Record<string, string> = { attack: 'ATTACK', defense: 'DEFENSE', ability: 'ABILITY', support: 'SUPPORT' }
const ROLE_DESC: Record<string, string> = {
  attack: '적에게 큰 피해를 주는 역할입니다.', defense: '피해를 대신 받고 아군을 지키는 역할입니다.',
  ability: '범위 효과와 상태 변화로 전황을 바꾸는 역할입니다.', support: '회복과 강화로 아군을 돕는 역할입니다.',
}
const SLOT_LABEL: Record<keyof EquipmentSlots, string> = { weapon: 'WEAPON', gear: 'GEAR', accessory: 'ACCESSORY' }
const LOBBY_ART = new Set(['jian', ...Object.keys(LOBBY_SCENES)]) // 로비 장면 그림이 있는 캐릭터
const VISIBLE = 6
// 상단 목록 칸(원본 초상 위치). 0번은 원본에서 선택 표시가 그려진 칸
const SLOT_CX = [949, 1073, 1197, 1321, 1445, 1569]
type Tab = 'stats' | 'skills' | 'gear'
type StatKey = 'hp' | 'atk' | 'def' | 'critDmg' | 'critRate' | 'speed'
const STAT_ROWS: { key: StatKey; patch: string; right: number }[] = [
  { key: 'hp', patch: 'stat-hp', right: 17 },
  { key: 'atk', patch: 'stat-atk', right: 20 },
  { key: 'def', patch: 'stat-def', right: 17 },
  { key: 'critDmg', patch: 'stat-crit-dmg', right: 20 },
  { key: 'critRate', patch: 'stat-crit-rate', right: 17 },
  { key: 'speed', patch: 'stat-speed', right: 20 },
]
const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`
const blank = (id: string): OwnedCharacter => ({ id, level: 1, obtainedAt: 0, dupes: 0, equipment: { weapon: null, gear: null, accessory: null } })
const STAT_LAYERS = ['stat-hp', 'stat-atk', 'stat-def', 'stat-crit-dmg', 'stat-crit-rate', 'stat-speed']
const TAB_X: Record<'stats' | 'skills' | 'gear', [number, number]> = { stats: [0, 241], skills: [241, 223], gear: [464, 229] }
const FIT = fitJson as unknown as Record<string, { s: number; x: number; y: number }>
// 오른쪽 배경판은 유지. 왼쪽 타이포/사선은 DetailBackdrop에서 독립적으로 그린다.
const PLATE: Record<string, string> = { 'background-remainder': 'ref/detail/motion/background-remainder-plate.webp' }
const FILL = fillJson as Record<string, { x: number; y: number; w: number; h: number; file: string }>
// 영상 좌표 기준 잘라내기: 왼쪽 인물 영역(오른쪽 아래 머리카락 번짐 포함)만 보이게
const HERO_CLIP = `polygon(0 0, ${914 - 13.9}px 0, ${914 - 13.9}px ${640 - 7.2}px, ${990 - 13.9}px ${640 - 7.2}px, ${990 - 13.9}px 100%, 0 100%)`
const kindEn = (k: string) => (k === '기본' ? 'BASIC' : k === '스킬' ? 'SKILL' : k === '궁극기' ? 'ULT' : 'PASSIVE')

export default function CharacterDetail({ params }: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const roster = useMemo(() => [...CHARACTERS.filter((c) => s.owned[c.id]), ...CHARACTERS.filter((c) => !s.owned[c.id])].map((c) => c.id), [s.owned])
  const [id, setId] = useState((params.id as string) ?? 'jian')
  const [offset, setOffset] = useState(() => Math.max(0, Math.min(roster.indexOf((params.id as string) ?? 'jian') - VISIBLE + 1, roster.length - VISIBLE)))
  const [tab, setTab] = useState<Tab>('stats')
  const [pop, setPop] = useState<null | 'growth' | 'role' | 'profile' | 'faction'>(null)
  const [skillPick, setSkillPick] = useState<number | null>(null)
  const [slotPick, setSlotPick] = useState<keyof EquipmentSlots | null>(null)
  const [levels, setLevels] = useState(1)
  const [flash, setFlash] = useState(false) // 성장 성공 직후 수치 강조
  const [toast, setToast] = useState<string | null>(null)
  const [introDone, setIntroDone] = useState(false)
  useEffect(() => { const t = window.setTimeout(() => setIntroDone(true), 2300); return () => window.clearTimeout(t) }, [])
  const timers = useRef<number[]>([])
  const { run, pending, failed, clearFailed } = useAction()
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  const c = CHAR_BY_ID[id]
  const o = s.owned[id]
  const isRef = id === REF.id
  const pend = !!c.pending // 설정 미확정(이름·역할·수치·스킬 미정)
  const base = statsOf(c, o ?? blank(id), ITEM_BY_ID)
  const st: Record<StatKey, number> = { ...base, ...c.subStats }
  const level = o?.level ?? 1
  const maxLv = GAME_CONFIG.maxLevel
  const plan = useMemo(() => (o ? game.planLevelUp(id, levels) : null), [o, id, levels, s])
  const after = o && plan ? statsOf(c, o, ITEM_BY_ID, plan.to) : null
  const isLobby = s.lobby.characterId === id
  const maxOffset = Math.max(0, roster.length - VISIBLE)

  const select = (cid: string) => {
    if (cid === id) return
    audio.sfx('select'); setId(cid); setLevels(1); setSkillPick(null); setSlotPick(null)
  }
  const scroll = (d: number) => { audio.sfx('tap'); setOffset((v) => Math.max(0, Math.min(maxOffset, v + d))) }
  const showToast = (m: string) => { setToast(m); later(() => setToast(null), 1500) }

  const doLevel = async () => {
    const res = await run('lv', (rid) => game.levelUp(id, levels, rid))
    if (res?.ok) {
      audio.sfx('save'); setPop(null); setLevels(1)
      setFlash(true); later(() => setFlash(false), 600)
      showToast(`LV. ${res.value.from} → ${res.value.to}`)
    } else audio.sfx('error')
  }
  const setLobby = async () => {
    const res = await game.setLobbyCharacter(id)
    if (res.ok) { audio.sfx('save'); showToast('LOBBY ACTIVE') } else { audio.sfx('error'); showToast('저장 실패 · 기존 로비 캐릭터 유지') }
  }
  const equip = async (slot: keyof EquipmentSlots, itemId: string | null) => {
    const res = await run('eq', () => game.equip(id, slot, itemId))
    if (res?.ok) { audio.sfx('select'); setSlotPick(null) }
  }

  // 원본과 다른 칸만 덮는다
  const hide = new Set<string>()
  // 왼쪽 배경이 코드 그래픽으로 바뀌어, 옛 배경이 들어 있는 뒤로·로비 버튼 조각 대신 같은 모양의 버튼을 그린다
  hide.add('back').add('set-as-lobby')
  if (!isRef) hide.add('hero-artwork')
  // 처음 들어올 때만 능력치가 길게 차례로 등장하고, 탭·캐릭터 전환 때는 바로 보인다
  const statBase = introDone ? 40 : 760
  const visible = roster.slice(offset, offset + VISIBLE)
  const slot0Original = offset === 0 && visible[0] === REF.id && id === REF.id
  const lvPct = Math.round((level / maxLv) * 1000) / 10

  return (
    <div className="scr cd2">
      <RefStage canvas={L.canvas} className="ui-detail">
        {/* 왼쪽 인물
            - 지안: 독립된 타이포 배경 + 대기 영상(배경 제거 알파) + 원본 UI 조각
            - 그 외: 원본 상세 일러스트가 없어 임시 아트(배경 그래픽 + 기존 전신)
            원본 배경 조각에 번진 지안 머리카락 영역(오른쪽 아래)까지 덮고, UI 조각은 그 위에 그린다 */}
        <RefLayers layout={L} ids={['background-remainder']} z={1} files={isRef ? PLATE : undefined} />
        {/* 조각이 늦게 들어오는 동안 비는 자리(목록·UPGRADE 뒤)를 지운 원본 배경으로 채운다 */}
        <img className="ref-layer" src={FILL['bg-fill'].file} alt="" draggable={false} style={{ left: FILL['bg-fill'].x, top: FILL['bg-fill'].y, width: FILL['bg-fill'].w, height: FILL['bg-fill'].h, zIndex: 1 }} />
        <DetailBackdrop key={`backdrop-${id}`} name={c.nameEn} />
        <div className="cdx cdx-hero" key={`hero-${id}`}>
          {isRef
            ? <MotionVideo src="motion/detail.webm" poster="motion/detail-poster.webp" alpha className="char" style={{ left: FIT.detail.x, top: FIT.detail.y, width: 1080 * FIT.detail.s, height: 1080 * FIT.detail.s, clipPath: HERO_CLIP }} />
            : <HeroFallback cid={id} />}
        </div>
        {/* 인물 앞을 지나는 파란 불티 + 위에서 아래로 훑는 스캔선 */}
        <AmbientFx kind="blue" box={{ x: 0, y: 0, w: 990, h: 941 }} count={24} z={1} clip="polygon(0 0, 914px 0, 914px 640px, 990px 640px, 990px 941px, 0 941px)" />
        {/* 패널 안 구멍(레벨·역할·소속 문양·탭 자리)은 패널 색으로 */}
        <div className="cd2-fill" style={{ left: 925, top: 382, width: 692, height: 86 }} />
        <div className="cd2-fill" style={{ left: 1375, top: 158, width: 248, height: 208 }} />
        <div className="cd2-fill" style={{ left: 922, top: 666, width: 701, height: 84 }} />
        <RefLayers layout={L} hide={new Set([...hide, 'hero-artwork', 'background-remainder', 'identity-title', ...STAT_LAYERS])} z={1} />
        {/* 이름·능력치 순차 등장(조각을 띄우는 동안 비는 자리는 패널 색으로 채움) */}
        <div className="cd2-fill" style={{ left: 930, top: 161, width: 445, height: 202 }} />
        <div className="cd2-fill" style={{ left: 926, top: 480, width: 690, height: 164 }} />

        {STAT_LAYERS.map((sl, i) => <div key={`${sl}-${id}-${tab}`} className="cdx cdx-stat" style={{ animationDelay: `${statBase + i * 110}ms` }}><RefLayers layout={L} ids={[sl]} z={1} /><Glint g={glintOf(L, sl)!} order={i} className="ui-glint-row" /></div>)}
        {isRef && <Glint g={glintOf(L, 'faction-emblem')!} order={0} className="ui-glint-emblem" />}
        {(
          <>
            <div className="cd2-pill" style={{ left: 44, top: 20, width: 122, height: 64 }}><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden><path d="M15 4 7 12l8 8" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <div className={`cd2-pill cd2-lobby ${isLobby ? 'on' : ''} ${!o || !LOBBY_ART.has(id) ? 'off' : ''}`} style={{ left: 40, top: 827, width: 268, height: 64 }}>
              <span className="star">★</span><span>{isLobby ? 'LOBBY ACTIVE' : pend ? 'NOT OWNED' : LOBBY_ART.has(id) ? 'SET AS LOBBY' : 'NO LOBBY ART'}</span>
            </div>
          </>
        )}

        {/* 상단 캐릭터 목록 */}
        {!slot0Original && <div className="cd2-slot0-cover" style={{ left: 878, top: 14, width: 143, height: 100 }} />}
        {visible.map((cid, i) => (i === 0 && slot0Original) ? null : (
          <div key={cid} className={`cd2-face ${cid === id ? 'on' : ''} ${s.owned[cid] ? '' : 'locked'}`} style={{ left: SLOT_CX[i] - 56, top: 26 }}>
            <div className="in"><img src={CHAR_BY_ID[cid].assets.portrait} alt="" /></div>
          </div>
        ))}
        {offset === 0 && <div className="cd2-dim" style={{ left: 833, top: 38, width: 46, height: 58, borderRadius: 30 }} />}
        {offset >= maxOffset && <div className="cd2-dim" style={{ left: 1627, top: 36, width: 38, height: 60, borderRadius: 30 }} />}

        {/* 이름·소속·소개 */}
        <TextlessPatch m={T.identity} key={`id-${id}`} className="cdx-name">
          <span className="abs cd2-name" style={{ left: 3, bottom: 85, fontSize: Math.min(124, Math.round(330 / (c.nameEn.length * 0.68))) }}><MotionTitle text={c.nameEn} /><i className="cd2-stripes" /></span>
          <span className="abs cd2-unit" style={{ left: 6, top: 103 }}>{c.en.unit}</span>
          <span className="abs cd2-motto" style={{ left: 7, top: 143 }}>{c.en.motto.split('|').map((l) => <span key={l}>{l}</span>)}</span>
        </TextlessPatch>
        {!isRef && (
          <TextlessPatch m={T.emblem} className="cd2-x">
            <span className="abs cd2-emblem">{pend ? <b className="cd2-tbd">?</b> : <RoleGlyph role={c.role} size={120} />}</span>
          </TextlessPatch>
        )}

        {/* 레벨 */}
        {(!isRef || level !== REF.level || !o) && (
          <TextlessPatch m={T['level-text']} key={`lv-${id}`} className="cdx-lv">
            {o
              ? <span className={`abs cd2-lv ${flash ? 'flash' : ''}`} style={{ left: 13, top: 5 }}><small>Lv.</small><b>{level}</b><em>/ {maxLv}</em></span>
              : <span className="abs cd2-lv" style={{ left: 14, top: 14 }}><small>{pend ? 'PENDING' : 'NOT OWNED'}</small></span>}
            <span className="abs cd2-bar" style={{ left: 12, top: 51 }}><i style={{ width: `${o ? lvPct : 0}%` }} /></span>
          </TextlessPatch>
        )}
        {/* 경험치 막대 위를 주기적으로 지나가는 빛 */}
        {o && <Fx r={{ x: 962, y: 441, w: isRef && level === REF.level ? 160 : Math.round(231 * lvPct / 100), h: 9 }} className="ui-bar-shine" />}
        {/* 역할 */}
        {(c.role !== REF.role || pend) && (
          <TextlessPatch m={T['role-content']} className="cdx-role">
            {!pend && <span className="abs cd2-role-ic"><RoleGlyph role={c.role} size={50} /></span>}
            <span className="abs cd2-role" style={{ left: pend ? 40 : 157, top: 15 }}>{pend ? 'ROLE TBD' : ROLE_EN[c.role]}</span>
          </TextlessPatch>
        )}
        {/* 능력치 */}
        {tab === 'stats' && STAT_ROWS.map((r) => {
          const v = st[r.key]
          if (isRef && v === REF[r.key] && !flash) return null
          const isPct = r.key === 'critRate' || r.key === 'critDmg'
          return (
            <TextlessPatch key={`${r.key}-${id}-${tab}`} m={T[r.patch]} className="cdx-stat" style={{ animationDelay: `${statBase + STAT_LAYERS.indexOf(r.patch) * 110}ms` }}>
              <span className={`abs cd2-val ${isPct ? 'pct' : ''} ${flash ? 'flash' : ''}`} style={{ right: r.right, top: 12 }}>{pend ? '—' : isPct ? pct(v) : v}</span>
            </TextlessPatch>
          )
        })}

        {/* SKILLS / GEAR: 능력치 칸만 바꾼다(확정 시안 없음) */}
        {tab !== 'stats' && (
          <div className="cd2-alt" style={{ left: 926, top: 478, width: 690, height: 168 }} key={`${tab}-${id}`}>
            {tab === 'skills' && pend && (
              <div className="cd2-row cd2-row-tbd"><b className="k">TBD</b><strong>스킬 미정</strong><span>이 캐릭터의 스킬·능력은 아직 정해지지 않았습니다.</span></div>
            )}
            {tab === 'skills' && c.skills.map((sk, i) => (
              <button key={sk.name} type="button" className="cd2-row" aria-label={`스킬 ${sk.name} 자세히`} onClick={() => { audio.sfx('tap'); setSkillPick(i) }}>
                <b className="k">{kindEn(sk.kind)}</b><strong>{sk.name}</strong><span>{sk.desc}</span><IconChevron size={20} />
              </button>
            ))}
            {tab === 'gear' && (Object.keys(SLOT_LABEL) as (keyof EquipmentSlots)[]).map((slot) => {
              const iid = o?.equipment[slot]
              const it = iid ? ITEM_BY_ID[iid] : null
              return (
                <button key={slot} type="button" className="cd2-row" disabled={!o} aria-label={`${SLOT_LABEL[slot]} 장비 ${it ? it.name : '비어 있음'}`} onClick={() => { audio.sfx('tap'); setSlotPick(slot) }}>
                  <b className="k">{SLOT_LABEL[slot]}</b>{it ? <ItemGlyph icon={it.icon} size={26} /> : <IconPlus size={22} />}<strong>{it ? it.name : 'EMPTY'}</strong><span>{it ? it.desc : o ? '눌러서 장착' : '보유한 캐릭터만 장착할 수 있습니다'}</span><IconChevron size={20} />
                </button>
              )
            })}
          </div>
        )}
        {/* 탭 선택 배경은 기존 좌표 위에서 이동한다 */}
        <div className="cd2-tabs" style={{ left: 926, top: 670, width: 693, height: 77 }} aria-hidden>
            <i className="hl" style={{ left: TAB_X[tab][0], width: TAB_X[tab][1] }} />
            {(['stats', 'skills', 'gear'] as Tab[]).map((t) => <span key={t} className={t === tab ? 'on' : ''}>{t.toUpperCase()}</span>)}
        </div>
        {!o && <div className="cd2-dim" style={{ left: 1075, top: 788, width: 562, height: 108, borderRadius: 24 }} />}
        {toast && <div className="cd2-toast" role="status">{toast}</div>}

        {/* 조작 영역 */}
        <Hit r={rectOf(L, 'back')} label="뒤로" onClick={() => nav.back()} />
        <Hit r={rectOf(L, 'roster-prev')} label="목록 앞으로" disabled={offset === 0} sfx="none" onClick={() => scroll(-1)} />
        <Hit r={rectOf(L, 'roster-next')} label="목록 뒤로" disabled={offset >= maxOffset} sfx="none" onClick={() => scroll(1)} />
        {visible.map((cid, i) => (
          <Hit key={cid} r={{ x: SLOT_CX[i] - 62, y: 20, w: 124, h: 86 }} sfx="none" label={`${CHAR_BY_ID[cid].name}${s.owned[cid] ? '' : ' (미보유)'}${cid === id ? ', 선택됨' : ''}`} className="cd2-portrait" onClick={() => select(cid)} />
        ))}
        <Hit r={rectOf(L, 'identity-title')} label={`${c.name} 프로필`} onClick={() => setPop('profile')} />
        <Hit r={rectOf(L, 'faction-emblem')} label="소속 정보" onClick={() => setPop('faction')} />
        <Hit r={{ x: 925, y: 383, w: 279, h: 84 }} label={`레벨 ${level} / ${maxLv}, 성장`} disabled={!o} onClick={() => setPop('growth')} />
        <Hit r={rectOf(L, 'level-up-arrow')} label="성장 창 열기" disabled={!o} onClick={() => setPop('growth')} />
        <Hit r={rectOf(L, 'role')} label={pend ? '역할 미정' : `역할 ${ROLE_EN[c.role]}`} onClick={() => setPop('role')} />
        <Hit r={rectOf(L, 'tab-stats')} label={`STATS${tab === 'stats' ? ' (선택됨)' : ''}`} onClick={() => setTab('stats')} />
        <Hit r={rectOf(L, 'tab-skills')} label={`SKILLS${tab === 'skills' ? ' (선택됨)' : ''}`} onClick={() => setTab('skills')} />
        <Hit r={rectOf(L, 'tab-gear')} label={`GEAR${tab === 'gear' ? ' (선택됨)' : ''}`} onClick={() => setTab('gear')} />
        <Hit r={rectOf(L, 'upgrade')} label="UPGRADE (성장)" disabled={!o} onClick={() => setPop('growth')} className="cd2-up" />
        <Hit r={rectOf(L, 'set-as-lobby')} label={isLobby ? 'LOBBY ACTIVE (현재 로비 캐릭터)' : LOBBY_ART.has(id) ? '로비 캐릭터로 설정' : '로비 캐릭터로 설정 (로비 그림 없음)'} disabled={!o || isLobby || !LOBBY_ART.has(id)} onClick={setLobby} />
      </RefStage>

      {pop === 'growth' && o && plan && after && (
        <Modal onClose={() => { setPop(null); clearFailed() }} labelledBy="gr-title" className="cd2-modal">
          <h2 id="gr-title">UPGRADE · {c.nameEn}</h2>
          <div className="cd-growth">
            <div className="cd-lv">
              <span className="num">Lv.{plan.from}</span><IconChevron size="2.4rem" /><strong className="num">Lv.{plan.to}</strong>
              <div className="cd-lv-step" role="group" aria-label="올릴 레벨">
                {[1, 5, 10].map((n) => <button key={n} className={levels === n ? 'on' : ''} onClick={() => { audio.sfx('tap'); setLevels(n) }}>+{n}</button>)}
              </div>
            </div>
            <table className="cd-compare">
              <tbody>
                <tr><th>HP</th><td className="num">{fmt(base.hp)}</td><td className="num up">{fmt(after.hp)}</td></tr>
                <tr><th>ATK</th><td className="num">{fmt(base.atk)}</td><td className="num up">{fmt(after.atk)}</td></tr>
                <tr><th>DEF</th><td className="num">{fmt(base.def)}</td><td className="num up">{fmt(after.def)}</td></tr>
              </tbody>
            </table>
            <div className="cd-mats">
              <h4>필요 재료 {RULES_ARE_PROVISIONAL && <ProvisionalTag>임시 공식</ProvisionalTag>}</h4>
              {(['exp_l', 'exp_m', 'exp_s'] as const).map((mid) => plan.use[mid] > 0 && (
                <div key={mid} className="cd-mat"><ItemGlyph icon="chip" size="2.2rem" /><span>{ITEM_BY_ID[mid].name}</span><b className="num">×{plan.use[mid]}</b><small className="num">보유 {s.inventory.find((x) => x.itemId === mid)?.qty ?? 0}</small></div>
              ))}
              <div className={`cd-mat ${plan.creditShort ? 'short' : ''}`}><span>크레딧</span><b className="num">{fmt(plan.credit)}</b><small className="num">보유 {fmt(s.wallet.credit)}</small></div>
              {plan.expShort > 0 && <div className="cd-mat short"><span>경험치 부족</span><b className="num">{fmt(plan.expShort)}</b><small>훈련에서 획득</small></div>}
            </div>
            <p className="cd2-note">CONFIRM을 누르기 전에는 재료와 크레딧이 차감되지 않습니다.</p>
            {failed && <ErrorBanner error={failed.error} onRetry={doLevel} onClose={clearFailed} />}
          </div>
          <div className="confirm-actions">
            <Btn variant="ghost" onClick={() => { setPop(null); clearFailed() }}>CANCEL</Btn>
            <Btn variant="primary" sfx="none" disabled={!plan.feasible || pending === 'lv'} onClick={doLevel}>{plan.from >= maxLv ? 'MAX LEVEL' : pending === 'lv' ? '처리 중…' : !plan.feasible ? '재료 부족' : 'CONFIRM'}</Btn>
          </div>
        </Modal>
      )}
      {pop === 'role' && (
        <Modal onClose={() => setPop(null)} labelledBy="role-title">
          <h2 id="role-title">{pend ? 'ROLE TBD' : ROLE_EN[c.role]}</h2>
          <p className="rs-pop-note">{pend ? '이 캐릭터의 역할은 아직 정해지지 않았습니다.' : `${ROLE_DESC[c.role]} 역할별 전투 효과는 전투 규칙 확정 후 정합니다.`}</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setPop(null)}>닫기</Btn></div>
        </Modal>
      )}
      {pop === 'profile' && (
        <Modal onClose={() => setPop(null)} labelledBy="pf-title">
          <h2 id="pf-title">{c.nameEn} · {c.name}</h2>
          <dl className="cd-dl">
            <dt>소속</dt><dd>{c.profile.affiliation}</dd>
            <dt>능력</dt><dd>{c.profile.ability}</dd>
            <dt>메모</dt><dd>{c.profile.note}</dd>
          </dl>
          <p className="rs-pop-note">{pend ? '신규 추가 캐릭터 · 그림(참고 이미지 배경 제거본)만 있고 설정은 확정 전입니다. 영입·교환으로 얻을 수 없습니다.' : `“${c.tagline}” · 샘플 설정(세계관 문서와 아직 맞추지 않음)`}</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setPop(null)}>닫기</Btn></div>
        </Modal>
      )}
      {pop === 'faction' && (
        <Modal onClose={() => setPop(null)} labelledBy="fc-title">
          <h2 id="fc-title">{c.en.unit}</h2>
          <p className="rs-pop-note">{c.profile.affiliation}</p>
          <p className="rs-pop-note">소속 상세 자료는 아직 없습니다.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setPop(null)}>닫기</Btn></div>
        </Modal>
      )}
      {skillPick !== null && c.skills[skillPick] && (
        <Modal onClose={() => setSkillPick(null)} labelledBy="sk-title">
          <h2 id="sk-title">{c.skills[skillPick].name}</h2>
          <p className="rs-pop-note">{c.skills[skillPick].kind} · {c.skills[skillPick].desc}</p>
          <p className="rs-pop-note">스킬 수치·강화는 전투 규칙 확정 후 연결합니다.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setSkillPick(null)}>닫기</Btn></div>
        </Modal>
      )}
      {slotPick && o && (
        <Modal onClose={() => setSlotPick(null)} labelledBy="eq-title">
          <h2 id="eq-title">{SLOT_LABEL[slotPick]}</h2>
          <div className="eq-list">
            {ITEMS.filter((it) => it.equipSlot === slotPick).map((it) => {
              const have = s.inventory.find((x) => x.itemId === it.id)?.qty ?? 0
              const free = game.freeQty(it.id)
              const current = o.equipment[slotPick] === it.id
              return (
                <button key={it.id} className={`eq-row ${current ? 'on' : ''}`} disabled={(!current && free < 1) || have === 0} onClick={() => equip(slotPick, it.id)}>
                  <ItemGlyph icon={it.icon} size="2.6rem" /><strong>{it.name}</strong><span>{it.desc}</span><small className="num">{have === 0 ? '미보유' : current ? '장착 중' : `여분 ${free}`}</small>
                </button>
              )
            })}
          </div>
          {failed && <ErrorBanner error={failed.error} onClose={clearFailed} />}
          <div className="confirm-actions">
            {o.equipment[slotPick] && <Btn variant="dark" onClick={() => equip(slotPick, null)}>해제</Btn>}
            <Btn variant="ghost" onClick={() => setSlotPick(null)}>닫기</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** 지안 외 캐릭터: 원본 상세 일러스트가 없어 임시 배경 + 기존 전신 아트로 왼쪽 영역을 채운다 */
function HeroFallback({ cid }: { cid: string }) {
  const a = ART[cid]
  const sc = (a.heroH ?? 2150) / a.bodyH
  return (
    <div className="cd2-hero" style={{ left: 0, top: 0, width: 990, height: 941, clipPath: 'polygon(0 0, 914px 0, 914px 640px, 990px 640px, 990px 941px, 0 941px)' }}>
      <img src={a.src} alt="" style={{ width: a.w * sc, height: a.h * sc, left: 540 - a.headX * sc, top: 28 - a.top * sc }} />
      <span className="tag">{a.kind === 'cutout' ? 'REF ART · 참고 그림 배경 제거본(상세 일러스트 없음)' : 'TEMP ART · 원본 상세 일러스트 없음'}</span>
    </div>
  )
}

/** Independent graphic planes: the lettering can move without dragging the character. */
function DetailBackdrop({ name }: { name: string }) {
  return <div className="ui-detail-backdrop" aria-hidden>
    <div className="ui-detail-plane plane-one" /><div className="ui-detail-plane plane-two" />
    <div className="ui-detail-dots" />
    <div className="ui-detail-word"><MotionTitle text={name} /></div>
    <div className="ui-detail-brand">ABILITY<br />KINGDOM<small>PEOPLE / CITIES<br />RESPONSES / TOMORROW</small></div>
    <MotionTicker text={`${name} / ABILITY KINGDOM`} className="ui-detail-ticker" />
    <div className="ui-detail-line" />
  </div>
}
