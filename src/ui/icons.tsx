import type { CSSProperties } from 'react'

type P = { size?: number | string; style?: CSSProperties; className?: string }
const box = (size: P['size']) => ({ width: size ?? '1em', height: size ?? '1em' })

const mk = (paths: JSX.Element, vb = '0 0 24 24') => ({ size, style, className }: P) => (
  <svg viewBox={vb} style={{ ...box(size), ...style }} className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {paths}
  </svg>
)

export const IconBack = mk(<path d="M15 4 7 12l8 8" />)
export const IconChevron = mk(<path d="m9 5 7 7-7 7" />)
export const IconChevronL = mk(<path d="m15 5-7 7 7 7" />)
export const IconPencil = mk(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>)
export const IconInfo = mk(<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>)
export const IconPlus = mk(<path d="M12 5v14M5 12h14" />)
export const IconClose = mk(<path d="M6 6l12 12M18 6 6 18" />)
export const IconCrown = mk(<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />)
export const IconMail = mk(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>)
export const IconBell = mk(<><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>)
export const IconGear = mk(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>)
export const IconCheck = mk(<path d="m5 12 5 5 9-10" />)
export const IconEye = mk(<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>)
export const IconEyeOff = mk(<><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3 3.6M6.6 6.6C3.7 8.5 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1" /></>)
export const IconSwap = mk(<><path d="M4 8h13l-3-3M20 16H7l3 3" /></>)
export const IconSave = mk(<><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h8V3M8 21v-7h8v7" /></>)
export const IconReset = mk(<><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /></>)
export const IconUsers = mk(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.6" /><path d="M16 14c2.8 0 5 2.2 5 5" /></>)
export const IconCart = mk(<><path d="M3 4h2l2.5 11h11L21 7H6.2" /><circle cx="9" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></>)
export const IconBag = mk(<><path d="M5 8h14l-1 13H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>)
export const IconPerson = mk(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>)
export const IconGrid = mk(<><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>)
export const IconSpark = mk(<path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" />)
export const IconGift = mk(<><rect x="3" y="9" width="18" height="12" rx="1" /><path d="M3 13h18M12 9v12M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z" /></>)
export const IconCalendar = mk(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>)
export const IconList = mk(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />)
export const IconFlag = mk(<><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>)
export const IconPause = mk(<path d="M8 5v14M16 5v14" />)
export const IconLock = mk(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>)
export const IconHistory = mk(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>)
export const IconDoc = mk(<><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h7M9 16h7M9 8h3" /></>)
export const IconSkip = mk(<><path d="M5 5l9 7-9 7zM18 5v14" /></>)
export const IconPin = mk(<><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>)
export const IconTarget = mk(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>)
export const IconBook = mk(<><path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></>)
export const IconDumbbell = mk(<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />)
export const IconSwords = mk(<><path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="M13 19l6-6M16 16l4 4M9.5 6.5 21 18" /><path d="M21 3v3l-4.5 4.5" /></>)
export const IconSkull = mk(<><path d="M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3z" /><circle cx="9" cy="11" r="1.5" /><circle cx="15" cy="11" r="1.5" /><path d="M10 20v-2M14 20v-2" /></>)
export const IconMap = mk(<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>)

// 역할 아이콘(데이터의 role 키와 1:1)
export const RoleGlyph = ({ role, size }: { role: string; size?: number | string }) => {
  const s = box(size)
  if (role === 'attack') return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M5 19 19 5M14 5h5v5M5 14l5 5M3 21l3-3" /></svg>
  if (role === 'defense') return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="M12 7v10" /></svg>
  if (role === 'ability') return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" /></svg>
  return <svg viewBox="0 0 24 24" style={s} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
}

export const CurrencyGlyph = ({ id, size }: { id: string; size?: number | string }) => {
  const s = box(size)
  switch (id) {
    case 'diamond': return <svg viewBox="0 0 24 24" style={s}><path d="M6 4h12l4 5-10 12L2 9z" fill="#8fb4ff" /><path d="M2 9h20M8 4l4 17 4-17" stroke="#3d5bd6" strokeWidth={1.2} fill="none" /></svg>
    case 'credit': return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" fill="#e7c55a" /><circle cx="12" cy="12" r="6.5" fill="none" stroke="#a7811b" strokeWidth={1.5} /><path d="M14 9.5a3 3 0 1 0 0 5" stroke="#7b5c06" strokeWidth={2} fill="none" strokeLinecap="round" /></svg>
    case 'ticket': return <svg viewBox="0 0 24 24" style={s}><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" fill="#e8d26b" stroke="#6b5b12" strokeWidth={1.2} /><path d="M9 8v8" stroke="#6b5b12" strokeDasharray="1.5 1.5" /></svg>
    case 'scoutPoint': return <svg viewBox="0 0 24 24" style={s}><path d="M12 2l2.5 7H22l-6 4.5 2.3 7.5L12 16.5 5.7 21 8 13.5 2 9h7.5z" fill="#c8f53b" stroke="#58700b" strokeWidth={1} /></svg>
    case 'exchangeMedal': return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="13" r="8" fill="#b9a2ff" stroke="#5b3fc4" strokeWidth={1.2} /><path d="M8 2h8l-2 4h-4z" fill="#5b3fc4" /><path d="M9 13h6M12 10v6" stroke="#2c1d6b" strokeWidth={1.6} /></svg>
    case 'stamina': return <svg viewBox="0 0 24 24" style={s}><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#5ee6c8" stroke="#126b5a" strokeWidth={1.2} strokeLinejoin="round" /></svg>
    default: return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="8" fill="#888" /></svg>
  }
}

export const ItemGlyph = ({ icon, size }: { icon: string; size?: number | string }) => {
  const s = box(size)
  const st = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (icon) {
    case 'chip': return <svg viewBox="0 0 24 24" style={s} {...st}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /><path d="M10 10h4v4h-4z" /></svg>
    case 'gear': return <svg viewBox="0 0 24 24" style={s} {...st}><path d="M6 4h12l2 5-3 2v9H7v-9L4 9z" /></svg>
    case 'weapon': return <svg viewBox="0 0 24 24" style={s} {...st}><path d="M4 20 16 8l2-4 2 2-4 2L4 20zM7 14l3 3" /></svg>
    case 'acc': return <svg viewBox="0 0 24 24" style={s} {...st}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></svg>
    case 'box': return <svg viewBox="0 0 24 24" style={s} {...st}><path d="M3 8l9-4 9 4v9l-9 4-9-4z" /><path d="M3 8l9 4 9-4M12 12v9" /></svg>
    case 'drink': return <svg viewBox="0 0 24 24" style={s} {...st}><path d="M8 3h8M9 3v3l-2 3v12h10V9l-2-3V3" /><path d="M11 12l-1 3h3l-1 3" /></svg>
    default: return <svg viewBox="0 0 24 24" style={s} {...st}><circle cx="12" cy="12" r="7" /></svg>
  }
}
