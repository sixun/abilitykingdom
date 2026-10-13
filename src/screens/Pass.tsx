import { useEffect, useState, type CSSProperties } from 'react'
import '../styles/pass.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import { MISSIONS } from '../game/data/catalog'
import { PASS_S01 as P } from '../game/data/pass'
import passJson from '../game/data/ref-pass.json'
import { Hit, boxStyle } from '../ui/ref'
import { MotionStage, AmbientFx, tilt } from '../ui/ui-motion'
import { Modal, Btn } from '../ui/components'
import { useReduceMotion } from '../ui/motion'

// S01 패스(시안 SENKA PASS, 1672×941). 시안 그림을 조각으로 나눠 각각 움직이고,
// 레벨 숫자·경험치 막대·Basic/Premium 탭·마일스톤 줄·탭 밑줄은 실제 값으로 그린다.
// 구매·보상 지급·패스 경험치 규칙은 정해지지 않아 연결하지 않는다(GET PREMIUM은 안내만).
type Box = { x: number; y: number; w: number; h: number; file: string }
const R = passJson as Record<string, Box>
const CARDS = P.rewards.map((r) => r.id)
// 마일스톤 칸 x 좌표(시안 기준)와 줄 높이
const MX = [800, 891, 978, 1065, 1151, 1237]
const MY = 862
const lvX = (lv: number) => { const i = Math.min(4, Math.floor(lv / 10)); return MX[i] + ((lv - i * 10) / 10) * (MX[i + 1] - MX[i]) }

