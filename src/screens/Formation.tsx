import { useEffect, useMemo, useRef, useState } from 'react'
import { useNav, useScreenKey } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame, teamPower, charPower } from '../game/store'
import { GAME_CONFIG } from '../game/config'
import { CHARACTERS, CHAR_BY_ID } from '../game/data/characters'
import { AUTO_FORMATION_RULE_LABEL } from '../game/rules'
import type { TeamPreset } from '../game/types'
import { ConfirmDialog, errorText, fmt, useAction } from '../ui/components'
import { RoleGlyph } from '../ui/icons'
import { RefStage, RefLayers, Hit, Patch, rectOf, boxStyle, SKIN, ICON, type RefLayout, type Rect } from '../ui/ref'
import layoutJson from '../game/data/ref-formation.json'
import fitJson from '../game/data/ref-fit.json'

// 채택 시안(지하철 플랫폼 편성창)을 원본 조각 88개 중 41개로 원위치 재현한다.
// 기본 상태(팀 01 = 지안·유진·하린·도윤, Lv.40, 리더 지안)는 원본 조각만 보인다.
// 바뀐 부분만: 원본 인물 조각을 숨기고 복원 배경·복원 전신 캐릭터로 채우며, 이름표·수치는 글자 없는 스킨 + 실제 텍스트로 덮는다.

const L = layoutJson as RefLayout
const FIT = fitJson as Record<string, { x: number; y: number; w: number; h: number; feetY: number; centerX: number }>
const REF_SLOTS = ['jian', 'yujin', 'harin', 'doyun']
const REF_LEVEL = 40
const REF_POWER = 24680
const REF_ROSTER = ['jian', 'yujin', 'harin', 'doyun', 'sein', 'narin']
const CHAR_SLICE = REF_SLOTS.map((c) => `character-${c}-visible`)
const PLATE_SLICE = REF_SLOTS.map((c) => `name-${c}`)
const TILE = ['slot-01', 'slot-02', 'slot-03', 'slot-04']
const SIDEBAR_BG = '#0b1319'
const IVORY = '#f4ece3'
/** 복원 전신이 없는 캐릭터는 기존 임시 컷아웃 사용(그림체 불일치). 가로/세로 비 */
const CUTOUT_ASPECT: Record<string, number> = { sein: 476 / 1500, narin: 514 / 1500, rion: 643 / 1500, seoha: 574 / 1500 }
/** 이름표의 패널 부분(원본 조각 중 배지 위쪽 제외) */
const PLATE_RECT: Rect[] = [
  { x: 300, y: 419, w: 213, h: 58 },
  ...[1, 2, 3].map((i) => { const r = rectOf(L, PLATE_SLICE[i]); return { x: r.x, y: r.y, w: r.w, h: r.h } }),
]
const THUMB: Rect[] = REF_ROSTER.map((c) => rectOf(L, `portrait-${c}`))
const THUMB_STD: Rect[] = THUMB.map((r, i) => (i === 0 ? { x: 304, y: 659, w: 91, h: 100 } : r))

const drafts = new Map<string, TeamPreset>()
type Ghost = { slot: number; charId: string; id: number }

function charBox(c: string, slot: number) {
  const ref = FIT[REF_SLOTS[slot]]
  const anchorX = ref.centerX, feet = ref.feetY
  const own = FIT[c]
  if (own) {
    const k = ref.h / own.h
    const w = own.w * k, h = own.h * k
    return { src: `ref/restored/formation-${c}.webp`, left: anchorX - (own.centerX - own.x) * k, top: feet - (own.feetY - own.y) * k, w, h, restored: true }
  }
  const H = feet - ref.y
  const W = H * (CUTOUT_ASPECT[c] ?? 0.38)
  return { src: CHAR_BY_ID[c].assets.stand, left: anchorX - W / 2, top: feet - H, w: W, h: H, restored: false }
}

