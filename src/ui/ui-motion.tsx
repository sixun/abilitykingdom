import { useEffect, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import { RefStage } from './ref'
import { useReduceMotion, useScreenActive } from './motion'
import '../styles/ui-motion.css'

/** Screen-local choreography. Background tabs and covered screens stop their loops. */
export function MotionStage({ className = '', ...props }: ComponentProps<typeof RefStage>) {
  const active = useScreenActive()
  const reduce = useReduceMotion()
  const [hidden, setHidden] = useState(document.hidden)
  useEffect(() => {
    const sync = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  return <RefStage {...props} className={`ui-motion ${className} ${!active || hidden ? 'ui-paused' : ''} ${reduce ? 'ui-reduced' : ''}`} />
}

/** Keep the art, live labels and hit target together, in original canvas coordinates. */
export function MotionItem({ children, order = 0, z = 2, className = '' }: { children: ReactNode; order?: number; z?: number; className?: string }) {
  return <div className={`ui-item ${className}`} style={{ zIndex: z, '--ui-delay': `${120 + order * 38}ms` } as CSSProperties}><div className="ui-item-body">{children}</div></div>
}

export function MotionTitle({ text, className = '' }: { text: string; className?: string }) {
  return <span className={`ui-title ${className}`} aria-label={text}>{Array.from(text).map((letter, i) => <span className="ui-letter-mask" aria-hidden key={i}><i style={{ '--letter-delay': `${120 + i * 32}ms` } as CSSProperties}>{letter === ' ' ? '\u00a0' : letter}</i></span>)}</span>
}

/** Two equal copies make the seam continuous; decoration never receives input. */
export function MotionTicker({ text, className = '' }: { text: string; className?: string }) {
  return <div className={`ui-ticker ${className}`} aria-hidden><div>{[0, 1].map((i) => <span key={i}>{text}<b> ✦ </b>{text}<b> ✦ </b></span>)}</div></div>
}

export function SceneCue({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="ui-scene-cue" aria-hidden><small>{subtitle}</small><MotionTitle text={title} /><i /></div>
}
