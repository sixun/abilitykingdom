import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import '../styles/recruit-scene.css'
import { audio } from '../app/audio'
import type { RecruitmentBanner } from '../game/types'
import { CHAR_BY_ID } from '../game/data/characters'
import { GAME_CONFIG } from '../game/config'
import json from '../game/data/ref-recruit-scenes.json'
import { Hit } from '../ui/ref'
import { MotionStage, AmbientFx } from '../ui/ui-motion'
import { useReduceMotion } from '../ui/motion'
import { fmt } from '../ui/components'

// 새 영입 배너 3종(SERENITY·NIGHT SHIFT·ONE MORE PLAY?) 화면. 시안(1672×941)을 tools/build_recruit_scenes.py로 조각냄.
// - 장면·인물·제목·이름표·목록·위 UI·아래 바·뽑기 장치가 각각 따로 들어오고 움직인다
// - 재화 숫자·영입 포인트·NEW FACES 얼굴은 실제 값. 목록·탭·버튼은 실제로 동작한다
// - 뽑기 장치(캡슐 기계·추첨기·쿠지)는 영입 버튼을 누르면 돌고·굴러가고·벗겨진 뒤 결과 화면으로 간다
export type SceneName = 'serenity' | 'nightshift' | 'omp'
type Box = { x: number; y: number; w: number; h: number; file: string }
type Cfg = { gems_num: number[]; tickets_num: number[]; points_num: number[]; points_bar: number[]; knob?: number[]; axle?: number[]; flap?: number[]; dev: number[]; dev_kind: 'capsule' | 'lottery' | 'peel'; tag: number[]; list: number[][]; tabs: number[]; hint?: number[] }
type Meta = Record<string, Box> & { _bar: number; _cfg: Cfg }
const ALL = json as unknown as Record<SceneName, Meta>
// NIGHT SHIFT 시안에는 NEW FACES 버튼이 없어 다른 두 화면과 같은 버튼을 같은 줄 빈자리에 둔다
const FACES_FALLBACK = { ...ALL.serenity.faces, x: 768, y: 16 }
// NEW FACES 버튼 안 얼굴 자리(버튼 조각 기준)
const FACE_SLOT: Record<SceneName, { x: number; y: number }> = { serenity: { x: 12, y: 8 }, nightshift: { x: 12, y: 8 }, omp: { x: 16, y: 10 } }

type Props = {
  name: SceneName
  banner: RecruitmentBanner
  order: string[]
  wallet: { diamond: number; ticket: number; scoutPoint: number }
  newFaces: { id: string; portrait: string }[]
  busy: boolean
  onBanner: (id: string) => void
  onKind: (k: 'limited' | 'standard') => void
  onPull: (count: number, play: () => Promise<void>) => void
  onBack: () => void
  onShop: (tab: string) => void
  onFaces: () => void
  onDetail: () => void
  onRates: () => void
  children?: ReactNode
}

