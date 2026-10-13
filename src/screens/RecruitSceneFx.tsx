import { useMemo, type CSSProperties } from 'react'
import '../styles/recruit-scene-fx.css'
import fxJson from '../game/data/ref-recruit-fx.json'

// NIGHT SHIFT · ONE MORE PLAY? 전용 연출 층(입력 받지 않음). 좌표는 시안 캔버스(1672×941).
type Box = { x: number; y: number; w: number; h: number; file: string }
const FX = fxJson as unknown as {
  nightshift: { titleText: string; titleFrame: string; night: string; shift: string; title: Omit<Box, 'file'>; frame: number[][] }
  omp: { tagNoName: string; tagName: { x: number; y: number; h: number }; letters: (Box & { row: number })[]; mosaic: { file: string; w: number; h: number; bs: number }[]; sign: Box; nocoin: Box; screen: number[][]; buttons: [number, number, number, string][] }
}

/** ONE MORE PLAY? 이름표: 이름 글자를 지운 그림 + 실제 이름 위치 */
export const FX_TAG = { file: FX.omp.tagNoName, name: FX.omp.tagName }

/** 미리 받아 둘 연출용 그림 */
export function fxFiles(): string[] {
  return [FX.nightshift.night, FX.nightshift.shift, FX.nightshift.titleFrame, FX.omp.tagNoName, ...FX.omp.letters.map((l) => l.file), ...FX.omp.mosaic.map((m) => m.file), FX.omp.sign.file, FX.omp.nocoin.file]
}

function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}
const at = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({ left: b.x, top: b.y, width: b.w, height: b.h })

/* ───────────── NIGHT SHIFT ───────────── */

/** 진입: 어두운 막이 걷히며 터널등 빛 한 번 — 줄(짝대기) 효과 없음. 속도감은 글자·인물·UI가 좌우에서 꽂히는 것으로 */
export function NightIntro() {
  return (
    <div className="ns-intro" aria-hidden>
      <i className="ns-veil" />
      <i className="ns-flash a" />
    </div>
  )
}

/** 장면 층: 달리는 열차 — 창밖 도시 불빛(둥근 번짐)이 흘러가고, 터널등이 주기적으로 지나간다 */
export function NightWindow() {
  const lights = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: 34 }, () => ({ top: 110 + r() * 600, s: 14 + r() * 40, dur: 1.2 + r() * 2, d: -r() * 4, o: 0.5 + r() * 0.5, warm: r() < 0.6 }))
  }, [])
  return (
    <div className="ns-window" aria-hidden>
      {lights.map((l, i) => <i key={i} className={`ns-bokeh ${l.warm ? 'warm' : ''}`} style={{ top: l.top, width: l.s, height: l.s, opacity: l.o, animationDuration: `${l.dur}s`, animationDelay: `${l.d}s` } as CSSProperties} />)}
      <i className="ns-lamp a" /><i className="ns-lamp b" />
    </div>
  )
}

/** 실내로 들어오는 터널등 빛(장면 전체를 훑는 따뜻한 띠) + 가끔 전력 깜빡임 */
export function NightWash() {
  return <><i className="ns-wash" aria-hidden /></>
}
export function NightDim() {
  return <i className="ns-dim" aria-hidden />
}

/** 인물 위 빛: 터널등이 지날 때 인물 모양대로 따뜻한 빛이 훑고 지나감(인물 알파로 잘림) */
export function NightCharLight({ src, box }: { src: string; box: { x: number; y: number; w: number; h: number } }) {
  const mask = `url("${src}")`
  return <i className="ns-charlight" aria-hidden style={{ ...at(box), WebkitMaskImage: mask, maskImage: mask }} />
}

/** 잔상(진입 때 인물 뒤에 남는 그림자 두 장) */
export function NightGhosts({ src, box }: { src: string; box: { x: number; y: number; w: number; h: number } }) {
  return <>{[1, 2, 3].map((k) => <img key={k} className={`ns-ghost g${k}`} src={src} alt="" aria-hidden draggable={false} style={at(box)} />)}</>
}

