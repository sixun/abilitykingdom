import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { audio } from '../../app/audio'
import { SPEAKER, BG_IMG, type Line, type Speaker, type Hotspot } from '../../game/story/chapter1'
import { PROPS } from '../../battle/look'

// 대화 장면(스토리·조사·전투 전후). 1280×720 무대 위에 겹친다.
// 누르기(또는 Enter·Space) = 글자 모두 보이기 → 다음 줄. AUTO = 저절로 넘김. 건너뛰기 = 끝으로.
// 조사(hotspots): 도입 대사 뒤 빛나는 곳을 눌러 조사, 모두 보면 마무리 대사.
export default function StoryScene({ bg, lines, hotspots, outro, onDone, label, dim = 0.45, relayAt }: {
  bg: keyof typeof BG_IMG; lines: Line[]; hotspots?: Hotspot[]; outro?: Line[]; onDone: () => void; label?: string; dim?: number; relayAt?: [number, number]
}) {
  const [queue, setQueue] = useState<Line[]>(lines)
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(0)
  const [auto, setAuto] = useState(false)
  const [phase, setPhase] = useState<'talk' | 'explore' | 'outro'>('talk')
  const [checked, setChecked] = useState<string[]>([])
  const [fx, setFx] = useState<{ k: string; n: number } | null>(null)
  const done = useRef(false)
  const line = queue[i]
  const full = line?.text.length ?? 0
  // 자리: 처음 등장한 순서대로 왼쪽·오른쪽 번갈아
  const side = useMemo(() => { const m: Partial<Record<Speaker, 'l' | 'r'>> = {}; let k = 0; for (const l of [...lines, ...(hotspots ?? []).flatMap((h) => h.lines), ...(outro ?? [])]) if (l.who && l.who !== 'hq' && !m[l.who]) m[l.who] = k++ % 2 ? 'r' : 'l'; return m }, [lines, hotspots, outro])
  // 지금 무대에 선 인물(왼쪽·오른쪽 각 1명): 가장 최근에 말한 사람
  const stage = useMemo(() => { const st: { l?: Speaker; r?: Speaker } = {}; for (let k = 0; k <= i && k < queue.length; k++) { const w = queue[k].who; if (w && w !== 'hq') st[side[w]!] = w } return st }, [i, queue, side])

  const finish = () => { if (done.current) return; done.current = true; onDone() }
  const startOutro = () => { if (outro?.length) { setQueue(outro); setI(0); setShown(0); setPhase('outro') } else finish() }
  const next = () => {
    if (!line) return
    if (shown < full) { setShown(full); return }
    audio.sfx('tap')
    if (i + 1 < queue.length) { setI(i + 1); setShown(0); return }
    if (phase === 'talk') { if (hotspots?.length) { setQueue([]); setI(0); setPhase('explore') } else finish(); return }
    if (phase === 'explore') { setQueue([]); setI(0); if (checked.length >= (hotspots?.length ?? 0)) startOutro(); return }
    finish()
  }
  // 글자 타자
  useEffect(() => { if (!line || shown >= full) return; const id = setTimeout(() => setShown((v) => Math.min(full, v + 2)), 28); return () => clearTimeout(id) }, [shown, full, line])
  // 줄 효과
  useEffect(() => { if (line?.fx) { setFx({ k: line.fx, n: i }); if (line.fx === 'core') audio.sfx('reveal5'); else if (line.fx === 'shake') audio.sfx('hit'); else audio.sfx('whoosh') } }, [i, queue])
  // AUTO
  useEffect(() => { if (!auto || !line || shown < full || phase === 'explore') return; const id = setTimeout(next, 900 + full * 25); return () => clearTimeout(id) })
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next() } if (e.key === 'Escape') { e.stopPropagation(); finish() } }
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true)
  })

  const exploring = phase === 'explore' && !!hotspots && queue.length === 0
  const look = (h: Hotspot) => { if (!checked.includes(h.id)) setChecked((c) => [...c, h.id]); audio.sfx('open'); setQueue(h.lines); setI(0); setShown(0) }
  const sp = line?.who ? SPEAKER[line.who] : null
  const R = PROPS.relay

  return (
    <div className="ss" onClick={exploring ? undefined : next} role="dialog" aria-label={label ?? '대화'}>
      <div className={`ss-scene ${fx?.k === 'shake' ? 'shake' : ''}`} key={fx?.k === 'shake' ? `s${fx.n}` : 'scene'}>
        <div className="ss-bg" style={{ backgroundImage: `url(${BG_IMG[bg]})`, '--dim': dim } as CSSProperties} />
        {relayAt && <img className="ss-prop" src={R.file} alt="" style={{ left: relayAt[0] - R.ax * R.s * 1.1, top: relayAt[1] - R.ay * R.s * 1.1, width: R.cw * R.s * 1.1 }} />}
        {(['l', 'r'] as const).map((s) => { const w = stage[s]; if (!w) return null; const on = line?.who === w; return <img key={s + w} className={`ss-char ${s} ${on ? 'on' : ''}`} src={SPEAKER[w].img!} alt={SPEAKER[w].name} draggable={false} /> })}
      </div>
      {line?.who === 'hq' && <div className="ss-hq" aria-hidden><i className="wave">{Array.from({ length: 12 }, (_, k) => <b key={k} style={{ animationDelay: `${-k * 0.13}s` }} />)}</i><span>HQ · 본부 관제</span></div>}
      {fx?.k === 'static' && <i className="ss-static" key={`st${fx.n}`} aria-hidden />}
      {fx?.k === 'core' && line?.fx === 'core' && <div className="ss-core" key={`c${fx.n}`}><i className="hex" /><b>CORE SLOT 01</b><span>코어 슬롯 해금</span></div>}

      {exploring && hotspots!.map((h) => (
        <button key={h.id} type="button" className={`ss-spot ${checked.includes(h.id) ? 'done' : ''}`} style={{ left: h.x, top: h.y, width: h.r * 2, height: h.r * 2 }} aria-label={`조사: ${h.label}${checked.includes(h.id) ? ' (확인함)' : ''}`}
          onClick={(e) => { e.stopPropagation(); look(h) }}><i /><span>{h.label}</span></button>
      ))}
      {phase === 'explore' && <div className="ss-progress" onClick={(e) => e.stopPropagation()}>조사 {checked.length} / {hotspots!.length}</div>}

      {line && (
        <div className={`ss-box ${line.sys ? 'sys' : ''} ${!line.who && !line.sys ? 'narr' : ''}`} aria-live="polite">
          {sp && <b className="ss-name" style={{ '--c': sp.color } as CSSProperties}>{sp.name}</b>}
          <p>{line.text.slice(0, shown)}<i className="ss-caret" hidden={shown < full} /></p>
        </div>
      )}
      <div className="ss-tools" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={auto ? 'on' : ''} aria-pressed={auto} onClick={() => { audio.sfx('select'); setAuto((a) => !a) }}>AUTO</button>
        <button type="button" onClick={() => { audio.sfx('tap'); finish() }}>건너뛰기</button>
      </div>
    </div>
  )
}
