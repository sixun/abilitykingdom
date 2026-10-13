import { useEffect, useRef, useState, type CSSProperties } from 'react'
import '../styles/pass-summer.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import { MISSIONS } from '../game/data/catalog'
import { PASS_FP1 as P } from '../game/data/pass'
import json from '../game/data/ref-pass-summer.json'
import { Hit } from '../ui/ref'
import { MotionStage, tilt } from '../ui/ui-motion'
import { Modal, Btn } from '../ui/components'
import { useReduceMotion } from '../ui/motion'

// FP1 썸머 패스(시안 Summer days, 1672×941). 시안 그림을 조각으로 나눠 각각 움직인다.
// - 장면: 제목·손글씨는 써지듯 나타나고, 도장은 찍히고, 티켓·폴라로이드는 놓이고, 꼬리표는 바람에 흔들린다
// - 티켓의 레벨·경험치 글자와 막대, 탭 밑줄, 보상 열 선택·강조는 실제 값으로 그린다
// - 구매·보상 지급·패스 경험치 규칙은 정해지지 않아 연결하지 않는다(안내만)
type Box = { x: number; y: number; w: number; h: number; file: string }
const R = json as Record<string, Box>
const COLS = P.levels.map((l) => `col${l.lv}`)
// 보상 칸의 세로 범위(열 조각 기준): 기본 보상 / 프리미엄 보상
const ROW = { basic: { top: 40, h: 90 }, premium: { top: 130, h: 140 } }
// 바다·유리잔 위 반짝임 자리(시안 좌표)
const SPARKS: [number, number, number][] = [[214, 300, 9], [336, 262, 7], [452, 290, 11], [590, 300, 8], [612, 262, 6], [500, 248, 7], [150, 268, 6], [404, 322, 9], [676, 282, 7], [262, 340, 6], [806, 222, 8], [776, 290, 6]]
const fmt = (n: number) => n.toLocaleString('en-US')

function useCount(to: number, delay: number, dur: number, reduce: boolean) {
  const [v, setV] = useState(reduce ? to : 0)
  useEffect(() => {
    if (reduce) { setV(to); return }
    let raf = 0; const t0 = performance.now() + delay
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / dur))
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, delay, dur, reduce])
  return v
}

