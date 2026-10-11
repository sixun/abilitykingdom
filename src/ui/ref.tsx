// 원본 화면 재현용 공통 요소.
// - 원본 좌표(px) 그대로 고정 캔버스에 배치하고, 캔버스 전체에 단일 배율만 적용한다(cover·개별 스트레치 금지, 여백 검정).
// - 원본 조각은 이미지에 글자가 구워져 있으므로, 동적으로 바뀐 부분만 글자 없는 스킨 + 실제 텍스트로 덮는다.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import '../styles/ref.css'
import { audio } from '../app/audio'

export interface RefLayer { id: string; x: number; y: number; width: number; height: number; group: string; file: string }
export interface RefLayout { canvas: { width: number; height: number }; layers: RefLayer[] }
export interface Rect { x: number; y: number; w: number; h: number }

export const rectOf = (layout: RefLayout, id: string): Rect => {
  const l = layout.layers.find((x) => x.id === id)
  if (!l) throw new Error(`layer ${id}`)
  return { x: l.x, y: l.y, w: l.width, h: l.height }
}
export const boxStyle = (r: Rect, extra?: CSSProperties): CSSProperties => ({ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, ...extra })

/** 화면 크기에 맞춰 캔버스 전체를 같은 배율로 축소/확대. 남는 영역은 검정 */
export function RefStage({ canvas, children, className = '', onPointerUp }: { canvas: { width: number; height: number }; children: ReactNode; className?: string; onPointerUp?: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [fitv, setFit] = useState({ scale: 0, x: 0, y: 0 })
  const scale = fitv.scale
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    // 정수 픽셀 위치에 놓아야 배율 1에서 원본과 픽셀 단위로 일치한다
    const fit = () => {
      const sc = Math.min(el.clientWidth / canvas.width, el.clientHeight / canvas.height)
      setFit({ scale: sc, x: Math.round((el.clientWidth - canvas.width * sc) / 2), y: Math.round((el.clientHeight - canvas.height * sc) / 2) })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [canvas.width, canvas.height])
  return (
    <div className={`ref-host ${className}`} ref={host} onPointerUp={onPointerUp}>
      <div className="ref-canvas" style={{ width: canvas.width, height: canvas.height, transform: `translate(${fitv.x}px, ${fitv.y}px) scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

/** layout의 조각을 원위치에 그린다. hide에 있는 조각은 숨긴다(그 자리는 아래층이 보인다) */
export function RefLayers({ layout, ids, hide, z = 1, className = '', style }: { layout: RefLayout; ids?: string[]; hide?: Set<string>; z?: number; className?: string; style?: CSSProperties }) {
  const list = ids ? layout.layers.filter((l) => ids.includes(l.id)) : layout.layers
  return (
    <>
      {list.map((l) => (
        <img
          key={l.id}
          src={l.file}
          alt=""
          draggable={false}
          className={`ref-layer ${className}`}
          data-layer={l.id}
          style={{ left: l.x, top: l.y, width: l.width, height: l.height, zIndex: z, visibility: hide?.has(l.id) ? 'hidden' : undefined, ...style }}
        />
      ))}
    </>
  )
}

/** 원본 조각 경계에 맞춘 투명 버튼 */
export function Hit({ r, label, onClick, z = 50, className = '', children, disabled, sfx = 'tap', style }: { r: Rect; label: string; onClick: () => void; z?: number; className?: string; children?: ReactNode; disabled?: boolean; sfx?: 'tap' | 'select' | 'none'; style?: CSSProperties }) {
  return (
    <button
      type="button"
      className={`ref-hit ${className}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      style={boxStyle(r, { zIndex: z, ...style })}
      onClick={(e) => { e.stopPropagation(); if (sfx !== 'none') audio.sfx(sfx); onClick() }}
    >
      {children}
    </button>
  )
}

/** 원본 조각 위를 덮는 동적 영역(바탕색 + 스킨 + 실제 텍스트) */
export function Patch({ r, bg, skin, z = 30, className = '', children, style }: { r: Rect; bg?: string; skin?: string; z?: number; className?: string; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div className={`ref-patch ${className}`} style={boxStyle(r, { zIndex: z, background: bg, ...style })}>
      {skin && <img className="ref-skin" src={skin} alt="" draggable={false} />}
      {children}
    </div>
  )
}

/** 원본에서 글자·알림만 지운 근사 패치(tools/make_textless.py). show일 때만 덮고 children(실제 텍스트)을 올린다 */
export interface TextlessMeta { x: number; y: number; w: number; h: number; file: string; sprite?: string }
export function TextlessPatch({ m, z = 30, children, className = '', style }: { m: TextlessMeta; z?: number; children?: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`ref-patch ${className}`} style={boxStyle({ x: m.x, y: m.y, w: m.w, h: m.h }, { zIndex: z, ...style })}>
      <img className="ref-skin" src={m.file} alt="" draggable={false} />
      {children}
    </div>
  )
}

/** 사용자가 동작 줄이기를 켰는지(OS 설정 또는 앱 설정) */
export function useReducedMotion(appSetting: boolean) {
  const [os, setOs] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const q = matchMedia('(prefers-reduced-motion: reduce)'); const f = () => setOs(q.matches)
    q.addEventListener('change', f); return () => q.removeEventListener('change', f)
  }, [])
  return os || appSetting
}

export const SKIN = (n: string) => `ref/ui/skins/${n}.svg`
export const ICON = (n: string) => `ref/ui/icons/${n}.svg`

export function useNow(ms: number) {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => { const i = setInterval(() => setT(Date.now()), ms); return () => clearInterval(i) }, [ms])
  return t
}
