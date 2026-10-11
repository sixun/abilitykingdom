import { useCallback, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { useGame } from '../game/store'
import { CURRENCY_LABEL } from '../game/config'
import { ITEM_BY_ID } from '../game/data/catalog'
import { CHAR_BY_ID } from '../game/data/characters'
import type { CurrencyId, Reward } from '../game/types'
import type { Result, ServiceError } from '../game/service'
import { newRequestId } from '../game/service'
import { IconBack, CurrencyGlyph, ItemGlyph, IconPlus } from './icons'

export const fmt = (n: number) => n.toLocaleString('ko-KR')

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'dark' | 'ghost' | 'light' | 'accent' | 'danger'; sfx?: 'tap' | 'select' | 'none'; size?: 'sm' | 'md' | 'lg' }
export function Btn({ variant = 'dark', sfx = 'tap', size = 'md', className = '', onClick, children, ...rest }: BtnProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      onClick={(e) => { if (sfx !== 'none') audio.sfx(sfx); onClick?.(e) }}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Dot({ show, tone = 'red' }: { show: boolean; tone?: 'red' | 'lime' }) {
  if (!show) return null
  return <span className={`dot dot-${tone}`} aria-label="새 알림" />
}

export function Stars({ n, max }: { n: number; max?: number }) {
  return (
    <span className="stars" aria-label={`${n}성`}>
      {Array.from({ length: max ?? n }, (_, i) => <span key={i} className={i < n ? 'on' : 'off'}>★</span>)}
    </span>
  )
}

export function CurrencyChip({ id, onAdd }: { id: CurrencyId; onAdd?: () => void }) {
  const s = useGame()
  const v = s.wallet[id] ?? 0
  return (
    <div className="cur-chip" title={CURRENCY_LABEL[id]}>
      <CurrencyGlyph id={id} size="1.9rem" />
      <span className="cur-val">{fmt(v)}{id === 'stamina' ? <small>/120</small> : null}</span>
      {onAdd && <button className="cur-add" aria-label={`${CURRENCY_LABEL[id]} 충전`} onClick={() => { audio.sfx('tap'); onAdd() }}><IconPlus size="1.4rem" /></button>}
    </div>
  )
}

/** 공통 상단: 돌아가기 · 화면명 · 필요한 재화만 */
export function TopBar({ title, sub, currencies = [], right, onBack, tone = 'dark' }: { title: string; sub?: string; currencies?: CurrencyId[]; right?: ReactNode; onBack?: () => void; tone?: 'dark' | 'light' }) {
  const nav = useNav()
  return (
    <header className={`topbar topbar-${tone}`}>
      <button className="back-btn" aria-label="돌아가기" onClick={() => { audio.sfx('tap'); (onBack ?? nav.back)() }}><IconBack size="2.4rem" /></button>
      <div className="topbar-title">
        <h1>{title}</h1>
        {sub && <span className="topbar-sub">{sub}</span>}
      </div>
      <div className="topbar-right">
        {right}
        {currencies.map((c) => <CurrencyChip key={c} id={c} onAdd={c === 'diamond' || c === 'ticket' || c === 'stamina' ? () => nav.push('shop', { tab: c === 'diamond' ? 'currency' : c === 'stamina' ? 'currency' : 'recommend' }) : undefined} />)}
      </div>
    </header>
  )
}

export function rewardLabel(r: Reward) {
  if (r.kind === 'currency') return CURRENCY_LABEL[r.id] ?? r.id
  if (r.id.startsWith('char:')) return CHAR_BY_ID[r.id.slice(5)]?.name ?? r.id
  return ITEM_BY_ID[r.id]?.name ?? r.id
}

export function RewardChip({ r, compact }: { r: Reward; compact?: boolean }) {
  const isChar = r.id.startsWith('char:')
  return (
    <div className={`reward-chip ${compact ? 'compact' : ''}`} title={rewardLabel(r)}>
      <div className="reward-icon">
        {r.kind === 'currency' ? <CurrencyGlyph id={r.id} size="70%" /> : isChar ? <img src={CHAR_BY_ID[r.id.slice(5)].assets.portrait} alt="" /> : <ItemGlyph icon={ITEM_BY_ID[r.id]?.icon ?? ''} size="62%" />}
        <span className="reward-qty">{r.qty >= 1000 ? `${Math.round(r.qty / 100) / 10}K` : `×${r.qty}`}</span>
      </div>
      {!compact && <span className="reward-name">{rewardLabel(r)}</span>}
    </div>
  )
}

export function Modal({ children, onClose, className = '', labelledBy }: { children: ReactNode; onClose?: () => void; className?: string; labelledBy?: string }) {
  return (
    <div className="modal-back" onClick={(e) => { if (e.target === e.currentTarget && onClose) { audio.sfx('tap'); onClose() } }}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{children}</div>
    </div>
  )
}

export function ConfirmDialog({ title, body, actions }: { title: string; body: ReactNode; actions: { label: string; onClick: () => void; variant?: BtnProps['variant'] }[] }) {
  return (
    <Modal className="confirm">
      <h2 id="dlg-title">{title}</h2>
      <div className="confirm-body">{body}</div>
      <div className="confirm-actions">
        {actions.map((a) => <Btn key={a.label} variant={a.variant ?? 'dark'} onClick={a.onClick}>{a.label}</Btn>)}
      </div>
    </Modal>
  )
}

export function errorText(e: ServiceError): string {
  switch (e.code) {
    case 'INSUFFICIENT': {
      const name = CURRENCY_LABEL[e.currency] ?? (e.currency === 'exp' ? '경험치 재료' : ITEM_BY_ID[e.currency]?.name ?? e.currency)
      return `${name}이(가) 부족합니다. 필요 ${fmt(e.need)} / 보유 ${fmt(e.have)}`
    }
    case 'LIMIT_REACHED': return '구매 가능 횟수를 모두 사용했습니다.'
    case 'EXPIRED': return '기간이 종료되었습니다.'
    case 'INVALID': return e.message
    case 'VERSION_CONFLICT': return '다른 곳에서 먼저 변경되었습니다. 다시 불러와 주세요.'
    case 'NETWORK': return '요청에 실패했습니다. 같은 요청으로 다시 시도할 수 있습니다.'
    case 'NOT_SUPPORTED': return e.message
  }
}

/**
 * 요청 실행 도우미. 진행 중 연타를 막고, 실패 시 같은 requestId로 재시도한다.
 * 성공하면 다음 요청을 위해 새 requestId를 만든다.
 */
export function useAction() {
  const [pending, setPending] = useState<string | null>(null)
  const [failed, setFailed] = useState<{ key: string; error: ServiceError } | null>(null)
  const ids = useRef<Record<string, string>>({})
  const busy = useRef(false)
  const run = useCallback(async <T,>(key: string, fn: (requestId: string) => Promise<Result<T>>): Promise<Result<T> | null> => {
    if (busy.current) return null
    busy.current = true
    setPending(key)
    const rid = ids.current[key] ?? (ids.current[key] = newRequestId())
    try {
      const res = await fn(rid)
      if (res.ok) { delete ids.current[key]; setFailed(null) }
      else {
        if (res.error.code !== 'NETWORK') delete ids.current[key]
        setFailed({ key, error: res.error })
        audio.sfx('error')
      }
      return res
    } finally {
      busy.current = false
      setPending(null)
    }
  }, [])
  return { run, pending, failed, clearFailed: () => setFailed(null) }
}

export function ErrorBanner({ error, onRetry, onClose }: { error: ServiceError; onRetry?: () => void; onClose: () => void }) {
  return (
    <div className="error-banner" role="alert">
      <span>{errorText(error)}</span>
      {error.code === 'NETWORK' && onRetry && <Btn size="sm" variant="light" onClick={onRetry}>재시도</Btn>}
      <Btn size="sm" variant="ghost" onClick={onClose}>닫기</Btn>
    </div>
  )
}

export function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-mark" />
      <strong>{title}</strong>
      {desc && <p>{desc}</p>}
      {action}
    </div>
  )
}

export function Tabs<T extends string>({ items, value, onChange, tone = 'dark' }: { items: { id: T; label: string; dot?: boolean }[]; value: T; onChange: (v: T) => void; tone?: 'dark' | 'light' }) {
  return (
    <div className={`tabs tabs-${tone}`} role="tablist">
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={value === it.id} className={value === it.id ? 'on' : ''} onClick={() => { if (it.id !== value) { audio.sfx('select'); onChange(it.id) } }}>
          {it.label}
          <Dot show={!!it.dot} />
        </button>
      ))}
    </div>
  )
}

export function Bg({ src, dim = 0, blur = 0, className = '' }: { src: string; dim?: number; blur?: number; className?: string }) {
  return (
    <div className={`bg-layer ${className}`} aria-hidden>
      <img src={src} alt="" style={{ filter: blur ? `blur(${blur}px)` : undefined }} />
      {dim > 0 && <div className="bg-dim" style={{ opacity: dim }} />}
    </div>
  )
}

export function ProvisionalTag({ children = '임시' }: { children?: ReactNode }) {
  return <span className="prov-tag">{children}</span>
}
