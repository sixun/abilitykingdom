import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import '../styles/carousel.css'
import { audio } from '../app/audio'
import { useReduceMotion, useScreenActive } from './motion'

export type BannerSlide = { id: string; label: string; art: ReactNode; onOpen: () => void }

// 로비 배너 슬라이드(캐러셀). 원본 캔버스 좌표.
// - 자동 넘김(첫 장 6초, 이후 5초), 마우스를 올리거나 다른 화면이 위에 있으면 멈춤
// - 끌어서 넘기기(40px 이상), 점 눌러 이동, 누르면 그 배너의 화면으로
// - 넘길 때: 판이 미끄러지고 안의 그림은 덜 움직이는 시차 + 사선 빛, 점은 남은 시간만큼 차오름
export function BannerCarousel({ x, y, w, h, mask, slides, interval = 5000, firstDelay = 6000, dotsY }: { x: number; y: number; w: number; h: number; mask?: string; slides: BannerSlide[]; interval?: number; firstDelay?: number; dotsY: number }) {
  const [i, setI] = useState(0)
  const [hover, setHover] = useState(false)
  const [drag, setDrag] = useState(0)
  const [tick, setTick] = useState(0) // 넘길 때마다 증가(빛 연출 다시 재생)
  const active = useScreenActive()
  const reduce = useReduceMotion()
  const start = useRef<number | null>(null)
  const moved = useRef(false)
  const n = slides.length
  const go = (k: number) => { setI(((k % n) + n) % n); setTick((t) => t + 1) }

  const running = n > 1 && active && !hover && !reduce && start.current === null
  useEffect(() => {
    if (!running) return
    const t = window.setTimeout(() => go(i + 1), tick === 0 ? firstDelay : interval)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, i, tick])

  const maskStyle: CSSProperties = mask ? { WebkitMaskImage: `url("${mask}")`, maskImage: `url("${mask}")`, WebkitMaskSize: `${w}px auto`, maskSize: `${w}px auto`, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' } : {}
  return (
    <div className="bc" style={{ left: x, top: y, width: w, height: dotsY - y + 18 }}
      onPointerEnter={() => setHover(true)} onPointerLeave={() => { setHover(false); start.current = null; setDrag(0) }}
      onPointerDown={(e) => { start.current = e.clientX; moved.current = false }}
      onPointerMove={(e) => { if (start.current === null) return; const d = (e.clientX - start.current) / (e.currentTarget.getBoundingClientRect().width / w); if (Math.abs(d) > 6) moved.current = true; setDrag(Math.max(-w * .6, Math.min(w * .6, d))) }}
      onPointerUp={() => { if (start.current !== null && Math.abs(drag) > 40) { audio.sfx('swap'); go(drag < 0 ? i + 1 : i - 1) } start.current = null; setDrag(0) }}>
      <div className="bc-view" style={{ width: w, height: h, ...maskStyle }}>
        <div className={`bc-track ${drag ? 'dragging' : ''}`} style={{ transform: `translateX(${-i * w + drag}px)` }}>
          {slides.map((s, k) => (
            <div key={s.id} className={`bc-slide ${k === i ? 'on' : ''}`} style={{ left: k * w, width: w, height: h }} aria-hidden={k !== i}>
              <div className="bc-inner" style={{ translate: `${(k - i) * -0.32 * w}px 0` }}>{s.art}</div>
            </div>
          ))}
        </div>
        {tick > 0 && <i className="bc-wipe" key={tick} aria-hidden />}
        <i className="bc-sheen" aria-hidden />
      </div>
      <button type="button" className="bc-hit" style={{ width: w, height: h }} aria-label={slides[i].label}
        onClick={() => { if (moved.current) { moved.current = false; return } audio.sfx('tap'); slides[i].onOpen() }} />
      {n > 1 && (
        <div className="bc-dots" style={{ top: dotsY - y }} role="tablist" aria-label="배너 선택">
          {slides.map((s, k) => (
            <button type="button" role="tab" key={s.id} aria-selected={k === i} aria-label={`배너 ${k + 1}: ${s.label}`} className={k === i ? 'on' : ''}
              onClick={(e) => { e.stopPropagation(); if (k !== i) { audio.sfx('select'); go(k) } }}>
              {k === i && <i key={`${tick}-${running}`} className={running ? 'run' : ''} style={{ animationDuration: `${tick === 0 ? firstDelay : interval}ms` }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
