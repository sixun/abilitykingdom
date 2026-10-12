import { useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import { RefStage, type RefLayout } from './ref'
import { useReduceMotion, useScreenActive } from './motion'
import '../styles/ui-motion.css'

const FINE_POINTER = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches

/** Screen-local choreography. Background tabs and covered screens stop their loops.
 *  Mouse position drives a small parallax on scene layers only (--mx, --my in -1..1); UI and hit targets never move with it. */
export function MotionStage({ className = '', children, ...props }: ComponentProps<typeof RefStage>) {
  const active = useScreenActive()
  const reduce = useReduceMotion()
  const [hidden, setHidden] = useState(document.hidden)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const sync = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  useEffect(() => {
    if (!FINE_POINTER || reduce || !active) return
    let raf = 0, mx = 0, my = 0
    const on = (e: PointerEvent) => {
      mx = Math.max(-1, Math.min(1, (e.clientX / innerWidth) * 2 - 1))
      my = Math.max(-1, Math.min(1, (e.clientY / innerHeight) * 2 - 1))
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0
        wrap.current?.style.setProperty('--mx', mx.toFixed(3))
        wrap.current?.style.setProperty('--my', my.toFixed(3))
      })
    }
    window.addEventListener('pointermove', on, { passive: true })
    return () => { window.removeEventListener('pointermove', on); cancelAnimationFrame(raf) }
  }, [reduce, active])
  return (
    <div className="ui-par" ref={wrap} style={{ display: 'contents' }}>
      <RefStage {...props} className={`ui-motion ${className} ${!active || hidden ? 'ui-paused' : ''} ${reduce ? 'ui-reduced' : ''}`}>
        {children}
        {/* 진입 연출: 어두운 막이 걷히며 사선 빛이 한 번 지나간다(입력 받지 않음) */}
        <div className="ui-intro" aria-hidden><i /></div>
      </RefStage>
    </div>
  )
}

type Box = { x: number; y: number; w: number; h: number }
export type GlintSpec = { src: string; r: Box }

/** 원본 조각 모양(알파)으로 잘린 반짝임. 조각 파일을 마스크로 써서 투명한 곳에는 빛이 지나가지 않는다 */
export function glintOf(layout: RefLayout, id: string, files?: Record<string, string>): GlintSpec | undefined {
  const l = layout.layers.find((x) => x.id === id)
  return l ? { src: files?.[id] ?? l.file, r: { x: l.x, y: l.y, w: l.width, h: l.height } } : undefined
}

export function Glint({ g, order = 0, className = '' }: { g: GlintSpec; order?: number; className?: string }) {
  const mask = `url("${g.src}")`
  return <i className={`ui-glint ${className}`} aria-hidden style={{ left: g.r.x, top: g.r.y, width: g.r.w, height: g.r.h, WebkitMaskImage: mask, maskImage: mask, '--ui-order': order } as CSSProperties} />
}

/** Keep the art, live labels and hit target together, in original canvas coordinates.
 *  Idle float moves only the art (never the hit button), so clicks stay exactly where they were. */
export function MotionItem({ children, order = 0, z = 2, className = '', glint, idle = true }: { children: ReactNode; order?: number; z?: number; className?: string; glint?: GlintSpec; idle?: boolean }) {
  return (
    <div className={`ui-item ${idle ? 'ui-idle' : ''} ${className}`} style={{ zIndex: z, '--ui-order': order, '--ui-delay': `${220 + order * 80}ms` } as CSSProperties}>
      <div className="ui-item-body">{children}{glint && <Glint g={glint} order={order} />}</div>
    </div>
  )
}

export function MotionTitle({ text, className = '' }: { text: string; className?: string }) {
  return <span className={`ui-title ${className}`} aria-label={text}>{Array.from(text).map((letter, i) => <span className="ui-letter-mask" aria-hidden key={i}><i style={{ '--letter-delay': `${120 + i * 32}ms`, '--letter-i': i } as CSSProperties}>{letter === ' ' ? ' ' : letter}</i></span>)}</span>
}

/** Two equal copies make the seam continuous; decoration never receives input. */
export function MotionTicker({ text, className = '' }: { text: string; className?: string }) {
  return <div className={`ui-ticker ${className}`} aria-hidden><div>{[0, 1].map((i) => <span key={i}>{text}<b> ✦ </b>{text}<b> ✦ </b></span>)}</div></div>
}

export function SceneCue({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="ui-scene-cue" aria-hidden><small>{subtitle}</small><MotionTitle text={title} /><i /></div>
}

/** 장면 위 공기: 떠다니는 입자 + 화면별 빛(창가 햇살, 지나가는 열차 불빛, 스캔선). 전부 CSS 반복 애니메이션 */
export function AmbientFx({ kind, box, count = 26, z = 5, clip }: { kind: 'dust' | 'city' | 'blue' | 'lime'; box: Box; count?: number; z?: number; clip?: string }) {
  const parts = useMemo(() => {
    let seed = kind.length * 9301 + count * 49297
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: count }, () => ({
      x: rnd() * 100, y: 25 + rnd() * 80, s: 2 + rnd() * (kind === 'dust' ? 5 : 4),
      d: 7 + rnd() * 9, dl: -rnd() * 16, dx: (rnd() - 0.5) * 120, rise: 140 + rnd() * 320, o: 0.35 + rnd() * 0.6,
    }))
  }, [kind, count])
  return (
    <div className={`ui-amb ui-amb-${kind}`} aria-hidden style={{ left: box.x, top: box.y, width: box.w, height: box.h, zIndex: z, clipPath: clip }}>
      <div className="ui-amb-light" />
      <div className="ui-amb-parts">
        {parts.map((p, i) => <i key={i} style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, '--d': `${p.d}s`, '--dl': `${p.dl}s`, '--dx': `${p.dx}px`, '--rise': `${-p.rise}px`, '--o': p.o } as CSSProperties} />)}
      </div>
      <div className="ui-amb-sweep" />
    </div>
  )
}

/** 고정 위치의 장식 효과(맥동 고리, 막대 반짝임 등). 입력 받지 않음 */
export function Fx({ r, className, z = 31, style }: { r: Box; className: string; z?: number; style?: CSSProperties }) {
  return <div className={`ui-fx ${className}`} aria-hidden style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: z, ...style }} />
}
