import { useEffect, useRef, useState, type CSSProperties } from 'react'
import '../../styles/case.css'
import { useNav } from '../../app/nav'
import { audio } from '../../app/audio'
import { RefStage } from '../../ui/ref'
import { game, useGame } from '../../game/store'
import { CHAPTER1, BG_IMG, SPEAKER, type CaseNode } from '../../game/story/chapter1'
import { STAGES } from '../../game/combat/chapter1Stages'
import { ITEM_BY_ID } from '../../game/data/catalog'
import StoryScene from './StoryScene'

// 사건 파일(1장 지도): 노드 8개를 노선도처럼 잇는다. 이전 노드를 끝내야 다음이 열린다.
const KIND: Record<CaseNode['kind'], { label: string; glyph: string }> = {
  story: { label: '스토리', glyph: '❝' }, investigate: { label: '조사', glyph: '⌕' }, battle: { label: '일반 전투', glyph: '⚔' }, objective: { label: '목표 전투', glyph: '⚑' }, boss: { label: '보스', glyph: '◆' },
}
// 노선 위 자리(1280×720 무대)
const POS: [number, number][] = [[470, 330], [565, 215], [665, 320], [765, 200], [865, 300], [965, 175], [1075, 270], [1185, 165]]
const curName = (id: string) => ({ credit: '크레딧', diamond: '다이아' } as Record<string, string>)[id] ?? id

