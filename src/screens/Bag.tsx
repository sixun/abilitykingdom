import { useMemo, useState } from 'react'
import '../styles/screens.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import { ITEM_BY_ID } from '../game/data/catalog'
import { CHAR_BY_ID } from '../game/data/characters'
import type { ItemCategory } from '../game/types'
import { TopBar, Tabs, Btn, Stars, useAction, ErrorBanner, EmptyState, rewardLabel } from '../ui/components'
import { ItemGlyph, IconLock } from '../ui/icons'

// 가방: 실제 지원하는 행동만 노출(소모품 사용, 장비 잠금·장착 위치 확인)
export default function Bag(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const [tab, setTab] = useState<ItemCategory>('equipment')
  const items = useMemo(() => s.inventory.filter((e) => ITEM_BY_ID[e.itemId]?.category === tab).sort((a, b) => ITEM_BY_ID[b.itemId].rarity - ITEM_BY_ID[a.itemId].rarity), [s.inventory, tab])
  const [sel, setSel] = useState<string | null>(null)
  const { run, pending, failed, clearFailed } = useAction()
  const selected = items.find((e) => e.itemId === sel) ?? items[0]
  const def = selected ? ITEM_BY_ID[selected.itemId] : null
  const equippedBy = def ? Object.values(s.owned).filter((o) => Object.values(o.equipment).includes(def.id)).map((o) => CHAR_BY_ID[o.id].name) : []

  const use = async () => {
    if (!def) return
    const res = await run(`use:${def.id}`, (rid) => game.useItem(def.id, rid))
    if (res?.ok) { audio.sfx('coin'); nav.toast(`${def.name} 사용: ${res.value.rewards.map((r) => `${rewardLabel(r)} +${r.qty}`).join(', ')}`, 'ok') }
  }

  return (
    <div className="scr bag">
      <TopBar title="가방" sub="INVENTORY" currencies={['credit', 'stamina']} />
      <div className="bag-tabs"><Tabs<ItemCategory> value={tab} onChange={(t) => { setTab(t); setSel(null) }} items={[{ id: 'equipment', label: '장비' }, { id: 'consumable', label: '소모품' }, { id: 'material', label: '재료' }]} /></div>
      <div className="bag-grid scroll-y" key={tab}>
        {items.length === 0 && <EmptyState title="아이템이 없습니다" desc="콘텐츠 보상과 상점에서 얻을 수 있습니다." />}
        {items.map((e, i) => {
          const d = ITEM_BY_ID[e.itemId]
          return (
            <button key={e.itemId} className={`bag-cell rar${d.rarity} ${selected?.itemId === e.itemId ? 'on' : ''}`} style={{ animationDelay: `${i * 25}ms` }} onClick={() => { audio.sfx('tap'); setSel(e.itemId) }} aria-label={`${d.name} ${e.qty}개`}>
              <ItemGlyph icon={d.icon} size="4rem" />
              <span className="bag-qty num">×{e.qty}</span>
              {e.locked && <span className="bag-lock"><IconLock size="1.4rem" /></span>}
            </button>
          )
        })}
      </div>
      <aside className="bag-detail">
        {def && selected ? (
          <>
            <div className={`bag-big rar${def.rarity}`}><ItemGlyph icon={def.icon} size="7rem" /></div>
            <h2>{def.name}</h2>
            <Stars n={def.rarity} max={5} />
            <p className="bag-desc">{def.desc}</p>
            <dl className="cd-dl">
              <dt>보유</dt><dd className="num">{selected.qty}개</dd>
              {def.category === 'equipment' && <><dt>장착</dt><dd>{equippedBy.length ? equippedBy.join(', ') : '없음'}</dd></>}
            </dl>
            {failed && <ErrorBanner error={failed.error} onRetry={use} onClose={clearFailed} />}
            <div className="bag-actions">
              {def.use && <Btn variant="primary" disabled={!!pending} onClick={use}>사용</Btn>}
              {def.category === 'equipment' && <Btn variant="dark" onClick={() => { audio.sfx('tap'); game.setItemLock(def.id, !selected.locked) }}><IconLock size="1.8rem" />{selected.locked ? '잠금 해제' : '잠금'}</Btn>}
              {def.category === 'equipment' && <Btn variant="dark" onClick={() => nav.push('characters')}>캐릭터에서 장착</Btn>}
              {def.expValue && <Btn variant="dark" onClick={() => nav.push('characters')}>성장에 사용</Btn>}
            </div>
          </>
        ) : <EmptyState title="아이템을 선택하세요" />}
      </aside>
    </div>
  )
}