/** 제목: NIGHT는 왼쪽에서, SHIFT는 오른쪽에서 날아와 박히고, 주황 틀이 그려진다 */
export function NightTitle() {
  const t = FX.nightshift.title
  return (
    <>
      <img className="rs-s ns-frame" src={FX.nightshift.titleFrame} alt="" draggable={false} style={at(t)} />
      <img className="rs-s ns-night" src={FX.nightshift.night} alt="" draggable={false} style={at(t)} />
      <img className="rs-s ns-shift" src={FX.nightshift.shift} alt="" draggable={false} style={at(t)} />
    </>
  )
}

/* ───────────── ONE MORE PLAY? ───────────── */

/** 진입: 오락기 브라운관이 켜지듯 — 가운데 밝은 가로줄이 위아래로 열리며 장면이 나타나고, 주사선·색 번짐이 걷힘 */
export function OmpIntro() {
  return (
    <div className="omp-crt" aria-hidden>
      <i className="half top" /><i className="half bot" />
      <i className="beam" />
      <i className="scan" />
      <span className="omp-boot">INSERT COIN</span>
    </div>
  )
}

/** 오락기 위로 가끔 떠오르는 점수 글자(1UP · +100 · HI-SCORE · PERFECT · COMBO) */
export function OmpPopups() {
  const P: [number, number, string, string][] = [
    [1560, 330, '1UP', '#7dffb0'], [905, 470, '+100', '#ffd36a'], [1450, 300, 'HI-SCORE!', '#ff8fa8'],
    [1240, 400, 'COMBO x3', '#7fd6ff'], [880, 520, 'PERFECT', '#ffd36a'], [1600, 470, '+500', '#ffe08a'],
  ]
  return <>{P.map(([x, y, t, c], i) => <b key={i} className="omp-pop" aria-hidden style={{ left: x, top: y, color: c, '--i': i } as CSSProperties}>{t}</b>)}</>
}

/** 인물: 모자이크 3단계 → 선명하게(8비트 게임처럼 나타남) */
export function OmpMosaic({ box }: { box: { x: number; y: number } }) {
  return <>{FX.omp.mosaic.map((m, i) => <img key={m.bs} className={`omp-px p${i}`} src={m.file} alt="" aria-hidden draggable={false} style={{ left: box.x, top: box.y, width: m.w, height: m.h }} />)}</>
}

/** 제목 글자 12개: 하나씩 튀어나오고, 대기 중엔 오락기 대기 화면처럼 차례로 통통 */
export function OmpTitle() {
  const L = FX.omp.letters
  const rot = [-14, 10, -8, 12, -10, 8, -12, 14, -9, 11, -13, 9]
  return (
    <>
      {L.map((l, i) => <img key={i} className="rs-s omp-l" src={l.file} alt="" draggable={false} style={{ ...at(l), '--i': i, '--r': `${rot[i]}deg` } as CSSProperties} />)}
      {[[352, 238], [905, 252], [866, 382], [392, 520], [640, 222], [878, 508]].map(([x, y], i) => <i key={i} className="omp-star" aria-hidden style={{ left: x, top: y, '--i': i } as CSSProperties} />)}
    </>
  )
}

/** 장면 층: 창 햇살, 간판 네온, 오락기 화면(구름·주사선·INSERT COIN 깜빡), 버튼 불빛 */
export function OmpScene() {
  const O = FX.omp
  const clip = `polygon(${O.screen.map(([x, y]) => `${x - 1484}px ${y - 318}px`).join(',')})`
  return (
    <div className="omp-scene" aria-hidden>
      <i className="omp-ray r1" /><i className="omp-ray r2" /><i className="omp-ray r3" />
      <img className="omp-sign" src={O.sign.file} alt="" draggable={false} style={at(O.sign)} />
      <div className="omp-screen" style={{ left: 1484, top: 318, width: 188, height: 204, clipPath: clip }}>
        <i className="cloud c1" /><i className="cloud c2" /><i className="roll" /><i className="lines" />
      </div>
      <img className="omp-nocoin" src={O.nocoin.file} alt="" draggable={false} style={at(O.nocoin)} />
      {O.buttons.map(([x, y, r, c], i) => <i key={i} className="omp-btn" style={{ left: x - r * 2.2, top: y - r * 2.2, width: r * 4.4, height: r * 4.4, '--c': c, '--i': i } as CSSProperties} />)}
      <i className="omp-floor" />
    </div>
  )
}
