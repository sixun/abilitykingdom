import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/formation.css'
import { useNav, useScreenKey } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame, teamPower, charPower } from '../game/store'
import { GAME_CONFIG, ROLE_LABEL } from '../game/config'
import { CHARACTERS, CHAR_BY_ID } from '../game/data/characters'
import { AUTO_FORMATION_RULE_LABEL } from '../game/rules'
import type { TeamPreset } from '../game/types'
import { Btn, ConfirmDialog, Dot, errorText, fmt, useAction } from '../ui/components'
import { IconBack, IconChevron, IconChevronL, IconCrown, IconInfo, IconPencil, IconPlus, IconReset, IconSave, IconUsers, IconCheck, IconClose, RoleGlyph } from '../ui/icons'

/** 슬롯 기준 위치(화면 비율). 기기별 비율은 CSS 변수로 조정 */
const SLOT_X = [0.335, 0.515, 0.69, 0.865]
const FEET_Y = 0.79

// 저장 전 편집본은 세션 메모리에만 보관(상세 화면 다녀와도 유지, 재시작 시 저장본으로 복원)
const drafts = new Map<string, TeamPreset>()

type Ghost = { slot: number; charId: string; id: number }

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
  const [dialog, setDialog] = useState<null | { kind: 'leave' | 'switch'; proceed: () => void }>(null)
  const [savePulse, setSavePulse] = useState(0)
  const [reacting, setReacting] = useState<number | null>(null)
  const rosterRef = useRef<HTMLDivElement>(null)
  const { run, pending, failed, clearFailed } = useAction()

  const setDraft = (d: TeamPreset) => { drafts.set(d.id, d); setDraftState(d) }

  const dirty = useMemo(() => JSON.stringify([draft.slots, draft.leaderId, draft.name]) !== JSON.stringify([saved.slots, saved.leaderId, saved.name]), [draft, saved])
  const dirtyTeams = useMemo(() => new Set(s.teams.filter((t) => { const d = drafts.get(t.id); return d && JSON.stringify([d.slots, d.leaderId, d.name]) !== JSON.stringify([t.slots, t.leaderId, t.name]) }).map((t) => t.id)), [s.teams, draft])

  useEffect(() => { audio.bgm('menu') }, [])

  // 저장 전 이탈 확인
  useEffect(() => {
    if (!dirty) { nav.setGuard(null, screenKey); return }
    nav.setGuard((proceed) => { setDialog({ kind: 'leave', proceed }); return false }, screenKey)
    return () => nav.setGuard(null, screenKey)
  }, [dirty, nav, screenKey])

  const ownedList = useMemo(() => CHARACTERS.filter((c) => s.owned[c.id]), [s.owned])
  const power = teamPower(s, draft)
  const shownPower = useCountUp(power)

  // ───── 편집 동작 ─────
  const changeSlots = (slots: (string | null)[], leaderId = draft.leaderId) => {
    const prev = draft.slots
    const newGhosts: Ghost[] = []
    slots.forEach((id, i) => { if (prev[i] && prev[i] !== id) newGhosts.push({ slot: i, charId: prev[i]!, id: Date.now() + i }) })
    if (newGhosts.length) {
      // 같은 슬롯의 이전 퇴장 연출은 정리하고 최신 것만 남긴다(연타 시 중첩 방지)
      setGhosts((g) => [...g.filter((x) => !newGhosts.some((n) => n.slot === x.slot)), ...newGhosts])
      const ids = newGhosts.map((n) => n.id)
      setTimeout(() => setGhosts((g) => g.filter((x) => !ids.includes(x.id))), 360)
    }
    const members = slots.filter(Boolean) as string[]
    const leader = leaderId && members.includes(leaderId) ? leaderId : members[0] ?? null
    setDraft({ ...draft, slots, leaderId: leader })
  }

  const pickFromRoster = (charId: string) => {
    const slots = [...draft.slots]
    const cur = slots[sel]
    if (cur === charId) { nav.toast(`${CHAR_BY_ID[charId].name}은(는) 이미 이 슬롯에 있습니다.`); return }
    const at = slots.indexOf(charId)
    if (at >= 0 && !GAME_CONFIG.allowDuplicateInTeam) {
      if (GAME_CONFIG.duplicateSelectBehavior === 'swap') { slots[at] = cur; slots[sel] = charId }
      else { slots[at] = null; slots[sel] = charId }
    } else {
      slots[sel] = charId
    }
    audio.sfx('swap')
    changeSlots(slots)
    react(sel)
  }

  const selectSlot = (i: number) => {
    if (i !== sel) audio.sfx('select')
    setSel(i)
    react(i)
  }
  const react = (i: number) => { setReacting(null); requestAnimationFrame(() => setReacting(i)) }

  const removeFromSlot = (i: number) => {
    const slots = [...draft.slots]; slots[i] = null
    audio.sfx('tap')
    changeSlots(slots)
  }
  const makeLeader = (i: number) => {
    const id = draft.slots[i]; if (!id) return
    audio.sfx('select')
    setDraft({ ...draft, leaderId: id })
  }

  const autoForm = () => {
    const ranked = [...ownedList].sort((a, b) => charPower(s, b.id) - charPower(s, a.id)).slice(0, GAME_CONFIG.teamSize).map((c) => c.id)
    while (ranked.length < GAME_CONFIG.teamSize) ranked.push(null as unknown as string)
    changeSlots(ranked, ranked[0])
    audio.sfx('swap')
    nav.toast(AUTO_FORMATION_RULE_LABEL)
  }
  const resetDraft = () => {
    changeSlots([...saved.slots], saved.leaderId)
    setDraft(structuredClone(saved))
    drafts.delete(teamId)
    nav.toast('마지막으로 저장한 편성으로 되돌렸습니다.')
  }

  const save = async (after?: () => void) => {
    const res = await run('save', () => game.saveTeam(draft, saved.version))
    if (!res) return
    if (res.ok) {
      drafts.delete(teamId)
      setDraftState(structuredClone(res.value))
      audio.sfx('save')
      setSavePulse((n) => n + 1)
      nav.toast(`${res.value.name} 편성을 저장했습니다.`, 'ok')
      after?.()
    }
  }

  const switchTeam = (id: string) => {
    if (id === teamId) return
    const go = () => {
      const t = game.getState().teams.find((x) => x.id === id)!
      audio.sfx('swap')
      setTeamId(id)
      setDraftState(drafts.get(id) ?? structuredClone(t))
      setSel(0)
      setGhosts([])
      game.setActiveTeam(id)
    }
    if (dirty) setDialog({ kind: 'switch', proceed: go })
    else go()
  }

  const commitRename = (v: string) => {
    const name = v.trim().slice(0, 12)
    setRenaming(null)
    if (!name || name === draft.name) return
    setDraft({ ...draft, name })
  }

  const openDetail = (id: string) => {
    nav.setGuard(null, screenKey) // 편집본은 세션 메모리에 남는다
    nav.push('characterDetail', { id, from: 'formation' })
  }

  const scrollRoster = (d: number) => rosterRef.current?.scrollBy({ left: d * rosterRef.current.clientWidth * 0.6, behavior: 'smooth' })

  const leaderSlot = draft.leaderId ? draft.slots.indexOf(draft.leaderId) : -1

  return (
    <div className="fm" style={{ ['--feet' as string]: FEET_Y }}>
      {/* 배경(플랫폼) */}
      <div className="fm-bg" aria-hidden>
        <img src="assets/bg/platform.webp" alt="" />
        <div className="fm-bg-grad" />
      </div>

      {/* 바닥 슬롯 표식 */}
      <div className="fm-floor" aria-hidden>
        {draft.slots.map((id, i) => (
          <div key={i} className={`fm-tile ${i === sel ? 'sel' : ''} ${id ? '' : 'empty'}`} style={{ left: `${SLOT_X[i] * 100}%`, animationDelay: `${120 + i * 70}ms` }}>
            <div className="fm-tile-inner" key={i === sel ? `s${savePulse}` : 'n'}>
              <span className="fm-tile-num">{String(i + 1).padStart(2, '0')}</span>
              {i === sel && <span className="fm-tile-sub">SELECTED</span>}
            </div>
          </div>
        ))}
      </div>

      {/* 팀원 */}
      <div className="fm-cast">
        {ghosts.map((g) => {
          const c = CHAR_BY_ID[g.charId]
          return (
            <div key={`g${g.id}`} className="fm-fig ghost" style={figStyle(g.slot, c.formation)} aria-hidden>
              <img src={c.assets.stand} alt="" />
            </div>
          )
        })}
        {draft.slots.map((id, i) => {
          if (!id) {
            return (
              <button key={`e${i}`} className={`fm-empty ${i === sel ? 'sel' : ''}`} style={{ left: `${SLOT_X[i] * 100}%` }} onClick={() => selectSlot(i)} aria-label={`${i + 1}번 슬롯 비어 있음. 선택`}>
                <span className="fm-empty-plus"><IconPlus size="3.2rem" /></span>
                <span className="fm-empty-label">캐릭터 추가</span>
              </button>
            )
          }
          const c = CHAR_BY_ID[id]
          return (
            <button
              key={`${i}-${id}`}
              className={`fm-fig ${i === sel ? 'sel' : ''} ${reacting === i ? 'react' : ''}`}
              style={{ ...figStyle(i, c.formation), animationDelay: `${160 + i * 90}ms`, ['--seed' as string]: c.idleSeed, ['--accent' as string]: c.accent }}
              onClick={() => selectSlot(i)}
              aria-label={`${i + 1}번 슬롯 ${c.name} 선택`}
            >
              <img src={c.assets.stand} alt="" className={`idle-${c.lobby.idle}`} draggable={false} />
            </button>
          )
        })}
      </div>

      {/* 이름표 */}
      <div className="fm-plates">
        {draft.slots.map((id, i) => {
          if (!id) return null
          const c = CHAR_BY_ID[id]
          const o = s.owned[id]
          return (
            <div key={`p${i}-${id}`} className={`fm-plate-wrap ${i === sel ? 'sel' : ''}`} style={{ left: `${SLOT_X[i] * 100}%`, animationDelay: `${260 + i * 70}ms` }}>
              {leaderSlot === i && <span className="fm-leader"><IconCrown size="1.5rem" />리더</span>}
              <div className="fm-plate">
                <button className="fm-plate-main" onClick={() => selectSlot(i)} aria-label={`${c.name} 교체할 슬롯으로 선택`}>
                  <span className="fm-role" title={ROLE_LABEL[c.role]}><RoleGlyph role={c.role} size="2.4rem" /></span>
                  <span className="fm-plate-text">
                    <strong>{c.name}</strong>
                    <span className="num">Lv.{o?.level ?? 1}</span>
                  </span>
                  <IconChevron size="2rem" className="fm-plate-chev" />
                </button>
                <button className="fm-info" onClick={() => { audio.sfx('tap'); openDetail(id) }} aria-label={`${c.name} 상세 정보`}><IconInfo size="2rem" /></button>
              </div>
              {i === sel && (
                <div className="fm-slot-actions">
                  <button onClick={() => makeLeader(i)} disabled={leaderSlot === i}><IconCrown size="1.4rem" />리더 지정</button>
                  <button onClick={() => removeFromSlot(i)}><IconClose size="1.4rem" />빼기</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 왼쪽 패널 */}
      <aside className="fm-side">
        <div className="fm-side-top">
          <button className="fm-back" onClick={() => { audio.sfx('tap'); nav.back() }} aria-label="돌아가기"><IconBack size="2.6rem" /></button>
          <div className="fm-brand"><b>ABILITY KINGDOM</b></div>
        </div>
        <h1 className="fm-title">편성</h1>
        <div className="fm-title-en">TEAM FORMATION</div>
        <div className="fm-teams" role="tablist" aria-label="팀 프리셋">
          {s.teams.map((t, idx) => {
            const label = (t.id === teamId ? draft.name : drafts.get(t.id)?.name ?? t.name)
            const on = t.id === teamId
            return (
              <div key={t.id} className={`fm-team ${on ? 'on' : ''}`}>
                {renaming === t.id ? (
                  <input
                    autoFocus defaultValue={label} maxLength={12} aria-label="팀 이름"
                    onBlur={(e) => commitRename(e.currentTarget.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(e.currentTarget.value); if (e.key === 'Escape') setRenaming(null) }}
                  />
                ) : (
                  <button role="tab" aria-selected={on} className="fm-team-btn" onClick={() => switchTeam(t.id)}>
                    <span className="fm-team-idx">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="fm-team-name">{label}</span>
                    <Dot show={dirtyTeams.has(t.id)} tone="lime" />
                  </button>
                )}
                {on && renaming !== t.id && (
                  <button className="fm-team-edit" aria-label="팀 이름 수정" onClick={() => { audio.sfx('tap'); setRenaming(t.id) }}><IconPencil size="2rem" /></button>
                )}
              </div>
            )
          })}
        </div>
        <div className="fm-power">
          <span>팀 전투력</span>
          <strong className="num">{fmt(shownPower)}</strong>
        </div>
        <div className="fm-members num">{draft.slots.filter(Boolean).length} / {GAME_CONFIG.teamSize}명 배치</div>
        <div className="fm-line" aria-hidden><i /><i /><i /><i /></div>
      </aside>

      {/* 하단 보유 캐릭터 바 */}
      <footer className="fm-bottom">
        <div className="fm-owned">
          <span>보유<br />캐릭터</span>
          <strong className="num">{ownedList.length}<small> / {CHARACTERS.length}</small></strong>
        </div>
        <button className="fm-arrow" onClick={() => scrollRoster(-1)} aria-label="왼쪽으로"><IconChevronL size="2.4rem" /></button>
        <div className="fm-roster scroll-x" ref={rosterRef}>
          {ownedList.map((c) => {
            const at = draft.slots.indexOf(c.id)
            const isSelSlot = at === sel
            return (
              <button key={c.id} className={`fm-thumb ${at >= 0 ? 'in' : ''} ${isSelSlot ? 'cur' : ''}`} onClick={() => pickFromRoster(c.id)} aria-label={`${c.name} 레벨 ${s.owned[c.id].level}${at >= 0 ? `, ${at + 1}번 슬롯 배치됨` : ''}`}>
                <div className="fm-thumb-img" style={{ ['--accent' as string]: c.accent }}>
                  <img src={c.assets.portrait} alt="" loading="lazy" />
                  <span className="fm-thumb-role"><RoleGlyph role={c.role} size="1.5rem" /></span>
                  <span className="fm-thumb-lv num">Lv.{s.owned[c.id].level}</span>
                  {at >= 0 && <span className="fm-thumb-check" aria-hidden>{isSelSlot ? <IconCheck size="1.6rem" /> : String(at + 1).padStart(2, '0')}</span>}
                </div>
                <span className="fm-thumb-name">{c.name}</span>
              </button>
            )
          })}
        </div>
        <button className="fm-arrow" onClick={() => scrollRoster(1)} aria-label="오른쪽으로"><IconChevron size="2.4rem" /></button>

        <div className="fm-actions">
          {dirty && <span className="fm-dirty">저장하지 않은 변경</span>}
          <Btn variant="dark" onClick={autoForm} title={AUTO_FORMATION_RULE_LABEL}><IconUsers size="2.2rem" />자동 편성</Btn>
          <Btn variant="dark" onClick={resetDraft} disabled={!dirty} title="마지막 저장 상태로 되돌리기"><IconReset size="2.2rem" />초기화</Btn>
          <Btn variant="primary" size="lg" className="fm-save" onClick={() => save()} disabled={!dirty || pending === 'save'}>
            <IconSave size="2.8rem" />{pending === 'save' ? '저장 중…' : '편성 저장'}
          </Btn>
        </div>
      </footer>

      {failed && (
        <div className="fm-error" role="alert">
          {errorText(failed.error)}
          {failed.error.code === 'NETWORK' && <button onClick={() => save()}>재시도</button>}
          <button onClick={clearFailed}>닫기</button>
        </div>
      )}

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

function figStyle(slot: number, f: { scale: number; offsetX: number; offsetY: number }) {
  return {
    left: `calc(${SLOT_X[slot] * 100}% + ${f.offsetX}rem)`,
    ['--scale' as string]: f.scale,
    ['--oy' as string]: `${f.offsetY}rem`,
  }
}

function useCountUp(target: number) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now(), a = from.current, d = 380
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / d)
      const val = Math.round(a + (target - a) * (1 - Math.pow(1 - k, 3)))
      setV(val)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); from.current = target }
  }, [target])
  return v
}
