import { useMemo, useState } from 'react'
import '../styles/screens.css'
import { useNav } from '../app/nav'
import { useGame, charPower } from '../game/store'
import { CHARACTERS } from '../game/data/characters'
import { ROLE_LABEL, ATTRIBUTE_LABEL } from '../game/config'
import { TopBar, Stars, fmt, Tabs, EmptyState } from '../ui/components'
import { RoleGlyph } from '../ui/icons'
import { audio } from '../app/audio'

type RoleFilter = 'all' | 'attack' | 'defense' | 'ability' | 'support'
type Sort = 'level' | 'rarity' | 'power' | 'name'

// 캐릭터 목록: 능력자 파일 서랍 장면. 보유 여부·레벨·역할·속성(데이터) 기준으로 정렬·필터
export default function Characters(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const [role, setRole] = useState<RoleFilter>('all')
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [sort, setSort] = useState<Sort>('level')

  const list = useMemo(() => {
    let l = CHARACTERS.filter((c) => (role === 'all' || c.role === role) && (!ownedOnly || s.owned[c.id]))
    l = [...l].sort((a, b) => {
      const oa = s.owned[a.id], ob = s.owned[b.id]
      if (!!oa !== !!ob) return oa ? -1 : 1
      if (sort === 'level') return (ob?.level ?? 0) - (oa?.level ?? 0) || b.rarity - a.rarity
      if (sort === 'rarity') return b.rarity - a.rarity || (ob?.level ?? 0) - (oa?.level ?? 0)
      if (sort === 'power') return charPower(s, b.id) - charPower(s, a.id)
      return a.name.localeCompare(b.name, 'ko')
    })
    return l
  }, [role, ownedOnly, sort, s])

  return (
    <div className="scr chars">
      <div className="chars-bg" aria-hidden><span>ABILITY FILES</span></div>
      <TopBar title="캐릭터" sub="ABILITY FILES" />
      <div className="chars-filters">
        <Tabs<RoleFilter> value={role} onChange={setRole} items={[{ id: 'all', label: '전체' }, { id: 'attack', label: '공격' }, { id: 'defense', label: '방어' }, { id: 'ability', label: '능력' }, { id: 'support', label: '지원' }]} />
        <div className="chars-right">
          <label className="toggle"><input type="checkbox" checked={ownedOnly} onChange={(e) => { audio.sfx('tap'); setOwnedOnly(e.target.checked) }} /><span>보유만</span></label>
          <select value={sort} onChange={(e) => { audio.sfx('tap'); setSort(e.target.value as Sort) }} aria-label="정렬">
            <option value="level">레벨순</option>
            <option value="rarity">희귀도순</option>
            <option value="power">전투력순</option>
            <option value="name">이름순</option>
          </select>
        </div>
      </div>
      <div className="chars-grid scroll-y">
        {list.length === 0 && <EmptyState title="조건에 맞는 캐릭터가 없습니다" desc="필터를 바꿔 보세요." />}
        {list.map((c, i) => {
          const o = s.owned[c.id]
          return (
            <button key={c.id} className={`ccard ${o ? '' : 'unowned'}`} style={{ ['--a' as string]: c.accent, animationDelay: `${i * 35}ms` }} onClick={() => { audio.sfx('tap'); nav.push('characterDetail', { id: c.id }) }}>
              <div className="ccard-art"><img src={c.assets.stand} alt="" loading="lazy" /></div>
              <div className="ccard-tab">{c.nameEn}</div>
              <div className="ccard-info">
                <div className="ccard-row"><span className="ccard-role"><RoleGlyph role={c.role} size="1.6rem" /></span><strong>{c.name}</strong></div>
                <div className="ccard-row small"><Stars n={c.rarity} /><span>{ATTRIBUTE_LABEL[c.attribute]} · {ROLE_LABEL[c.role]}</span></div>
                <div className="ccard-row small num">{o ? <>Lv.{o.level} · 전투력 {fmt(charPower(s, c.id))}</> : <span className="ccard-unowned">미보유</span>}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