export default function RecruitScene({ name, banner, order, wallet, newFaces, busy, onBanner, onKind, onPull, onBack, onShop, onFaces, onDetail, onRates, children }: Props) {
  const R = ALL[name]
  const cfg = R._cfg
  const reduce = useReduceMotion()
  const [play, setPlay] = useState<null | { n: number; k: number }>(null)
  const [demo, setDemo] = useState(0)
  const [tip, setTip] = useState(false)
  const tipT = useRef(0)
  useEffect(() => () => clearTimeout(tipT.current), [])
  const f = CHAR_BY_ID[banner.featuredId]
  const img = (k: string, cls = '', style?: CSSProperties) => R[k] ? <img className={`rs-s ${cls}`} src={R[k].file} alt="" draggable={false} style={{ left: R[k].x, top: R[k].y, width: R[k].w, height: R[k].h, ...style }} /> : null
  const box = (k: string) => ({ x: R[k].x, y: R[k].y, w: R[k].w, h: R[k].h })
  const tabs = box('tabs')
  const faces = R.faces ?? FACES_FALLBACK
  const pts = wallet.scoutPoint, cap = GAME_CONFIG.scoutPointCap
  const [pnx, pny, , pny1] = cfg.points_num
  const [bx0, by0, bx1, by1] = cfg.points_bar
  const list3 = cfg.list[3]
  const multi = GAME_CONFIG.multiPullCount

  const pull = (n: number) => {
    if (busy || play) return
    onPull(n, () => new Promise((done) => {
      if (reduce) { done(); return }
      audio.sfx('select')
      setPlay({ n, k: Date.now() })
      window.setTimeout(() => { done(); window.setTimeout(() => setPlay(null), 600) }, n > 1 ? 1900 : 1500)
    }))
  }
  const tryDevice = () => {
    audio.sfx('tap'); setDemo((d) => d + 1); setTip(true)
    clearTimeout(tipT.current); tipT.current = window.setTimeout(() => setTip(false), 2400)
  }
  const kind = cfg.dev_kind
  const dev = cfg.dev

  return (
    <MotionStage canvas={{ width: 1672, height: 941 }} className={`ui-rscene rs-${name} ${play ? `rs-playing ${play.n > 1 ? "rs-multi" : ""}` : ""}`}>
      {/* 장면(마우스 시차) */}
      <div className="rs-scene" aria-hidden>
        <img className="rs-base" src={R.base.file} alt="" draggable={false} />
        {name === 'serenity' && <><i className="rs-rain" style={{ backgroundImage: 'url(ref/recruit/rain-near.webp)' }} /><i className="rs-rain far" style={{ backgroundImage: 'url(ref/recruit/rain-far.webp)' }} /><i className="rs-flash" /><i className="rs-lamp" /></>}
        {name === 'nightshift' && <><i className="rs-pass a" /><i className="rs-pass b" /><i className="rs-ceiling" /></>}
        {name === 'omp' && <><i className="rs-sun" /><i className="rs-neon" /><i className="rs-crt" /></>}
      </div>
      <div className="rs-char-wrap" aria-hidden>{img('char', 'char')}</div>
      {name === 'omp' && <AmbientFx kind="dust" box={{ x: 300, y: 60, w: 1100, h: 760 }} count={22} z={4} />}

      {/* 제목·이름표 */}
      <div className="rs-head" aria-label={`${banner.title} · ${f.name} ${'★'.repeat(f.rarity)}`}>
        {Object.keys(R).filter((k) => k.startsWith('title')).sort().map((k, i) => <span key={k}>{img(k, `title t${i}`)}</span>)}
        {name === 'serenity' && <i className="rs-spark" style={{ left: 664, top: 386 }} />}
        {img('tag', 'tag')}
      </div>

      {/* 위 UI */}
      <div className="rs-top">
        {img('back', 'top back')}
        {img('tabs', 'top tabs')}
        <img className="rs-s top faces" src={faces.file} alt="" draggable={false} style={{ left: faces.x, top: faces.y, width: faces.w, height: faces.h }} />
        <span className="rs-faces" aria-hidden style={{ left: faces.x + FACE_SLOT[name].x, top: faces.y + FACE_SLOT[name].y }}>
          {newFaces.slice(0, 4).map((c) => <img key={c.id} src={c.portrait} alt="" />)}
        </span>
        {img('gems', 'top gems')}
        {img('tickets', 'top tickets')}
        <span className="rs-num top" style={{ left: cfg.gems_num[0], top: cfg.gems_num[1], width: cfg.gems_num[2] - cfg.gems_num[0], height: cfg.gems_num[3] - cfg.gems_num[1] }}>{fmt(wallet.diamond)}</span>
        <span className="rs-num top" style={{ left: cfg.tickets_num[0], top: cfg.tickets_num[1], width: cfg.tickets_num[2] - cfg.tickets_num[0], height: cfg.tickets_num[3] - cfg.tickets_num[1] }}>{fmt(wallet.ticket)}</span>
        <Hit r={box('back')} label="돌아가기" onClick={onBack} />
        <Hit r={{ ...tabs, w: tabs.w / 2 }} label={`한정 영입${banner.kind === 'limited' ? ' (선택됨)' : ''}`} onClick={() => onKind('limited')} sfx="none" />
        <Hit r={{ ...tabs, x: tabs.x + tabs.w / 2, w: tabs.w / 2 }} label={`상시 영입${banner.kind === 'standard' ? ' (선택됨)' : ''}`} onClick={() => onKind('standard')} sfx="none" />
        {newFaces.length > 0 && <Hit r={{ x: faces.x, y: faces.y, w: faces.w, h: faces.h }} label={`신규 대원 ${newFaces.length}명 미리보기 (영입 대상 아님)`} onClick={onFaces} />}
        <Hit r={box('gems')} label={`다이아 ${wallet.diamond}, 충전`} onClick={() => onShop('currency')} />
        <Hit r={box('tickets')} label={`영입 티켓 ${wallet.ticket}, 구매`} onClick={() => onShop('recommend')} />
      </div>

      {/* 배너 목록 */}
      <div className="rs-list">
        {order.map((id, i) => {
          const k = `list${i}`; const sel = id === banner.id
          return (
            <div key={id} className={`rs-item ${sel ? 'on' : ''}`} style={{ left: R[k].x, top: R[k].y, width: R[k].w, height: R[k].h, '--i': i } as CSSProperties}>
              <img src={R[k].file} alt="" draggable={false} />
              <Hit r={{ x: 0, y: 0, w: R[k].w, h: R[k].h }} label={`${i === 0 || id === 'b_nightshift' ? '한정' : '상시'} 배너 ${['주파수 너머', 'SERENITY', 'NIGHT SHIFT', 'ONE MORE PLAY?'][i]}${sel ? ' (선택됨)' : ''}`} onClick={() => { if (!sel) onBanner(id) }} sfx={sel ? 'none' : 'select'} className="hit-banner" />
            </div>
          )
        })}
        <div className="rs-info" style={{ left: list3[0] + 6, top: list3[3] + 12 }}>
          <button type="button" onClick={() => { audio.sfx('tap'); onDetail() }}>상세 정보</button>
          <button type="button" onClick={() => { audio.sfx('tap'); onRates() }}>확률 정보</button>
        </div>
      </div>

      {/* 아래 바 */}
      <div className="rs-bar">
        {img('bar', 'plate')}
        {img('exchange', 'btn b0')}
        {img('points', 'btn b1')}
        <span className="rs-pts" style={{ left: pnx, top: pny, height: pny1 - pny }}><b className="num-tab">{pts}</b><small>/ {cap}</small></span>
        <span className="rs-ptbar" style={{ left: bx0 + 2, top: by0 + 3, width: bx1 - bx0 - 4, height: by1 - by0 - 6 }}><i style={{ width: `${Math.min(100, (pts / cap) * 100)}%` }} /></span>
        {img('gift', 'btn b2')}
        {img('pull1', 'btn b3 pull')}
        {img('pull10', 'btn b4 pull ten')}
        <Hit r={box('exchange')} label="교환소" onClick={() => onShop('exchange')} />
        <Hit r={box('points')} label={`영입 포인트 ${pts} / ${cap}`} onClick={() => onShop('exchange')} />
        <Hit r={box('gift')} label="영입 포인트 보상(교환소)" onClick={() => onShop('exchange')} />
        <Hit r={box('pull1')} label={`1회 영입, 영입 티켓 ${banner.costPerPull.amount}장`} disabled={busy || !!play} onClick={() => pull(1)} sfx="none" className="hit-pull1 rs-pullhit" />
        <Hit r={box('pull10')} label={`${multi}회 영입, 영입 티켓 ${banner.costPerPull.amount * multi}장`} disabled={busy || !!play} onClick={() => pull(multi)} sfx="none" className="hit-pull10 rs-pullhit" />

        {/* 뽑기 장치 */}
        <div className={`rs-dev dev-${kind}`} key={`dev-${demo}`} data-demo={demo > 0 ? 'y' : undefined}>
          {kind === 'capsule' && <>
            {img('dev', 'dev-body')}
            <span className="rs-knob" style={{ left: cfg.knob![0] - cfg.knob![2] - 2, top: cfg.knob![1] - cfg.knob![2] - 2 }}>{img('dev-knob', '', { left: 0, top: 0 })}</span>
          </>}
          {kind === 'lottery' && <>
            {img('dev-stand', 'dev-stand')}
            <span className="rs-drum" style={{ transformOrigin: `${cfg.axle![0]}px ${cfg.axle![1]}px` }}>{img('dev-drum')}</span>
          </>}
          {kind === 'peel' && <>
            {img('dev', 'dev-body')}
            <i className="rs-peel-glow" style={{ left: cfg.flap![0] - 6, top: cfg.flap![1] + 30, width: cfg.flap![2] - cfg.flap![0] + 12, height: cfg.flap![3] - cfg.flap![1] - 26 }} />
            <span className="rs-flap" style={{ transformOrigin: `${cfg.flap![0]}px ${cfg.flap![1]}px` }}>{img('dev-flap')}</span>
          </>}
        </div>
        <Hit r={{ x: dev[0], y: dev[1], w: dev[2] - dev[0], h: dev[3] - dev[1] }} label="뽑기 장치(움직여 보기)" onClick={tryDevice} sfx="none" className="rs-devhit" />
        {tip && <div className="rs-tip" role="status" style={{ left: (dev[0] + dev[2]) / 2, top: dev[1] - 14 }}>영입 버튼을 누르면 {kind === 'capsule' ? '돌려서 뽑습니다' : kind === 'lottery' ? '추첨기를 돌립니다' : '종이를 벗겨 확인합니다'}</div>}
      </div>

      {/* 영입 연출: 장치가 움직이고 결과가 튀어나온 뒤 결과 화면으로 */}
      {play && (
        <div className={`rs-play play-${kind} ${play.n > 1 ? 'multi' : ''}`} key={play.k} aria-hidden>
          {Array.from({ length: play.n > 1 ? 5 : 1 }, (_, i) => (
            <i key={i} className="rs-prize" style={{ '--i': i, left: kind === 'capsule' ? 840 : kind === 'lottery' ? 860 : (cfg.flap![0] + cfg.flap![2]) / 2, top: kind === 'capsule' ? 902 : kind === 'lottery' ? 868 : (cfg.flap![1] + cfg.flap![3]) / 2 } as CSSProperties} />
          ))}
          <i className="rs-burst" style={{ left: (dev[0] + dev[2]) / 2, top: (dev[1] + dev[3]) / 2 + 10 }} />
          <i className="rs-play-flash" />
        </div>
      )}
      {children}
    </MotionStage>
  )
}
