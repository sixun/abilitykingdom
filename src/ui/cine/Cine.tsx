import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { audio, type Sfx } from '../../app/audio'
import './cine.css'

// 시네마틱 타이포그래피(Monumental / Brutalist Location Title).
// 컷(shot)을 차례로 이어 붙이는 짧은 연출. 각 컷은 정해진 시간만 보이고 딱 끊긴다.
//  stack  : 굵은 기울임 글자를 2~4줄 쌓은 블록(화면 구석). 컷 인/아웃은 페이드 없이 끊는다
//  mono   : 화면 폭을 가득 채우는 거대한 한 단어 + 베이스 임팩트(번쩍·흔들림·잔상)
//  card   : 단색 화면 전체 + 큰 숫자(챕터 번호 등)
//  brutal : 컨트롤(Control)식 구역 이름. 어둡게 깔고 산세리프 대문자를 가로로 꽉 채운다
//  ticker : 위아래 띠에 큰 글자가 반대로 흐른다(장면 위에 겹침, 조작을 막지 않음)
//  black  : 암전
export type Shot =
  | { k: 'black'; d: number; sfx?: Sfx }
  | { k: 'stack'; d: number; lines: string[]; sub?: string; at?: 'bl' | 'tl' | 'br' | 'c'; sfx?: Sfx }
  | { k: 'mono'; d: number; text: string; kicker?: string; sub?: string; sfx?: Sfx; tint?: string }
  | { k: 'card'; d: number; big: string; mid?: string; sub?: string; bg: string; ink: string; sfx?: Sfx }
  | { k: 'brutal'; d: number; text: string; sub?: string; code?: string; sfx?: Sfx }
  | { k: 'ticker'; d: number; top: string; bot: string; sfx?: Sfx }

/** 글자가 정해진 폭(px, 화면 좌표)을 꽉 채우도록 글자 크기를 맞춘다. 높이 상한 maxH */
function Fit({ w, maxH = 9999, className = '', children, style }: { w: number; maxH?: number; className?: string; children: ReactNode; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [size, setSize] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.fontSize = '100px'
      const bw = el.scrollWidth || 1
      const v = Math.min(maxH, (100 * w) / bw)
      el.style.fontSize = `${v}px` // 다시 잴 때 React가 같은 값이라 건너뛰어도 크기가 남도록 바로 되돌린다
      setSize(v)
    }
    fit()
    document.fonts?.ready.then(fit).catch(() => {})
  }, [w, maxH, children])
  return <span ref={ref} className={`cn-fit ${className}`} style={{ ...style, fontSize: size ?? 100, visibility: size == null ? 'hidden' : undefined }}>{children}</span>
}

function ShotView({ s }: { s: Shot }) {
  const dur = { '--d': `${s.d}s` } as CSSProperties
  switch (s.k) {
    case 'black':
      return <div className="cn-black" style={dur} />
    case 'stack':
      return (
        <div className={`cn-stack at-${s.at ?? 'bl'}`} style={dur}>
          {s.lines.map((l, i) => <b key={i} style={{ '--i': i } as CSSProperties}>{l}</b>)}
          {s.sub && <em style={{ '--i': s.lines.length } as CSSProperties}>{s.sub}</em>}
        </div>
      )
    case 'mono':
      return (
        <div className="cn-mono" style={{ ...dur, '--tint': s.tint ?? '#fff' } as CSSProperties}>
          <i className="cn-flash" />
          {s.kicker && <small>{s.kicker}</small>}
          <div className="cn-mono-word">
            <Fit w={1200} maxH={330} className="ghost g1">{s.text}</Fit>
            <Fit w={1200} maxH={330} className="ghost g2">{s.text}</Fit>
            <Fit w={1200} maxH={330} className="main">{s.text}</Fit>
          </div>
          {s.sub && <span className="sub">{s.sub}</span>}
        </div>
      )
    case 'card':
      return (
        <div className="cn-card" style={{ ...dur, '--bg': s.bg, '--ink': s.ink } as CSSProperties}>
          <div className="cn-card-in">
            <Fit w={560} maxH={300} className="big">{s.big}</Fit>
            {s.mid && <Fit w={560} maxH={130} className="mid">{s.mid}</Fit>}
            {s.sub && <em>{s.sub}</em>}
          </div>
        </div>
      )
    case 'brutal':
      return (
        <div className="cn-brutal" style={dur}>
          {s.code && <code>{s.code}</code>}
          <Fit w={1180} maxH={260} className="word">{s.text}</Fit>
          {s.sub && <span className="sub">{s.sub}</span>}
        </div>
      )
    case 'ticker': {
      const rep = (t: string) => Array.from({ length: 6 }, () => t).join('   ')
      return (
        <div className="cn-ticker" style={dur}>
          <div className="band top"><span>{rep(s.top)}</span></div>
          <div className="band bot"><span>{rep(s.bot)}</span></div>
        </div>
      )
    }
  }
}

/**
 * 컷을 차례로 재생한다. onShot(i, shot): 컷이 시작될 때(카메라 흔들기 등 장면 쪽 반응용).
 * skippable: 화면을 누르면 끝으로 넘어간다. block=false면 아래 조작을 막지 않는다.
 * reduce(동작 줄이기): 컷마다 짧게만 보여 준다.
 */
export function Cine({ shots, onShot, onDone, skippable = false, block = true, reduce = false, className = '' }: {
  shots: Shot[]; onShot?: (i: number, s: Shot) => void; onDone?: () => void; skippable?: boolean; block?: boolean; reduce?: boolean; className?: string
}) {
  const [i, setI] = useState(0)
  const done = useRef(false)
  const cb = useRef({ onShot, onDone }); cb.current = { onShot, onDone }
  // 부모가 그릴 때마다 새 배열을 넘겨도 처음 받은 컷 목록으로 끝까지 간다(매 프레임 다시 그리는 전투 화면 대비)
  const list = useRef(shots)
  const finish = () => { if (done.current) return; done.current = true; cb.current.onDone?.() }
  useEffect(() => {
    const shots = list.current
    if (i >= shots.length) { finish(); return }
    const s = shots[i]
    if (s.sfx) audio.sfx(s.sfx)
    cb.current.onShot?.(i, s)
    const rate = (window as unknown as { __CINE_RATE?: number }).__CINE_RATE ?? 1 // 검수용: 느리게 재생(CSS 애니메이션 속도와 함께 맞춘다)
    const id = setTimeout(() => setI((v) => v + 1), ((reduce ? Math.min(s.d, 0.5) : s.d) * 1000) / rate)
    return () => clearTimeout(id)
  }, [i, reduce])
  const shotsNow = list.current
  if (i >= shotsNow.length) return null
  const s = shotsNow[i]
  return (
    <div className={`cn ${block ? 'block' : ''} ${reduce ? 'reduce' : ''} ${className}`} aria-live="polite">
      <ShotView key={i} s={reduce ? { ...s, d: Math.min(s.d, 0.5) } : s} />
      {skippable && <button type="button" className="cn-skip" aria-label="연출 건너뛰기" onClick={() => { setI(shotsNow.length) }}><span>SKIP</span></button>}
      <span className="sr-only">{'text' in s ? s.text : 'lines' in s ? s.lines.join(' ') : 'big' in s ? `${s.big} ${s.mid ?? ''}` : ''}</span>
    </div>
  )
}
