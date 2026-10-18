import { useEffect, useState } from 'react'
import '../styles/screens.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import { PRODUCTS, PRODUCT_BY_ID } from '../game/data/catalog'
import type { ShopProduct, CurrencyId } from '../game/types'
import { CURRENCY_LABEL } from '../game/config'
import { TopBar, Tabs, Btn, Modal, RewardChip, fmt, useAction, ErrorBanner, EmptyState, ProvisionalTag } from '../ui/components'
import { CurrencyGlyph } from '../ui/icons'

type Tab = ShopProduct['tab']
const TAB_CUR: Record<Tab, CurrencyId[]> = { recommend: ['diamond', 'ticket'], package: ['diamond'], currency: ['diamond', 'credit', 'stamina'], exchange: ['scoutPoint', 'exchangeMedal'] }

// 상점: 상품을 비교하는 공간(편의점 장면). 가격·구성은 임시. 실결제 미연동.
export default function Shop({ params }: { params: Record<string, unknown> }) {
  useEffect(() => { const prev = audio.currentBgm; audio.bgm('shop'); return () => audio.bgm(prev === 'shop' ? 'lobby' : prev) }, [])
  const s = useGame()
  const nav = useNav()
  const [tab, setTab] = useState<Tab>((params.tab as Tab) ?? 'recommend')
  const [confirm, setConfirm] = useState<string | null>(null)
  const { run, pending, failed, clearFailed } = useAction()
  const list = PRODUCTS.filter((p) => p.tab === tab)

  const buy = async (id: string) => {
    const res = await run(`buy:${id}`, (rid) => game.purchase(id, rid))
    if (res?.ok) { audio.sfx('coin'); setConfirm(null); nav.toast(`${PRODUCT_BY_ID[id].name} 구매 완료`, 'ok') }
  }

  const p = confirm ? PRODUCT_BY_ID[confirm] : null
  return (
    <div className="scr shop">
      <div className="shop-bg"><img src="assets/bg/shop.webp" alt="" /></div>
      <TopBar title="상점" sub="CONVENIENCE STORE" currencies={TAB_CUR[tab]} />
      <div className="shop-tabs">
        <Tabs<Tab> value={tab} onChange={setTab} items={[{ id: 'recommend', label: '추천' }, { id: 'package', label: '패키지' }, { id: 'currency', label: '재화' }, { id: 'exchange', label: '교환소' }]} />
        <ProvisionalTag>상품·가격은 임시 샘플</ProvisionalTag>
      </div>
      <div className="shop-grid scroll-y" key={tab}>
        {list.length === 0 && <EmptyState title="판매 중인 상품이 없습니다" />}
        {list.map((prod, i) => {
          const bought = game.purchasedCount(prod.id)
          const soldOut = prod.limit !== null && bought >= prod.limit
          const real = prod.price.type === 'real'
          return (
            <button key={prod.id} className={`pcard ${soldOut ? 'soldout' : ''} ${real ? 'real' : ''}`} style={{ animationDelay: `${i * 45}ms` }} onClick={() => { audio.sfx('tap'); setConfirm(prod.id) }}>
              {prod.badge && <span className="pcard-badge">{prod.badge}</span>}
              <div className="pcard-contents">
                {prod.contents.slice(0, 3).map((c, k) => <RewardChip key={k} r={{ kind: c.kind, id: c.id, qty: c.qty }} compact />)}
              </div>
              <strong className="pcard-name">{prod.name}</strong>
              {prod.desc && <span className="pcard-desc">{prod.desc}</span>}
              <div className="pcard-meta">
                <span>{prod.limit !== null ? `구매 ${bought}/${prod.limit}` : '제한 없음'}</span>
                {prod.endsAt && <span>~{prod.endsAt.slice(5).replace('-', '.')}</span>}
              </div>
              <div className="pcard-price">
                {soldOut ? '구매 완료' : prod.price.type === 'real' ? <>₩{fmt(prod.price.krw)}</> : <><CurrencyGlyph id={prod.price.currency} size="2.2rem" />{fmt(prod.price.amount)}</>}
              </div>
            </button>
          )
        })}
      </div>

      {p && (
        <Modal onClose={() => { setConfirm(null); clearFailed() }} labelledBy="buy-title">
          <h2 id="buy-title">{p.name}</h2>
          <div className="buy-contents">{p.contents.map((c, k) => <RewardChip key={k} r={{ kind: c.kind, id: c.id, qty: c.qty }} />)}</div>
          <div className="confirm-body">
            {p.price.type === 'real' ? (
              <p>실결제는 아직 연동되지 않았습니다. 플랫폼·상품·영수증 검증 방식이 정해지면 연결합니다. (표시 가격 ₩{fmt(p.price.krw)}은 임시)</p>
            ) : (
              <p>{CURRENCY_LABEL[p.price.currency]} {fmt(p.price.amount)}을(를) 사용합니다. 보유: {fmt(s.wallet[p.price.currency])}</p>
            )}
            {p.limit !== null && <p>구매 가능 {Math.max(0, p.limit - game.purchasedCount(p.id))}회 남음</p>}
          </div>
          {failed && <ErrorBanner error={failed.error} onRetry={() => buy(p.id)} onClose={clearFailed} />}
          <div className="confirm-actions">
            <Btn variant="ghost" onClick={() => { setConfirm(null); clearFailed() }}>취소</Btn>
            <Btn variant="primary" disabled={p.price.type === 'real' || !!pending || (p.limit !== null && game.purchasedCount(p.id) >= p.limit)} onClick={() => buy(p.id)}>
              {p.price.type === 'real' ? '결제 미연동' : pending ? '처리 중…' : '구매'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
