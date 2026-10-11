import { useMemo, useState } from 'react'
import '../styles/screens.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame, charPower } from '../game/store'
import { CHARACTERS, CHAR_BY_ID } from '../game/data/characters'
import { ITEMS, ITEM_BY_ID } from '../game/data/catalog'
import { ROLE_LABEL, ATTRIBUTE_LABEL, GAME_CONFIG } from '../game/config'
import { statsOf, powerOf, RULES_ARE_PROVISIONAL } from '../game/rules'
import type { EquipmentSlots } from '../game/types'
import { TopBar, Stars, fmt, Tabs, Btn, useAction, ErrorBanner, Modal, ProvisionalTag } from '../ui/components'
import { RoleGlyph, IconChevron, IconChevronL, ItemGlyph, IconPlus } from '../ui/icons'

type Tab = 'info' | 'skill' | 'equip' | 'growth'
const SLOT_LABEL: Record<keyof EquipmentSlots, string> = { weapon: '무기', gear: '의상', accessory: '장신구' }

// 탭별로 카메라(구도)와 포즈를 바꾼다: 기본=상반신, 스킬=동작 포즈, 장비=전신, 성장=중간
export default function CharacterDetail({ params }: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const [id, setId] = useState(params.id as string)
  const [tab, setTab] = useState<Tab>((params.tab as Tab) ?? 'info')
  const [slotPick, setSlotPick] = useState<keyof EquipmentSlots | null>(null)
  const [levels, setLevels] = useState(1)
  const { run, pending, failed, clearFailed } = useAction()
  const c = CHAR_BY_ID[id]
  const o = s.owned[id]
  const order = CHARACTERS.map((x) => x.id)

  const stats = o ? statsOf(c, o, ITEM_BY_ID) : statsOf(c, { id, level: 1, obtainedAt: 0, dupes: 0, equipment: { weapon: null, gear: null, accessory: null } }, ITEM_BY_ID)
  const plan = useMemo(() => (o ? game.planLevelUp(id, levels) : null), [o, id, levels, s])
  const after = o && plan ? statsOf(c, o, ITEM_BY_ID, plan.to) : null

  const step = (d: number) => {
    audio.sfx('swap')
    const i = (order.indexOf(id) + d + order.length) % order.length
    setId(order[i]); setLevels(1)
  }

  const doLevel = async () => {
    const res = await run('lv', (rid) => game.levelUp(id, levels, rid))
    if (res?.ok) { audio.sfx('save'); nav.toast(`${c.name} Lv.${res.value.from} → Lv.${res.value.to}`, 'ok'); setLevels(1) }
  }
  const equip = async (slot: keyof EquipmentSlots, itemId: string | null) => {
    const res = await run('eq', () => game.equip(id, slot, itemId))
    if (res?.ok) { audio.sfx('select'); setSlotPick(null) }
  }

  const cam = { info: 'cam-info', skill: 'cam-skill', equip: 'cam-equip', growth: 'cam-growth' }[tab]

  return (
    <div className="scr cd" style={{ ['--a' as string]: c.accent }}>
      <div className="cd-bg" aria-hidden>
        <div className="cd-bg-name" key={id}>{c.nameEn}</div>
        <div className="cd-bg-stripe" />
      </div>
      <div className={`cd-stage ${cam}`} key={id}>
        <img className="cd-stand" src={c.assets.stand} alt="" />
        <img className="cd-action" src={c.assets.action} alt="" />
      </div>
      <TopBar title="캐릭터 상세" sub={c.nameEn} right={<Btn size="sm" variant="dark" disabled={!o || s.lobby.characterId === id} onClick={() => { game.setLobbyCharacter(id); nav.toast(`${c.name}을(를) 로비 대표 캐릭터로 설정했습니다.`, 'ok') }}>{s.lobby.characterId === id ? '로비 대표' : '로비 대표로 설정'}</Btn>} />
      <button className="cd-nav l" onClick={() => step(-1)} aria-label="이전 캐릭터"><IconChevronL size="3rem" /></button>
      <button className="cd-nav r" onClick={() => step(1)} aria-label="다음 캐릭터"><IconChevron size="3rem" /></button>

      <section className="cd-panel">
        <div className="cd-head">
          <span className="cd-role"><RoleGlyph role={c.role} size="2.6rem" /></span>
          <div>
            <h2>{c.name} <Stars n={c.rarity} /></h2>
            <p>{ROLE_LABEL[c.role]} · {ATTRIBUTE_LABEL[c.attribute]} · {o ? `Lv.${o.level}` : '미보유'}</p>
          </div>
          <div className="cd-power"><small>전투력</small><strong className="num">{fmt(o ? charPower(s, id) : powerOf(stats))}</strong></div>
        </div>
        <Tabs<Tab> tone="light" value={tab} onChange={(t) => { setTab(t); setSlotPick(null) }} items={[{ id: 'info', label: '기본 정보' }, { id: 'skill', label: '스킬' }, { id: 'equip', label: '장비' }, { id: 'growth', label: '성장' }]} />

        <div className="cd-body scroll-y" key={tab}>
          {tab === 'info' && (
            <>
              <p className="cd-quote">“{c.tagline}”</p>
              <dl className="cd-dl">
                <dt>소속</dt><dd>{c.profile.affiliation}</dd>
                <dt>능력</dt><dd>{c.profile.ability}</dd>
                <dt>메모</dt><dd>{c.profile.note}</dd>
              </dl>
              <StatRows stats={stats} />
              {o && o.dupes > 0 && <p className="cd-note">중복 획득 {o.dupes}회 기록됨 · 중복 처리 규칙은 미정</p>}
            </>
          )}
          {tab === 'skill' && (
            <ul className="cd-skills">
              {c.skills.map((sk) => (
                <li key={sk.name}>
                  <span className={`cd-skind k-${sk.kind}`}>{sk.kind}</span>
                  <div><strong>{sk.name}</strong><p>{sk.desc}</p></div>
                </li>
              ))}
              <li className="cd-note">스킬 수치와 전투 효과는 전투 규칙 확정 후 정합니다.</li>
            </ul>
          )}
          {tab === 'equip' && (
            o ? (
              <div className="cd-equip">
                {(Object.keys(SLOT_LABEL) as (keyof EquipmentSlots)[]).map((slot) => {
                  const itemId = o.equipment[slot]
                  const it = itemId ? ITEM_BY_ID[itemId] : null
                  return (
                    <button key={slot} className={`cd-eslot ${it ? 'filled' : ''}`} onClick={() => { audio.sfx('tap'); setSlotPick(slot) }}>
                      <span className="cd-eicon">{it ? <ItemGlyph icon={it.icon} size="3.2rem" /> : <IconPlus size="2.4rem" />}</span>
                      <span><small>{SLOT_LABEL[slot]}</small><strong>{it ? it.name : '비어 있음'}</strong>{it && <em>{it.desc}</em>}</span>
                    </button>
                  )
                })}
                <StatRows stats={stats} />
              </div>
            ) : <p className="cd-note">보유한 캐릭터만 장비를 바꿀 수 있습니다.</p>
          )}
          {tab === 'growth' && (
            o && plan && after ? (
              <div className="cd-growth">
                <div className="cd-lv">
                  <span className="num">Lv.{plan.from}</span><IconChevron size="2.4rem" /><strong className="num">Lv.{plan.to}</strong>
                  <div className="cd-lv-step">
                    {[1, 5, 10].map((n) => <button key={n} className={levels === n ? 'on' : ''} onClick={() => { audio.sfx('tap'); setLevels(n) }}>+{n}</button>)}
                  </div>
                </div>
                <table className="cd-compare">
                  <tbody>
                    <tr><th>체력</th><td className="num">{fmt(stats.hp)}</td><td className="num up">{fmt(after.hp)}</td></tr>
                    <tr><th>공격력</th><td className="num">{fmt(stats.atk)}</td><td className="num up">{fmt(after.atk)}</td></tr>
                    <tr><th>방어력</th><td className="num">{fmt(stats.def)}</td><td className="num up">{fmt(after.def)}</td></tr>
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
                {failed && <ErrorBanner error={failed.error} onRetry={doLevel} onClose={clearFailed} />}
                <Btn variant="primary" size="lg" disabled={!plan.feasible || pending === 'lv'} onClick={doLevel}>{plan.to >= GAME_CONFIG.maxLevel && plan.from >= GAME_CONFIG.maxLevel ? '최대 레벨' : pending === 'lv' ? '처리 중…' : '레벨 업'}</Btn>
              </div>
            ) : <p className="cd-note">보유한 캐릭터만 성장시킬 수 있습니다. 영입에서 획득하세요.</p>
          )}
        </div>
      </section>

      {slotPick && o && (
        <Modal onClose={() => setSlotPick(null)} labelledBy="eq-title">
          <h2 id="eq-title">{SLOT_LABEL[slotPick]} 선택</h2>
          <div className="eq-list">
            {ITEMS.filter((it) => it.equipSlot === slotPick).map((it) => {
              const have = s.inventory.find((x) => x.itemId === it.id)?.qty ?? 0
              const free = game.freeQty(it.id)
              const current = o.equipment[slotPick] === it.id
              const disabled = !current && free < 1
              return (
                <button key={it.id} className={`eq-row ${current ? 'on' : ''}`} disabled={disabled || have === 0} onClick={() => equip(slotPick, it.id)}>
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

function StatRows({ stats }: { stats: { hp: number; atk: number; def: number } }) {
  return (
    <div className="cd-stats">
      <div><small>체력</small><strong className="num">{fmt(stats.hp)}</strong></div>
      <div><small>공격력</small><strong className="num">{fmt(stats.atk)}</strong></div>
      <div><small>방어력</small><strong className="num">{fmt(stats.def)}</strong></div>
    </div>
  )
}