export default function Pass(_: { params: Record<string, unknown> }) {
  const nav = useNav()
  const s = useGame()
  const reduce = useReduceMotion()
  const [tab, setTab] = useState<'rewards' | 'missions'>('rewards')
  const [track, setTrack] = useState<'basic' | 'premium'>('premium')
  const [pick, setPick] = useState<string | null>(null)
  const [buy, setBuy] = useState(false)
  const [lv, setLv] = useState(reduce ? P.level : 0)
  useEffect(() => { audio.bgm('lobby') }, [])
  // 레벨 숫자 0 → 35 (막대가 차는 동안)
  useEffect(() => {
    if (reduce) { setLv(P.level); return }
    let raf = 0; const t0 = performance.now() + 900
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / 1200))
      setLv(Math.round(P.level * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [reduce])
  const reward = P.rewards.find((r) => r.id === pick)
  const img = (k: string, cls = '', style?: CSSProperties) => <img className={`pp-slice ${cls}`} src={R[k].file} alt="" draggable={false} style={{ left: R[k].x, top: R[k].y, width: R[k].w, height: R[k].h, ...style }} />

  return (
    <div className="scr pass">
      <MotionStage canvas={{ width: 1672, height: 941 }} className="ui-pass">
        {/* 왼쪽: 센카 그림(숨쉬는 확대·빛줄기·떠다니는 빛) */}
        <div className="pp-hero" aria-hidden>
          <img src={R.hero.file} alt="" draggable={false} />
        </div>
        <AmbientFx kind="dust" box={{ x: 0, y: 0, w: 836, h: 941 }} count={26} z={3} clip="polygon(0 0, 836px 0, 836px 272px, 772px 272px, 772px 941px, 0 941px)" />
        <button type="button" className="pp-back" aria-label="뒤로" onClick={() => { audio.sfx('tap'); nav.back() }}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        {/* 오른쪽 종이 패널 */}
        <div className="pp-panel">
          {img('plate', 'plate')}
          {img('title', 'title')}
          <i className="pp-spark" aria-hidden style={{ left: 1641, top: 82 }} />
          {img('tabs', 'tabs')}
          <i className="pp-uline" aria-hidden style={tab === 'rewards' ? { left: 928, width: 277 } : { left: 1300, width: 290 }} />
          <Hit r={{ x: 920, y: 140, w: 296, h: 56 }} label={`REWARDS${tab === 'rewards' ? ' (선택됨)' : ''}`} onClick={() => setTab('rewards')} sfx="select" />
          <Hit r={{ x: 1290, y: 140, w: 312, h: 56 }} label={`MISSIONS${tab === 'missions' ? ' (선택됨)' : ''}`} onClick={() => setTab('missions')} sfx="select" />

          {img('emblem', 'emblem')}
          <div className="pp-lv" aria-label={`패스 레벨 ${P.level} / ${P.maxLevel}`}><small>LV.</small><b className="num-tab">{lv}</b><span>/ {P.maxLevel}</span></div>
          <div className="pp-bar" aria-hidden><i style={{ width: `${(P.level / P.maxLevel) * 100}%` }} /></div>

          {tab === 'rewards' ? (
            <div className="pp-rewards" key="rewards">
              <div className="pp-tracks" role="tablist" aria-label="보상 구분">
                <button type="button" role="tab" aria-selected={track === 'basic'} className={`basic ${track === 'basic' ? 'on' : ''}`} onClick={() => { audio.sfx('select'); setTrack('basic') }}><span>Basic</span></button>
                <button type="button" role="tab" aria-selected={track === 'premium'} className={`premium ${track === 'premium' ? 'on' : ''}`} onClick={() => { audio.sfx('select'); setTrack('premium') }}>
                  <svg viewBox="0 0 32 24" width="40" height="30" aria-hidden><path d="M3 20 1 6l8 6 7-10 7 10 8-6-2 14Z" fill="currentColor" /><rect x="3" y="21" width="26" height="2.4" rx="1" fill="currentColor" /></svg>
                  <span>Premium</span>
                </button>
              </div>
              {track === 'premium' ? (
                <div className="pp-cards" key="premium">
                  {CARDS.map((k, i) => (
                    <div key={k} className="pp-card" style={{ '--i': i, ...boxStyle({ x: R[k].x, y: R[k].y, w: R[k].w, h: R[k].h }) } as CSSProperties}>
                      <img src={R[k].file} alt="" draggable={false} />
                      <button type="button" className="pp-card-hit" onPointerMove={(e) => tilt.move(e, e.currentTarget.parentElement, 5)} onPointerLeave={(e) => tilt.leave(e.currentTarget.parentElement)} aria-label={`${P.rewards[i].name} · ${P.rewards[i].term}, 자세히`} onClick={() => { audio.sfx('tap'); setPick(k) }} />
                    </div>
                  ))}
                  <i className="pp-7star" aria-hidden />
                </div>
              ) : (
                <div className="pp-basic" key="basic" role="status">
                  <b>Basic 보상</b>
                  <span>무료 트랙의 보상 구성은 아직 정해지지 않았습니다.</span>
                  <small>Premium 보상 5종만 시안으로 확정되어 있습니다.</small>
                </div>
              )}
            </div>
          ) : (
            <div className="pp-missions" key="missions">
              <div className="pp-mhead"><b>DAILY MISSIONS</b><span>패스 경험치 연결 전 · 일일 미션 진행 상황</span></div>
              {MISSIONS.map((m, i) => {
                const st = game.missionStatus(m.id)
                return (
                  <div key={m.id} className={`pp-mrow ${st.claimed ? 'claimed' : st.done ? 'done' : ''}`} style={{ '--i': i } as CSSProperties}>
                    <strong>{m.title}</strong>
                    <span className="bar"><i style={{ width: `${Math.min(100, (st.progress / m.target) * 100)}%` }} /></span>
                    <em className="num-tab">{Math.min(st.progress, m.target)} / {m.target}</em>
                    <b className="st">{st.claimed ? '받음' : st.done ? '완료' : '진행 중'}</b>
                  </div>
                )
              })}
              <button type="button" className="pp-mlink" onClick={() => { audio.sfx('tap'); nav.push('missions') }}>미션 화면으로 →</button>
            </div>
          )}

          {/* 마일스톤 줄: 레벨까지 선이 그려지고, 다음 목표는 맥동, 마지막은 잠금 */}
          <svg className="pp-track" viewBox="0 0 1672 941" aria-label={`마일스톤 ${P.milestones.filter((m) => m <= P.level).length}/${P.milestones.length} 달성`} role="img">
            <line className="base" x1={MX[0]} y1={MY} x2={MX[5]} y2={MY} />
            <line className="prog" x1={MX[0]} y1={MY} x2={lvX(P.level)} y2={MY} style={{ '--len': lvX(P.level) - MX[0] } as CSSProperties} />
            <line className="tail" x1={MX[5] + 22} y1={MY} x2={1292} y2={MY} />
            <path className="tail-arrow" d={`M1290 ${MY - 4}l6 4-6 4`} />
            {P.milestones.map((m, i) => {
              const x = MX[i]; const done = m <= P.level; const next = !done && P.milestones.slice(0, i).every((q) => q <= P.level)
              return (
                <g key={m} className={`ms ${done ? 'done' : next ? 'next' : 'locked'} ${m === P.maxLevel ? 'final' : ''}`} style={{ '--i': i } as CSSProperties}>
                  {m === P.maxLevel
                    ? <g transform={`translate(${x} ${MY})`}><g className="lockg"><circle r="17" className="lock-ring" /><path className="lock-ic" d="M-5.5 -1h11v9h-11zM-3.5 -1v-3a3.5 3.5 0 0 1 7 0v3" /></g></g>
                    : <g transform={`translate(${x} ${MY}) rotate(45)`}><rect x="-10" y="-10" width="20" height="20" rx="3.5" className="dia" />{done && <path className="chk" d="M-4.5 1.5l3 3 6-7" transform="rotate(-45)" />}</g>}
                  {m > 0 && <text x={x} y={MY + 36} textAnchor="middle" className="lbl">{m}</text>}
                </g>
              )
            })}
          </svg>

          {img('premium', 'buy')}
          <i className="pp-buy-glow" aria-hidden />
          <Hit r={{ x: R.premium.x, y: R.premium.y, w: R.premium.w, h: R.premium.h }} label="GET PREMIUM (프리미엄 패스)" onClick={() => setBuy(true)} className="pp-buy-hit" />
        </div>
      </MotionStage>

      {reward && (
        <Modal onClose={() => setPick(null)} labelledBy="pr-title" className="pp-modal">
          <img className="pp-modal-art" src={R[reward.id].file} alt="" />
          <h2 id="pr-title">{reward.name} <small>{reward.term}</small></h2>
          <p className="rs-pop-note">{reward.kind} · S01 Premium 보상</p>
          <p className="rs-pop-note">{reward.note}</p>
          <p className="rs-pop-note">받는 조건(패스 레벨)과 지급 방식은 아직 정해지지 않았습니다.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setPick(null)}>닫기</Btn></div>
        </Modal>
      )}
      {buy && (
        <Modal onClose={() => setBuy(false)} labelledBy="pb-title">
          <h2 id="pb-title">프리미엄 패스</h2>
          <p className="rs-pop-note">결제는 아직 연결되지 않았습니다(프로토타입). 가격·기간·지급 규칙이 정해지면 연결합니다.</p>
          <p className="rs-pop-note">현재 보유 다이아 {s.wallet.diamond.toLocaleString()} · 아무것도 차감되지 않습니다.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setBuy(false)}>닫기</Btn></div>
        </Modal>
      )}
    </div>
  )
}