export default function Formation({ params }: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const screenKey = useScreenKey()
  const [teamId, setTeamId] = useState<string>((params.teamId as string) ?? s.activeTeamId)
  const saved = s.teams.find((t) => t.id === teamId)!
  const [draft, setDraftState] = useState<TeamPreset>(() => drafts.get(teamId) ?? structuredClone(saved))
  const [sel, setSel] = useState<number>(() => (params.slot as number) ?? 0)
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | { proceed: () => void }>(null)
  const [pop, setPop] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [pulse, setPulse] = useState(0)
  const [reacting, setReacting] = useState<number | null>(null)
  const enterKeys = useRef<Record<number, string>>({})
  const { run, pending, failed, clearFailed } = useAction()

  const setDraft = (d: TeamPreset) => { drafts.set(d.id, d); setDraftState(d) }
  const sig = (t: Pick<TeamPreset, 'slots' | 'leaderId' | 'name'>) => JSON.stringify([t.slots, t.leaderId, t.name])
  const dirty = sig(draft) !== sig(saved)
  const dirtyTeams = useMemo(() => new Set(s.teams.filter((t) => { const d = drafts.get(t.id); return d && sig(d) !== sig(t) }).map((t) => t.id)), [s.teams, draft])

  useEffect(() => { audio.bgm('menu') }, [])
  useEffect(() => {
    if (!dirty) { nav.setGuard(null, screenKey); return }
    nav.setGuard((proceed) => { setDialog({ proceed }); return false }, screenKey)
    return () => nav.setGuard(null, screenKey)
  }, [dirty, nav, screenKey])

  const lv = (c: string) => s.owned[c]?.level ?? 1
  const power = teamPower(s, draft)

  // ───── 원본 유지 여부 ─────
  const charIsOriginal = (i: number) => draft.slots[i] === REF_SLOTS[i]
  const plateIsOriginal = (i: number) => charIsOriginal(i) && lv(REF_SLOTS[i]) === REF_LEVEL && ((draft.leaderId === REF_SLOTS[i]) === (i === 0))
  const hide = new Set<string>()
  REF_SLOTS.forEach((_, i) => { if (!charIsOriginal(i)) hide.add(CHAR_SLICE[i]); if (!plateIsOriginal(i)) hide.add(PLATE_SLICE[i]) })

  const ownedOrdered = useMemo(() => [...REF_ROSTER.filter((c) => s.owned[c]), ...CHARACTERS.map((c) => c.id).filter((c) => s.owned[c] && !REF_ROSTER.includes(c))], [s.owned])
  const pages = Math.max(1, Math.ceil(ownedOrdered.length / 6))
  const pageChars = ownedOrdered.slice(page * 6, page * 6 + 6)
  const rosterOriginal = page === 0 && REF_ROSTER.every((c, i) => pageChars[i] === c)
  const selChar = draft.slots[sel]
  if (rosterOriginal) {
    if (selChar !== 'jian') hide.add('portrait-jian')
    REF_ROSTER.forEach((c) => { if (lv(c) !== (c === 'sein' ? 37 : c === 'narin' ? 32 : REF_LEVEL)) hide.add(`portrait-${c}`) })
  } else {
    REF_ROSTER.forEach((c) => hide.add(`portrait-${c}`)); hide.add('roster-names')
  }
  const teamsDefault = teamId === 'team1' && s.teams.every((t, i) => (t.id === teamId ? draft.name : drafts.get(t.id)?.name ?? t.name) === `팀 0${i + 1}`)
  if (!teamsDefault) ['team-01', 'team-02', 'team-03'].forEach((id) => hide.add(id))

  // ───── 편집 동작 ─────
  const changeSlots = (slots: (string | null)[], leaderId = draft.leaderId) => {
    const prev = draft.slots
    const gs: Ghost[] = []
    slots.forEach((id, i) => { if (prev[i] && prev[i] !== id) gs.push({ slot: i, charId: prev[i]!, id: Date.now() + i }) })
    if (gs.length) {
      setGhosts((g) => [...g.filter((x) => !gs.some((n) => n.slot === x.slot)), ...gs]) // 연타 시 이전 퇴장 연출 정리
      const ids = gs.map((n) => n.id)
      setTimeout(() => setGhosts((g) => g.filter((x) => !ids.includes(x.id))), 320)
    }
    slots.forEach((id, i) => { if (id && prev[i] !== id) enterKeys.current[i] = `${id}-${Date.now()}` })
    const members = slots.filter(Boolean) as string[]
    setDraft({ ...draft, slots, leaderId: leaderId && members.includes(leaderId) ? leaderId : members[0] ?? null })
  }
  const react = (i: number) => { setReacting(null); requestAnimationFrame(() => setReacting(i)) }
  const selectSlot = (i: number) => {
    if (i === sel) { setPop(pop === i ? null : i); return }
    audio.sfx('select'); setSel(i); setPop(null); setPulse((n) => n + 1); react(i)
  }
  const pick = (c: string) => {
    setPop(null)
    const slots = [...draft.slots]
    const cur = slots[sel]
    if (cur === c) { nav.toast(`${CHAR_BY_ID[c].name}은(는) 이미 이 슬롯에 있습니다.`); return }
    const at = slots.indexOf(c)
    if (at >= 0) { if (GAME_CONFIG.duplicateSelectBehavior === 'swap') { slots[at] = cur; slots[sel] = c } else { slots[at] = null; slots[sel] = c } }
    else slots[sel] = c
    audio.sfx('swap'); changeSlots(slots); react(sel)
  }
  const remove = (i: number) => { const slots = [...draft.slots]; slots[i] = null; audio.sfx('tap'); changeSlots(slots); setPop(null) }
  const makeLeader = (i: number) => { const id = draft.slots[i]; if (!id) return; audio.sfx('select'); setDraft({ ...draft, leaderId: id }); setPop(null) }
  const autoForm = () => {
    const ranked: (string | null)[] = ownedOrdered.slice().sort((a, b) => charPower(s, b) - charPower(s, a)).slice(0, GAME_CONFIG.teamSize)
    while (ranked.length < GAME_CONFIG.teamSize) ranked.push(null)
    changeSlots(ranked, ranked[0]); audio.sfx('swap'); nav.toast(AUTO_FORMATION_RULE_LABEL)
  }
  const resetDraft = () => {
    if (!dirty) { nav.toast('마지막 저장 상태와 같습니다.'); return }
    changeSlots([...saved.slots], saved.leaderId); setDraft(structuredClone(saved)); drafts.delete(teamId)
    nav.toast('마지막으로 저장한 편성으로 되돌렸습니다.')
  }
  const save = async (after?: () => void) => {
    if (!dirty) { nav.toast('저장할 변경 사항이 없습니다.'); after?.(); return }
    const res = await run('save', () => game.saveTeam(draft, saved.version))
    if (res?.ok) { drafts.delete(teamId); setDraftState(structuredClone(res.value)); audio.sfx('save'); setPulse((n) => n + 1); nav.toast(`${res.value.name} 편성을 저장했습니다.`, 'ok'); after?.() }
  }
  const switchTeam = (id: string) => {
    if (id === teamId) return
    const go = () => {
      const t = game.getState().teams.find((x) => x.id === id)!
      audio.sfx('swap'); setTeamId(id); setDraftState(drafts.get(id) ?? structuredClone(t)); setSel(0); setGhosts([]); setPop(null); game.setActiveTeam(id)
    }
    if (dirty) setDialog({ proceed: go }); else go()
  }
  const commitRename = (v: string) => {
    const name = v.trim().slice(0, 12); setRenaming(null)
    if (name && name !== draft.name) setDraft({ ...draft, name })
  }
  const openDetail = (id: string) => { nav.setGuard(null, screenKey); nav.push('characterDetail', { id, from: 'formation' }) }

  // ───── 렌더 ─────
  const tabs = ['team-01', 'team-02', 'team-03'].map((id) => rectOf(L, id))
  return (
    <div className="scr">
      <RefStage canvas={L.canvas}>
        <img className="ref-bg" src="ref/restored/formation-bg.webp" alt="" />
        <RefLayers layout={L} ids={['scene-remainder']} z={1} />
        {/* 인물: 원본 조각 또는 복원 전신 */}
        {REF_SLOTS.map((_, i) => {
          const z = 10 + (4 - i)
          const c = draft.slots[i]
          if (charIsOriginal(i)) return <div key={`o${i}`} className={reacting === i ? 'rf-react' : ''} style={{ position: 'absolute', inset: 0, zIndex: z, pointerEvents: 'none' }}><RefLayers layout={L} ids={[CHAR_SLICE[i]]} z={z} /></div>
          if (!c) return null
          const b = charBox(c, i)
          return <img key={enterKeys.current[i] ?? `d${i}-${c}`} className={`rf-dyn enter ${reacting === i ? 'rf-react' : ''}`} src={b.src} alt="" style={{ left: b.left, top: b.top, width: b.w, height: b.h, zIndex: z }} />
        })}
        {ghosts.map((g) => { const b = charBox(g.charId, g.slot); return <img key={`g${g.id}`} className="rf-dyn ghost" src={b.src} alt="" style={{ left: b.left, top: b.top, width: b.w, height: b.h, zIndex: 9 }} /> })}
        {/* 빈 슬롯 */}
        {draft.slots.map((c, i) => c ? null : <div key={`e${i}`} className="rf-empty ak-fade" style={{ left: FIT[REF_SLOTS[i]].centerX - 80, top: 240, width: 160, height: 300, zIndex: 15 }}><i>+</i>캐릭터 추가</div>)}

        <RefLayers layout={L} ids={TILE} z={20} />
        {/* 바닥 슬롯 선택 표시: 01 원본은 청록, 다른 슬롯 선택 시 스킨으로 표시 */}
        {sel !== 0 && (() => { const r = rectOf(L, TILE[0]); return (
          <div className="rf-slot-overlay" style={boxStyle(r, { zIndex: 21 })}>
            <div style={{ position: 'absolute', inset: 0, background: '#3b4148', clipPath: 'polygon(11.8% 3%, 81.5% 8%, 99.4% 97%, 0.6% 97%)' }} />
            <img src={SKIN('slot-default')} alt="" />
            <span className="rf-slot-num">01</span>
          </div>) })()}
        {sel !== 0 && <div key={`p${pulse}`} className="rf-slot-overlay rf-pulse" style={boxStyle(rectOf(L, TILE[sel]), { zIndex: 21 })}><img src={SKIN('slot-selected')} alt="" /></div>}

        <RefLayers layout={L} ids={['sidebar-remainder', 'bottom-remainder']} z={22} />
        <RefLayers layout={L} hide={hide} ids={L.layers.filter((l) => ['sidebar', 'roster', 'actions', 'footer'].includes(l.group)).map((l) => l.id)} z={26} />
        <RefLayers layout={L} hide={hide} ids={PLATE_SLICE} z={30} />

        {/* 동적 이름표 */}
        {REF_SLOTS.map((_, i) => {
          const c = draft.slots[i]
          if (!c || plateIsOriginal(i)) return null
          const ch = CHAR_BY_ID[c]
          const r = PLATE_RECT[i]
          return (
            <div key={`pl${i}`}>
              <Patch r={r} skin={SKIN('nameplate')} z={31} className="rf-plate ak-fade" style={{ boxShadow: i === sel ? 'inset 0 0 0 2px #40ecde' : undefined }}>
                <span className="rf-role" style={i === sel ? { borderColor: '#40ecde', color: '#40ecde' } : undefined}><RoleGlyph role={ch.role} size={22} /></span>
                <span className="rf-plate-name"><b>{ch.name}</b><span className="num-tab">Lv.{lv(c)}</span></span>
                <span className="rf-chev" />
              </Patch>
              {draft.leaderId === c && <span className="rf-leader" style={{ left: r.x + 10, top: r.y - 22 }}>♛ 리더</span>}
            </div>
          )
        })}

        {/* 팀 탭(이름·선택 상태가 원본과 다를 때) */}
        {!teamsDefault && s.teams.map((t, idx) => {
          const on = t.id === teamId
          const name = on ? draft.name : drafts.get(t.id)?.name ?? t.name
          return (
            <Patch key={t.id} r={tabs[idx]} bg={SIDEBAR_BG} skin={SKIN(on ? 'team-tab-selected' : 'team-tab')} z={27} className={`rf-tab ${on ? 'on' : ''}`}>
              <b style={{ position: 'relative' }}>{name}</b>
              {on && <img className="ic" src={ICON('edit')} alt="" style={{ position: 'relative' }} />}
              {dirtyTeams.has(t.id) && !on && <span style={{ position: 'relative', marginLeft: 8, width: 9, height: 9, borderRadius: 5, background: '#c8f53b' }} />}
            </Patch>
          )
        })}
        {renaming && (() => { const idx = s.teams.findIndex((t) => t.id === renaming); return (
          <div style={boxStyle(tabs[idx], { zIndex: 60, display: 'flex', alignItems: 'center', padding: '0 10px', background: '#46eddf' })}>
            <input autoFocus defaultValue={draft.name} maxLength={12} aria-label="팀 이름" style={{ width: '100%', height: 36, fontSize: 20, fontWeight: 800, border: 0, padding: '0 8px' }}
              onBlur={(e) => commitRename(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitRename(e.currentTarget.value); if (e.key === 'Escape') setRenaming(null) }} />
          </div>) })()}
        {/* 팀 전투력 */}
        {power !== REF_POWER && (
          <Patch r={rectOf(L, 'team-power')} bg={SIDEBAR_BG} z={27} className="rf-power">
            <span style={{ position: 'relative' }}>팀 전투력</span>
            <b className="num-tab" style={{ position: 'relative' }}>{fmt(power)}</b>
          </Patch>
        )}

        {/* 보유 캐릭터 */}
        {(rosterOriginal ? REF_ROSTER : pageChars).map((c, i) => {
          if (!c) return null
          const r = THUMB_STD[i]
          const selected = c === selChar
          const sliceShown = rosterOriginal && !hide.has(`portrait-${c}`)
          return (
            <div key={`th${page}-${c}`}>
              {!sliceShown && (
                <div className="rf-thumb" style={boxStyle(i === 0 ? THUMB[0] : r, { zIndex: 27, background: IVORY })}>
                  <img className="p" src={c === 'jian' && rosterOriginal ? 'ref/formation/portrait-jian-plain.webp' : rosterOriginal ? `ref/formation/portrait-${c}.webp` : CHAR_BY_ID[c].assets.portrait} alt=""
                    style={i === 0 ? { position: 'absolute', left: 5, top: 5, width: 91, height: 100 } : undefined} />
                  {(!rosterOriginal || lv(c) !== (c === 'sein' ? 37 : c === 'narin' ? 32 : REF_LEVEL)) && <span className="rf-lv num-tab" style={i === 0 && rosterOriginal ? { right: 7, bottom: 7 } : undefined}>Lv.{lv(c)}</span>}
                  {!rosterOriginal && <span style={{ position: 'absolute', left: 4, bottom: 3, width: 22, height: 22, display: 'grid', placeItems: 'center', background: 'rgba(12,16,20,.88)', color: '#fff' }}><RoleGlyph role={CHAR_BY_ID[c].role} size={14} /></span>}
                </div>
              )}
              {selected && !(rosterOriginal && c === 'jian') && (
                <div className="rf-slot-overlay" style={boxStyle(i === 0 ? THUMB[0] : r, { zIndex: 28 })}>
                  <img src={SKIN('portrait-selected')} alt="" /><span className="rf-check" />
                </div>
              )}
            </div>
          )
        })}
        {!rosterOriginal && (
          <Patch r={rectOf(L, 'roster-names')} bg={IVORY} z={27} className="rf-names">
            {pageChars.map((c, i) => <span key={c} style={{ position: 'absolute', left: THUMB_STD[i].x - 327, width: THUMB_STD[i].w, top: 2 }}>{CHAR_BY_ID[c].name}</span>)}
          </Patch>
        )}
        {ownedOrdered.length !== 6 && (
          <Patch r={rectOf(L, 'roster-count')} bg={IVORY} z={27} className="rf-count">
            <small style={{ position: 'relative', marginTop: 4 }}>보유<br />캐릭터</small>
            <b className="num-tab" style={{ position: 'relative' }}>{ownedOrdered.length} <span style={{ fontSize: 18 }}>/ 24</span></b>
          </Patch>
        )}
        {dirty && <span className="rf-dirty" style={{ left: 1300, top: 630 }}>저장하지 않은 변경</span>}

        {/* ───── 조작 영역(투명 버튼) ───── */}
        <Hit r={rectOf(L, 'back')} label="돌아가기" onClick={() => nav.back()} />
        {tabs.map((r, idx) => {
          const t = s.teams[idx]
          const on = t.id === teamId
          return (
            <div key={t.id}>
              <Hit r={on ? { ...r, w: r.w - 46 } : r} label={`${(t.id === teamId ? draft.name : drafts.get(t.id)?.name ?? t.name)} 선택${on ? '됨' : ''}`} onClick={() => switchTeam(t.id)} sfx="none" className="fm-team-btn" />
              {on && <Hit r={{ x: r.x + r.w - 46, y: r.y, w: 46, h: r.h }} label="팀 이름 수정" onClick={() => setRenaming(t.id)} className="fm-team-edit" />}
            </div>
          )
        })}
        {REF_SLOTS.map((_, i) => {
          const c = draft.slots[i]
          const f = FIT[REF_SLOTS[i]]
          const plate = PLATE_RECT[i]
          const tile = rectOf(L, TILE[i])
          const name = c ? CHAR_BY_ID[c].name : '빈 슬롯'
          return (
            <div key={`h${i}`}>
              <Hit r={{ x: f.centerX - 85, y: Math.max(30, f.y + 10), w: 170, h: plate.y - Math.max(30, f.y + 10) }} label={`${i + 1}번 슬롯 ${name} 선택`} onClick={() => selectSlot(i)} sfx="none" z={45} className="fm-fig" />
              <Hit r={{ ...plate, w: plate.w - 36 }} label={`${name} 이름표, ${i + 1}번 슬롯 선택`} onClick={() => selectSlot(i)} sfx="none" z={46} className="fm-plate-main" />
              {c && <Hit r={{ x: plate.x + plate.w - 36, y: plate.y, w: 36, h: plate.h }} label={`${name} 상세 정보`} onClick={() => openDetail(c)} z={46} className="fm-info" />}
              <Hit r={{ x: tile.x + 30, y: tile.y, w: tile.w - 60, h: tile.h }} label={`${i + 1}번 바닥 슬롯 선택`} onClick={() => selectSlot(i)} sfx="none" z={45} />
            </div>
          )
        })}
        {(rosterOriginal ? REF_ROSTER : pageChars).map((c, i) => c && (
          <Hit key={`rh${c}`} r={i === 0 ? THUMB[0] : THUMB_STD[i]} label={`${CHAR_BY_ID[c].name} 레벨 ${lv(c)}${draft.slots.includes(c) ? `, ${draft.slots.indexOf(c) + 1}번 슬롯 배치됨` : ''}`} onClick={() => pick(c)} sfx="none" className="fm-thumb" />
        ))}
        <Hit r={rectOf(L, 'roster-prev')} label="이전 목록" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} />
        <Hit r={rectOf(L, 'roster-next')} label="다음 목록" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} />
        <Hit r={rectOf(L, 'auto-formation')} label="자동 편성" onClick={autoForm} className="fm-auto" />
        <Hit r={rectOf(L, 'reset')} label="초기화 (마지막 저장 상태로 되돌리기)" onClick={resetDraft} className="fm-reset" />
        <Hit r={rectOf(L, 'save-formation')} label={pending === 'save' ? '저장 중' : '편성 저장'} disabled={pending === 'save'} onClick={() => save()} className="fm-save" sfx="none" />

        {/* 선택 슬롯 메뉴 */}
        {pop !== null && draft.slots[pop] && (
          <div className="rf-pop" style={{ left: PLATE_RECT[pop].x, top: PLATE_RECT[pop].y - 140 }}>
            <button onClick={() => openDetail(draft.slots[pop]!)}>상세 정보</button>
            <button disabled={draft.leaderId === draft.slots[pop]} onClick={() => makeLeader(pop)}>리더 지정</button>
            <button onClick={() => remove(pop)}>슬롯에서 빼기</button>
          </div>
        )}
        {failed && (
          <div className="rf-err" style={{ right: 20, top: 600 }}>
            {errorText(failed.error)}
            {failed.error.code === 'NETWORK' && <button onClick={() => save()}>재시도</button>}
            <button onClick={clearFailed}>닫기</button>
          </div>
        )}
      </RefStage>

      {dialog && (
        <ConfirmDialog
          title="저장하지 않은 변경이 있습니다"
          body={<>{draft.name}의 편성이 바뀌었습니다. 저장할까요?<br /><small>변경 취소를 누르면 마지막 저장 상태로 돌아갑니다.</small></>}
          actions={[
            { label: '계속 편집', variant: 'ghost', onClick: () => setDialog(null) },
            { label: '변경 취소', variant: 'dark', onClick: () => { const p = dialog.proceed; drafts.delete(teamId); setDraftState(structuredClone(saved)); setDialog(null); nav.setGuard(null, screenKey); p() } },
            { label: '저장', variant: 'primary', onClick: () => { const p = dialog.proceed; setDialog(null); save(() => { nav.setGuard(null, screenKey); p() }) } },
          ]}
        />
      )}
    </div>
  )
}
