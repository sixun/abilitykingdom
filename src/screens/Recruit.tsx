import { useState } from 'react'
import '../styles/recruit.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import { BANNERS, BANNER_BY_ID } from '../game/data/catalog'
import { CHAR_BY_ID } from '../game/data/characters'
import { GAME_CONFIG, ROLE_LABEL, ATTRIBUTE_LABEL } from '../game/config'
import { TopBar, Btn, Modal, Stars, useAction, ErrorBanner, fmt, ProvisionalTag } from '../ui/components'
import { CurrencyGlyph, IconInfo, IconDoc, IconCart, IconHistory, RoleGlyph } from '../ui/icons'

// 영입 공통 구조 + 스킨 교체. 최종 영입 디자인(4개 후보)은 미정이므로 'broadcast'/'platform' 스킨만 구현.
export default function Recruit({ params }: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const [kind, setKind] = useState<'limited' | 'standard'>(BANNER_BY_ID[(params.bannerId as string) ?? 'b_rion']?.kind ?? 'limited')
  const [bannerId, setBannerId] = useState<string>((params.bannerId as string) ?? 'b_rion')
  const [modal, setModal] = useState<null | 'detail' | 'rates'>(null)
  const { run, pending, failed, clearFailed } = useAction()
  const b = BANNER_BY_ID[bannerId]
  const f = CHAR_BY_ID[b.featuredId]
  const tickets = s.wallet.ticket
  const points = s.wallet.scoutPoint

  const pull = async (count: number) => {
    const res = await run(`pull${count}`, (rid) => game.recruit(bannerId, count, rid))
    if (res?.ok) { audio.sfx('open'); nav.push('recruitResult', { txId: res.value.requestId }) }
  }

  const listed = BANNERS.filter((x) => x.kind === kind)
  const selectKind = (k: 'limited' | 'standard') => { setKind(k); const first = BANNERS.find((x) => x.kind === k); if (first) setBannerId(first.id) }

  return (
    <div className={`scr rc skin-${b.skin}`} style={{ ['--a' as string]: f.accent }}>
      <div className="rc-bg" key={bannerId}>
        <img src={b.skin === 'broadcast' ? 'assets/bg/recruit.webp' : 'assets/bg/platform.webp'} alt="" />
        <div className="rc-bg-shade" />
      </div>
      <div className="rc-visual" key={`v${bannerId}`}>
        <img className="rc-fig" src={f.assets.action} alt="" />
      </div>

      <TopBar title="영입" sub="SCOUTING" currencies={['ticket', 'diamond']} />

      <div className="rc-kinds" role="tablist">
        <button role="tab" aria-selected={kind === 'limited'} className={kind === 'limited' ? 'on' : ''} onClick={() => { audio.sfx('select'); selectKind('limited') }}>한정 영입</button>
        <button role="tab" aria-selected={kind === 'standard'} className={kind === 'standard' ? 'on' : ''} onClick={() => { audio.sfx('select'); selectKind('standard') }}>상시 영입</button>
      </div>

      <aside className="rc-list">
        {listed.map((x) => {
          const fc = CHAR_BY_ID[x.featuredId]
          return (
            <button key={x.id} className={`rc-banner ${x.id === bannerId ? 'on' : ''}`} onClick={() => { audio.sfx('select'); setBannerId(x.id) }} style={{ ['--a' as string]: fc.accent }}>
              <img src={fc.assets.portrait} alt="" />
              <span className="rc-banner-tag">{x.kind === 'limited' ? '한정' : '상시'}</span>
              <span className="rc-banner-text"><strong>{x.title}</strong><small>{fc.name}</small></span>
            </button>
          )
        })}
      </aside>

      <section className="rc-copy" key={`c${bannerId}`}>
        <div className="rc-sub">{b.subtitle}</div>
        <h2 className="rc-title">{b.title}</h2>
        <div className="rc-pick">
          <span className="rc-role"><RoleGlyph role={f.role} size="2.4rem" /></span>
          <strong>{f.name}</strong>
          <Stars n={f.rarity} />
          <span className="rc-attr">{ROLE_LABEL[f.role]} · {ATTRIBUTE_LABEL[f.attribute]}</span>
        </div>
        <p className="rc-quote">“{b.quote}”</p>
        <p className="rc-period num">{b.end ? `${b.start.replace(/-/g, '.')} – ${b.end.replace(/-/g, '.')}` : '상시 진행'}</p>
        <div className="rc-meta-btns">
          <Btn size="sm" variant="dark" onClick={() => setModal('detail')}><IconInfo size="1.8rem" />상세 정보</Btn>
          <Btn size="sm" variant="dark" onClick={() => setModal('rates')}><IconDoc size="1.8rem" />확률 정보</Btn>
          <Btn size="sm" variant="dark" onClick={() => nav.push('recruitHistory')}><IconHistory size="1.8rem" />기록</Btn>
        </div>
      </section>

      <footer className="rc-bottom">
        <Btn variant="light" className="rc-exchange" onClick={() => nav.push('shop', { tab: 'exchange' })}><IconCart size="2.4rem" />교환소</Btn>
        <div className="rc-points">
          <span>영입 포인트 <ProvisionalTag>샘플</ProvisionalTag></span>
          <div className="rc-points-bar"><i style={{ width: `${Math.min(100, (points / GAME_CONFIG.scoutPointCap) * 100)}%` }} /></div>
          <b className="num">{fmt(points)} / {GAME_CONFIG.scoutPointCap}</b>
        </div>
        <div className="rc-pulls">
          <Btn variant="light" className="rc-pull1" disabled={!!pending} onClick={() => pull(1)}>
            <span>1회 영입</span><span className="rc-cost"><CurrencyGlyph id="ticket" size="2.4rem" />×{b.costPerPull.amount}</span>
          </Btn>
          <Btn variant="accent" className="rc-pull10" disabled={!!pending} onClick={() => pull(GAME_CONFIG.multiPullCount)}>
            <span>{GAME_CONFIG.multiPullCount}회 영입</span><span className="rc-cost"><CurrencyGlyph id="ticket" size="2.6rem" />×{b.costPerPull.amount * GAME_CONFIG.multiPullCount}</span>
          </Btn>
        </div>
      </footer>
      {pending && <div className="rc-pending">영입 처리 중…</div>}
      {failed && <div className="rc-error"><ErrorBanner error={failed.error} onRetry={() => pull(failed.key === 'pull1' ? 1 : GAME_CONFIG.multiPullCount)} onClose={clearFailed} /></div>}
      {failed?.error.code === 'INSUFFICIENT' && <div className="rc-error2"><Btn size="sm" variant="primary" onClick={() => nav.push('shop', { tab: 'recommend' })}>티켓 구매하러 가기</Btn></div>}

      {modal === 'detail' && (
        <Modal onClose={() => setModal(null)} labelledBy="rd-title">
          <h2 id="rd-title">{b.title} · 상세 정보</h2>
          <div className="confirm-body">
            <p>픽업: <b>{f.name}</b> ({f.rarity}★ · {ROLE_LABEL[f.role]})</p>
            <p>기간: {b.end ? `${b.start} ~ ${b.end}` : '상시'}</p>
            <p>비용: 영입 티켓 1장 / 1회 · {GAME_CONFIG.multiPullCount}회 영입은 {GAME_CONFIG.multiPullCount}장</p>
            <p>{b.kind === 'limited' ? `영입 1회당 영입 포인트 10 적립. 포인트 ${GAME_CONFIG.scoutPointCap}으로 교환소에서 픽업 캐릭터 교환(샘플).` : '상시 영입은 포인트가 적립되지 않습니다(샘플).'}</p>
            <p className="muted">천장·중복 전환·보장 규칙은 아직 정해지지 않았습니다. 이 프로토타입의 결과는 기기에서 계산되며 운영용이 아닙니다.</p>
            <h3>영입 대상</h3>
            <div className="rd-pool">{b.pool.map((id) => <span key={id}><img src={CHAR_BY_ID[id].assets.portrait} alt="" />{CHAR_BY_ID[id].name} {CHAR_BY_ID[id].rarity}★</span>)}</div>
          </div>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setModal(null)}>닫기</Btn></div>
        </Modal>
      )}
      {modal === 'rates' && (
        <Modal onClose={() => setModal(null)} labelledBy="rr-title">
          <h2 id="rr-title">확률 정보 <ProvisionalTag>프로토타입 샘플 값</ProvisionalTag></h2>
          <table className="rate-table">
            <thead><tr><th>등급</th><th>확률</th><th>대상</th></tr></thead>
            <tbody>
              {b.rates.map((r) => {
                const ids = b.pool.filter((id) => CHAR_BY_ID[id].rarity === r.rarity)
                return (
                  <tr key={r.rarity}><td>{r.rarity}★</td><td className="num">{(r.rate * 100).toFixed(1)}%</td><td>{ids.map((id) => CHAR_BY_ID[id].name + (id === b.featuredId && b.pickupShare ? `(픽업 ${b.pickupShare * 100}%)` : '')).join(', ')}</td></tr>
                )
              })}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: '1.4rem', fontSize: '1.4rem' }}>실제 확률·천장·중복 처리는 기획 확정 후 서버에서 결정합니다.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setModal(null)}>닫기</Btn></div>
        </Modal>
      )}
    </div>
  )
}