export default function CaseFile({ params }: { params: Record<string, unknown> }) {
  const nav = useNav()
  const s = useGame()
  const stars = s.content.caseFile?.stars ?? {}
  const nodes = CHAPTER1.nodes
  const firstOpen = nodes.findIndex((n) => !stars[n.id])
  const nextIdx = firstOpen < 0 ? nodes.length - 1 : firstOpen
  const [sel, setSel] = useState<string>(String(params.node ?? params.id ?? nodes[nextIdx].id))
  const [scene, setScene] = useState<CaseNode | null>(null)
  const node = nodes.find((n) => n.id === sel) ?? nodes[0]
  const idx = nodes.indexOf(node)
  const open = (i: number) => i === 0 || !!stars[nodes[i - 1].id]
  const total = nodes.filter((n) => STAGES[n.id]).length * 3
  const got = nodes.reduce((a, n) => a + (STAGES[n.id] ? stars[n.id] ?? 0 : 0), 0)
  const doneN = nodes.filter((n) => stars[n.id]).length
  useEffect(() => { audio.bgm('lobby') }, [])
  // 다녀온 뒤엔 다음 노드를 고른다
  const firstRun = useRef(true)
  useEffect(() => { if (firstRun.current) { firstRun.current = false; return } setSel(nodes[nextIdx].id) }, [doneN])

  const start = () => {
    if (!open(idx)) { audio.sfx('error'); return }
    audio.sfx('select')
    if (STAGES[node.id]) nav.push('caseBattle', { node: node.id })
    else setScene(node)
  }
  const finishScene = async () => { const n = scene!; setScene(null); await game.clearCaseNode(n.id, 1); audio.sfx('save') }
  const path = POS.map(([x, y]) => `${x},${y}`).join(' ')

  return (
    <div className="scr case-file">
      <RefStage canvas={{ width: 1280, height: 720 }} className="cf">
        <div className="cf-bg" style={{ backgroundImage: `url(${BG_IMG[node.bg]})` }} key={node.bg} />
        <i className="cf-scan" aria-hidden />
        <button type="button" className="cf-back" aria-label="돌아가기" onClick={() => { audio.sfx('tap'); nav.back() }}>‹</button>

        {/* 사건 파일 표지 */}
        <section className="cf-cover">
          <small>AC 해결사 본부 · 전투반 사건 기록</small>
          <b className="no">{CHAPTER1.no}</b>
          <h1>{CHAPTER1.title}</h1>
          <p className="area">{CHAPTER1.area}</p>
          <p className="sum">{CHAPTER1.summary}</p>
          <div className="cf-meter"><span>진행</span><i><b style={{ width: `${(doneN / nodes.length) * 100}%` }} /></i><em className="num-tab">{doneN} / {nodes.length}</em></div>
          <div className="cf-meter"><span>별</span><i><b style={{ width: `${(got / total) * 100}%` }} /></i><em className="num-tab">★ {got} / {total}</em></div>
          <div className={`cf-core ${s.coreSlots ? 'on' : ''}`}><i className="hex" /><div><b>코어 슬롯 {s.coreSlots ? '01 해금' : '잠김'}</b><span>{s.coreSlots ? '스태틱의 결정 핵을 팀 코어로 가공했다' : '1-7 보스 첫 클리어 시 해금'}</span></div></div>
          <p className="squad">1장 지정 편성 · 체험 대원 {(['rion', 'seren', 'ian', 'kanna'] as const).map((k) => <img key={k} src={`ref/battle/face-${k}.webp`} alt={SPEAKER[k].name} />)}</p>
        </section>

        {/* 노선도 */}
        <svg className="cf-line" viewBox="0 0 1280 720" aria-hidden>
          <polyline points={path} className="rail" />
          <polyline points={POS.slice(0, Math.max(1, nextIdx + 1)).map(([x, y]) => `${x},${y}`).join(' ')} className="done" />
        </svg>
        {nodes.map((n, i) => {
          const [x, y] = POS[i]; const o = open(i); const st = stars[n.id]
          return (
            <button key={n.id} type="button" className={`cf-node k-${n.kind} ${n.id === sel ? 'on' : ''} ${st ? 'cleared' : ''} ${o ? '' : 'locked'} ${i === nextIdx && !st ? 'next' : ''}`} style={{ left: x, top: y, '--d': `${i * 70}ms` } as CSSProperties}
              aria-label={`${n.no} ${o ? n.title : '잠김'} · ${KIND[n.kind].label}${st ? ' · 완료' : ''}`} aria-pressed={n.id === sel} onClick={() => { audio.sfx('select'); setSel(n.id) }}>
              <i className="dot">{o ? KIND[n.kind].glyph : '·'}</i>
              <span className="lbl"><small>{n.no}</small>{o ? n.title : '???'}</span>
              {STAGES[n.id] && st ? <em className="st">{'★'.repeat(st)}<s>{'★'.repeat(3 - st)}</s></em> : null}
            </button>
          )
        })}

        {/* 선택한 노드 */}
        <section className="cf-panel" key={node.id}>
          <small className="kind">{node.no} · {KIND[node.kind].label} · {node.place}</small>
          <h2>{open(idx) ? node.title : '잠긴 노드'}</h2>
          <p>{open(idx) ? node.summary : '이전 노드를 먼저 완료하세요.'}</p>
          {STAGES[node.id] && open(idx) && (
            <ul className="cf-goal"><li><b>목표</b>{STAGES[node.id].goalText}</li>{STAGES[node.id].stars.slice(1).map((x, k) => <li key={k}><b>★</b>{x.label}</li>)}</ul>
          )}
          <div className="cf-rw"><small>{stars[node.id] ? '첫 클리어 보상 받음' : '첫 클리어 보상'}</small>{node.rewards.map((r) => <span key={r.id} className={stars[node.id] ? 'got' : ''}>{r.kind === 'currency' ? curName(r.id) : ITEM_BY_ID[r.id]?.name ?? r.id} ×{r.qty}</span>)}{node.id === 'c1-7' && <span className={`core ${stars[node.id] ? 'got' : ''}`}>코어 슬롯 1</span>}</div>
          <button type="button" className="cf-go" disabled={!open(idx)} onClick={start}>{!open(idx) ? '잠김' : stars[node.id] ? (STAGES[node.id] ? '다시 도전' : '다시 보기') : node.kind === 'story' ? '이야기 보기' : node.kind === 'investigate' ? '조사 시작' : '출동'}</button>
        </section>

        {scene && <StoryScene bg={scene.bg} lines={scene.script ?? []} hotspots={scene.hotspots} outro={scene.outro} onDone={finishScene} label={`${scene.no} ${scene.title}`} dim={scene.kind === 'investigate' ? 0.15 : 0.45} relayAt={scene.kind === 'investigate' ? [560, 540] : undefined} />}
      </RefStage>
    </div>
  )
}