export default function PassSummer(_: { params: Record<string, unknown> }) {
  const nav = useNav()
  const s = useGame()
  const reduce = useReduceMotion()
  const [tab, setTab] = useState<'rewards' | 'missions'>('rewards')
  const [focus, setFocus] = useState<'basic' | 'premium' | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [buy, setBuy] = useState(false)
  const [info, setInfo] = useState(false)
  const [toast, setToast] = useState<{ k: number; text: string } | null>(null)
  const toastT = useRef(0)
  const lv = useCount(P.level, 1250, 1100, reduce)
  const exp = useCount(P.exp, 1350, 1200, reduce)
  useEffect(() => { audio.bgm('lobby') }, [])
  useEffect(() => () => clearTimeout(toastT.current), [])
  const say = (text: string) => {
    clearTimeout(toastT.current)
    setToast({ k: Date.now(), text })
    toastT.current = window.setTimeout(() => setToast(null), 2600)
  }
  const img = (k: string, cls = '', style?: CSSProperties) => <img className={`sp-s ${cls}`} src={R[k].file} alt="" draggable={false} style={{ left: R[k].x, top: R[k].y, width: R[k].w, height: R[k].h, ...style }} />
  const lvData = P.levels.find((l) => l.lv === pick)

  return (
    <div className="scr pass-summer">
      <MotionStage canvas={{ width: 1672, height: 941 }} className={`ui-spass ${focus ? `focus-${focus}` : ''} tab-${tab}`}>
        {/* 장면 */}
        <div className="sp-scene" aria-hidden>
          <img className="sp-base" src={R.base.file} alt="" draggable={false} />
          <i className="sp-sun-light" />
          {SPARKS.map(([x, y, r], i) => <i key={i} className="sp-twinkle" style={{ left: x - r, top: y - r, width: r * 2, height: r * 2, '--i': i } as CSSProperties} />)}
          {img('hw2', 'write w2')}
          {img('tag', 'tag')}
        </div>

        {/* 왼쪽 위: 제목 */}
        <div className="sp-head" aria-label="Summer days · FP1 SUMMER PASS">
          <i className="sp-sun-glow" aria-hidden style={{ left: R.sun.x - 4, top: R.sun.y - 4, width: R.sun.w + 8, height: R.sun.h + 8 }} />
          {img('title', 'write title')}
          {img('sun', 'sun')}
          {img('fp1', 'fp1')}
          {img('stamp', 'stamp')}
          {img('hw1', 'write w1')}
        </div>

        {/* 티켓(레벨·경험치) + 폴라로이드 */}
        <div className="sp-ticket" aria-label={`패스 레벨 ${P.level} / ${P.maxLevel}, 경험치 ${fmt(P.exp)} / ${fmt(P.expMax)}`}>
          {img('ticket')}
          <div className="sp-lv" aria-hidden><small>Lv.</small><b className="num-tab">{lv}</b><span>/ {P.maxLevel}</span></div>
          <div className="sp-exp num-tab" aria-hidden>{fmt(exp)} / {fmt(P.expMax)}</div>
          <div className="sp-bar" aria-hidden><i style={{ width: `${(P.exp / P.expMax) * 100}%` }} /></div>
          <Hit r={{ x: 30, y: 395, w: 330, h: 180 }} label="패스 레벨 안내" onClick={() => setInfo(true)} z={4} className="sp-ticket-hit" />
        </div>
        <div className="sp-polaroid" aria-hidden>{img('polaroid')}</div>

        <Hit r={{ x: 12, y: 4, w: 52, h: 44 }} label="뒤로" onClick={() => nav.back()} z={60} className="sp-back" />

        {/* 오른쪽 위 탭 */}
        <i className="sp-uline" aria-hidden style={tab === 'rewards' ? { left: 1333, width: 76 } : { left: 1450, width: 72 }} />
        <Hit r={{ x: 1322, y: 6, w: 98, h: 40 }} label={`REWARDS${tab === 'rewards' ? ' (선택됨)' : ''}`} onClick={() => setTab('rewards')} sfx="select" z={60} />
        <Hit r={{ x: 1438, y: 6, w: 96, h: 40 }} label={`MISSIONS${tab === 'missions' ? ' (선택됨)' : ''}`} onClick={() => setTab('missions')} sfx="select" z={60} />
        <Hit r={{ x: 1606, y: 4, w: 52, h: 44 }} label="패스 보상 모두 받기" onClick={() => say('받을 수 있는 패스 보상이 없습니다 · 지급 규칙 미정')} z={60} className="sp-gift" />

        {/* 아래 보상 띠 */}
        <div className="sp-strip">
          {img('strip', 'plate')}
          <button type="button" className={`sp-track basic ${focus === 'basic' ? 'on' : ''}`} style={{ left: R.basic.x, top: R.basic.y, width: R.basic.w, height: R.basic.h }} aria-pressed={focus === 'basic'} aria-label="BASIC 보상만 보기" onClick={() => { audio.sfx('select'); setFocus((f) => (f === 'basic' ? null : 'basic')) }}>
            <img src={R.basic.file} alt="" draggable={false} />
          </button>
          <button type="button" className={`sp-track premium ${focus === 'premium' ? 'on' : ''}`} style={{ left: R.premium.x, top: R.premium.y, width: R.premium.w, height: R.premium.h }} aria-pressed={focus === 'premium'} aria-label="PREMIUM 보상만 보기" onClick={() => { audio.sfx('select'); setFocus((f) => (f === 'premium' ? null : 'premium')) }}>
            <img src={R.premium.file} alt="" draggable={false} />
          </button>

          {tab === 'rewards' ? (
            <div className="sp-cols" key="cols">
              {COLS.map((k, i) => {
                const L = P.levels[i]; const now = L.lv === P.level; const done = L.lv <= P.level
                return (
                  <div key={k} className={`sp-col ${now ? 'now' : ''} ${done ? 'done' : ''}`} style={{ left: R[k].x, top: R[k].y, width: R[k].w, height: R[k].h, '--i': i } as CSSProperties}>
                    <img src={R[k].file} alt="" draggable={false} />
                    <i className="sp-dim basic" style={{ top: ROW.basic.top, height: ROW.basic.h }} />
                    <i className="sp-dim premium" style={{ top: ROW.premium.top, height: ROW.premium.h }} />
                    {now && <i className="sp-now" aria-hidden />}
                    <button type="button" className="sp-col-hit" onPointerMove={(e) => tilt.move(e, e.currentTarget.parentElement, 5)} onPointerLeave={(e) => tilt.leave(e.currentTarget.parentElement)}
                      aria-label={`Lv.${L.lv} 보상: ${L.basic.name} ×${fmt(L.basic.amount)}, 프리미엄 ${L.premium.name} ×${L.premium.amount}${now ? ' (현재 레벨)' : ''}`} onClick={() => { audio.sfx('tap'); setPick(L.lv) }} />
                  </div>
                )
              })}
              {img('arrow1', 'nudge a1')}
            </div>
          ) : (
            <div className="sp-missions" key="missions">
              <div className="sp-mhead"><b>DAILY MISSIONS</b><span>패스 경험치 연결 전 · 일일 미션 진행 상황</span></div>
              <div className="sp-mlist">
                {MISSIONS.map((m, i) => {
                  const st = game.missionStatus(m.id)
                  return (
                    <div key={m.id} className={`sp-mrow ${st.claimed ? 'claimed' : st.done ? 'done' : ''}`} style={{ '--i': i } as CSSProperties}>
                      <strong>{m.title}</strong>
                      <span className="bar"><i style={{ width: `${Math.min(100, (st.progress / m.target) * 100)}%` }} /></span>
                      <em className="num-tab">{Math.min(st.progress, m.target)} / {m.target}</em>
                      <b className="st">{st.claimed ? '받음' : st.done ? '완료' : '진행 중'}</b>
                    </div>
                  )
                })}
              </div>
              <button type="button" className="sp-mlink" onClick={() => { audio.sfx('tap'); nav.push('missions') }}>미션 화면으로 →</button>
            </div>
          )}

          {img('arrow2', 'nudge a2')}
          <Hit r={{ x: 1376, y: 738, w: 38, h: 44 }} label="다음 레벨 보상" onClick={() => say(`Lv.${P.levels[P.levels.length - 1].lv + 1} 이후 보상은 아직 정해지지 않았습니다`)} z={6} className="sp-next" />

          <div className="sp-getp" style={{ left: R.getp.x, top: R.getp.y, width: R.getp.w, height: R.getp.h }}>
            <i className="sp-getp-halo" aria-hidden />
            <img src={R.getp.file} alt="" draggable={false} />
            <i className="sp-getp-ring" aria-hidden />
            <button type="button" className="sp-getp-hit" aria-label="GET PREMIUM (프리미엄 패스)" onPointerMove={(e) => tilt.move(e, e.currentTarget.parentElement, 4)} onPointerLeave={(e) => tilt.leave(e.currentTarget.parentElement)} onClick={() => { audio.sfx('tap'); setBuy(true) }} />
          </div>
        </div>

        {toast && <div className="sp-toast" key={toast.k} role="status">{toast.text}</div>}
      </MotionStage>

      {lvData && (
        <Modal onClose={() => setPick(null)} labelledBy="sp-title" className="sp-modal">
          <img className="sp-modal-art" src={R[`col${lvData.lv}`].file} alt="" />
          <div>
            <h2 id="sp-title">Lv.{lvData.lv} 보상 <small>{lvData.lv <= P.level ? '달성' : `${lvData.lv - P.level}레벨 남음`}</small></h2>
            <p className="sp-rw"><b>BASIC</b> {lvData.basic.name} ×{fmt(lvData.basic.amount)}{'note' in lvData.basic ? <em> · {lvData.basic.note}</em> : null}</p>
            <p className="sp-rw prem"><b>PREMIUM</b> {lvData.premium.name} ×{lvData.premium.amount} <em> · {lvData.premium.note}</em></p>
            <p className="rs-pop-note">보상 이름은 시안 그림을 보고 붙인 임시 이름입니다. 지급 방식은 아직 정해지지 않았습니다.</p>
            <div className="confirm-actions"><Btn variant="dark" onClick={() => setPick(null)}>닫기</Btn></div>
          </div>
        </Modal>
      )}
      {info && (
        <Modal onClose={() => setInfo(false)} labelledBy="si-title">
          <h2 id="si-title">FP1 썸머 패스 · Lv.{P.level} / {P.maxLevel}</h2>
          <p className="rs-pop-note">경험치 {fmt(P.exp)} / {fmt(P.expMax)} · 다음 레벨까지 {fmt(P.expMax - P.exp)}</p>
          <p className="rs-pop-note">패스 경험치를 얻는 방법(미션·전투 등)은 아직 연결되지 않았습니다. 지금 값은 시안 표시용입니다.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setInfo(false)}>닫기</Btn></div>
        </Modal>
      )}
      {buy && (
        <Modal onClose={() => setBuy(false)} labelledBy="sb-title">
          <h2 id="sb-title">썸머 프리미엄 패스</h2>
          <p className="rs-pop-note">결제는 아직 연결되지 않았습니다(프로토타입). 가격·기간·지급 규칙이 정해지면 연결합니다.</p>
          <p className="rs-pop-note">현재 보유 다이아 {s.wallet.diamond.toLocaleString()} · 아무것도 차감되지 않습니다.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setBuy(false)}>닫기</Btn></div>
        </Modal>
      )}
    </div>
  )
}
