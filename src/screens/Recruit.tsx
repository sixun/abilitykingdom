import { useEffect, useState } from 'react'
import '../styles/recruit.css'
import { useNav, useScreenKey } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import { BANNERS, BANNER_BY_ID } from '../game/data/catalog'
import { CHAR_BY_ID } from '../game/data/characters'
import { GAME_CONFIG, ROLE_LABEL, ATTRIBUTE_LABEL } from '../game/config'
import { Btn, Modal, fmt, useAction, ErrorBanner, ProvisionalTag } from '../ui/components'
import { RefLayers, Hit, Patch, TextlessPatch, rectOf, boxStyle, SKIN, type RefLayout, type TextlessMeta } from '../ui/ref'
import layoutJson from '../game/data/ref-recruitment.json'
import fitJson from '../game/data/motion-fit.json'
import matteJson from '../game/data/ref-matte.json'
import textlessJson from '../game/data/ref-textless.json'
import cutJson from '../game/data/recruit-cut.json'
import { MotionVideo } from '../ui/motion'
import '../styles/motion.css'
import { MotionStage as RefStage, MotionItem, MotionTitle, MotionTicker, AmbientFx, Glint, glintOf } from '../ui/ui-motion'
import NewFaces from './NewFaces'
import RecruitScene, { type SceneName } from './RecruitScene'
import { CHARACTERS } from '../game/data/characters'

// 신규 대원 미리보기: 설정 미확정 대원 중 배너 픽업이 아닌 대원(배너 픽업 대원은 배너에서 소개)
const NEW_FACES = CHARACTERS.filter((c) => c.pending && !BANNERS.some((b) => b.featuredId === c.id))
// 새 배너 3종은 시안 화면(1672×941)으로 그린다
const SCENE: Record<string, SceneName> = { b_serenity: 'serenity', b_nightshift: 'nightshift', b_omp: 'omp' }
const THUMB: Record<string, string> = { b_serenity: 'ref/recruit/thumb-serenity.webp', b_nightshift: 'ref/recruit/thumb-nightshift.webp', b_omp: 'ref/recruit/thumb-omp.webp' }

// 방송 콘셉트 영입 원본(1456×819)을 원본 조각 24개로 재현.
// 이 화면(원본 키비주얼)은 '주파수 너머(리온)' 배너. 나머지 3종(SERENITY·NIGHT SHIFT·ONE MORE PLAY?)은 RecruitScene(배너 시안)으로 그리고,
// 여기 목록의 2~4번째 칸은 그 시안에서 따낸 썸네일로 바꿔 그린다.
const L = layoutJson as RefLayout
const REF = { diamond: 12800, ticket: 24, points: 120 }
const BANNER_SLICES = ['banner-limited', 'banner-standard', 'banner-rhythm', 'banner-reunion']
const TOP_SLICES = ['back', 'brand-title', 'tab-limited', 'tab-standard', 'currency-gems', 'currency-tickets']
const ACTION_SLICES = ['info-detail', 'info-probability', 'exchange', 'recruit-points', 'points-gift', 'pull-one', 'pull-ten', 'bottom-bar-remainder']
const BANNER_IDS = ['b_rion', 'b_serenity', 'b_nightshift', 'b_omp']
const PILL = '#323840'
const FIT = fitJson as unknown as Record<string, { s: number; x: number; y: number }>
// 리온 배너에서 쓰는 조각: 알약 버튼은 둥근 매트, 리온과 겹치는 제목·클로즈업은 겹친 부분만 투명(tools/build_motion_plates.py)
const MATTE_R = { ...(matteJson as Record<string, Record<string, string>>).recruitment, ...(cutJson as Record<string, string>) }
const TL = (textlessJson as Record<string, Record<string, TextlessMeta>>).recruitment
const IVORY = '#f5ede4'

// 결과 화면에서 돌아와도(화면이 다시 만들어져도) 고르던 배너를 유지: 화면 경로 키별로 기억
const LAST_BANNER = new Map<number, string>()

export default function Recruit({ params }: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const routeKey = useScreenKey()
  const [bannerId, setBannerIdRaw] = useState<string>(() => LAST_BANNER.get(routeKey) ?? (BANNER_BY_ID[params.bannerId as string] ? (params.bannerId as string) : 'b_rion'))
  const setBannerId = (id: string) => { LAST_BANNER.set(routeKey, id); setBannerIdRaw(id) }
  const [kind, setKind] = useState<'limited' | 'standard'>(BANNER_BY_ID[bannerId]?.kind ?? 'limited')
  const [modal, setModal] = useState<null | 'detail' | 'rates'>(null)
  const [faces, setFaces] = useState(false) // 신규 대원 미리보기(소개용, 영입 풀과 무관)
  const { run, pending, failed, clearFailed } = useAction()
  const b = BANNER_BY_ID[bannerId]
  const f = CHAR_BY_ID[b.featuredId]
  const isRefBanner = bannerId === 'b_rion'
  // 리온 배너로 들어올 때마다 전환 효과를 다시 재생(다른 배너에서는 리온 영상을 그리지 않음)
  const [enterKey, setEnterKey] = useState(0)
  useEffect(() => { if (isRefBanner) setEnterKey((k) => k + 1) }, [isRefBanner])

  const pull = async (count: number, play?: () => Promise<void>) => {
    const res = await run(`pull${count}`, (rid) => game.recruit(bannerId, count, rid))
    if (res?.ok) { if (play) await play(); audio.sfx('open'); nav.push('recruitResult', { txId: res.value.requestId }) }
  }
  const scene = SCENE[bannerId]
  const pickKind = (k: 'limited' | 'standard') => {
    if (k === kind) return
    audio.sfx('select'); setKind(k)
    if (BANNER_BY_ID[bannerId].kind !== k) setBannerId(BANNERS.find((x) => x.kind === k)!.id)
  }

  const W = s.wallet
  const pts = W.scoutPoint
  const tabL = rectOf(L, 'tab-limited'), tabS = rectOf(L, 'tab-standard')
  const selIdx = BANNER_IDS.indexOf(bannerId)

  const overlays = (
    <>
      {pending && <div style={{ position: 'absolute', inset: 0, zIndex: 90, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.35)', fontSize: 28, fontWeight: 900 }}>영입 처리 중…</div>}
      {failed && (
        <div style={{ position: 'absolute', right: 20, bottom: 112, zIndex: 91, width: 640 }} onClick={(e) => e.stopPropagation()}>
          <ErrorBanner error={failed.error} onRetry={() => pull(failed.key === 'pull1' ? 1 : GAME_CONFIG.multiPullCount)} onClose={clearFailed} />
          {failed.error.code === 'INSUFFICIENT' && <div style={{ marginTop: 6, textAlign: 'right' }}><Btn size="sm" variant="primary" onClick={() => nav.push('shop', { tab: 'recommend' })}>티켓 구매하러 가기</Btn></div>}
        </div>
      )}
    </>
  )

  return (
    <div className="scr">
      {scene ? (
        <RecruitScene key={scene} name={scene} banner={b} order={BANNER_IDS} wallet={W} newFaces={NEW_FACES.map((c) => ({ id: c.id, portrait: c.assets.portrait }))} busy={!!pending}
          onBanner={(id) => { setBannerId(id); setKind(BANNER_BY_ID[id].kind) }} onKind={pickKind} onPull={(n, play) => pull(n, play)} onBack={() => nav.back()}
          onShop={(tab) => nav.push('shop', { tab })} onFaces={() => setFaces(true)} onDetail={() => setModal('detail')} onRates={() => setModal('rates')}>
          {overlays}
          {faces && <div className="rs-nf-scale"><NewFaces onClose={() => setFaces(false)} /></div>}
        </RecruitScene>
      ) : (
      <RefStage canvas={L.canvas} className="ui-recruit">
        <img className="ref-bg" src="ref/restored/recruitment-bg.webp" alt="" />
        {isRefBanner ? (
          <>
            {/* 리온 배너: 원본 장면에서 리온을 지운 배경판 → 리온 대기 영상(배경 제거) → 원본 UI 조각 */}
            <RefLayers layout={L} ids={['scene-remainder']} z={1} files={{ 'scene-remainder': 'ref/recruitment/motion/scene-plate.webp' }} />
            <div className="cdx rcx-rion" key={`rion-${enterKey}`}>
              <MotionVideo src="motion/recruit.webm" poster="motion/recruit-poster.webp" alpha className="char" style={{ left: FIT.recruit.x, top: FIT.recruit.y, width: 1080 * FIT.recruit.s, height: 1080 * FIT.recruit.s, clipPath: `inset(0 0 ${1080 * FIT.recruit.s - (716 - FIT.recruit.y)}px 0)` }} />
            </div>
            {/* 리온 주변 라임 불티 + 방송 스캔선 */}
            <AmbientFx kind="lime" box={{ x: 262, y: 0, w: 1194, h: 716 }} count={24} z={1} clip="polygon(0 92px, 406px 92px, 406px 0, 793px 0, 793px 62px, 1194px 62px, 1194px 645px, 808px 645px, 808px 716px, 0 716px)" />
            <RefLayers layout={L} hide={new Set(['scene-remainder', 'promo-title', ...BANNER_SLICES, ...TOP_SLICES, ...ACTION_SLICES])} z={1} files={MATTE_R} />
            {/* 라이브 타이포: 글자 마스크 + 방송 띠, 인물과 독립된 타임라인 */}
            <div className="ui-recruit-title" key={`title-${enterKey}`} aria-label={b.title}>
              <svg className="ui-broadcast-mark" viewBox="0 0 140 40" aria-hidden><path d="M8 30 4 8 25 21 38 2 47 21 69 8 65 30Z" fill="currentColor" /><path d="M82 16v12m10-23v35m10-28v22m10-15v8m10-22v33m10-20v11" stroke="currentColor" strokeWidth="5" /></svg>
              <h2><MotionTitle text={b.title} /></h2>
              <span className="ui-broadcast-caption">PIRATE SCOUTING BROADCAST</span>
              <MotionTicker text="ON AIR / 주파수 너머" className="ui-broadcast-tape" />
            </div>
            {/* 파형: 0.8~1.6초 간격으로 막대 높이가 바뀌는 장식(실제 소리 분석 아님) */}
            <TextlessPatch m={TL.wave} z={2}>
              <span className="rc-wave">{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <i key={i} style={{ animationDuration: `${0.8 + ((i * 37) % 9) / 10}s`, animationDelay: `${-(i * 0.23)}s` }} />)}</span>
            </TextlessPatch>

            {/* REC 점: 1.6초 느린 점멸 */}
            <div className="rc-rec" aria-hidden />
          </>
        ) : <RefLayers layout={L} hide={new Set([...BANNER_SLICES, ...TOP_SLICES, ...ACTION_SLICES])} z={1} />}

        <div className="ui-recruit-transition" key={`transition-${bannerId}`} aria-hidden />
        <MotionItem order={0} z={32} className="ui-chrome ui-chrome-top" idle={false}>
          <RefLayers layout={L} ids={TOP_SLICES} z={1} files={isRefBanner ? MATTE_R : undefined} />
          <div className="ui-recruit-tabline" aria-hidden style={{ left: kind === 'limited' ? 302 : 490 }} />
          {/* 탭 상태(상시 선택 시) */}
          {kind === 'standard' && (
            <>
              <Patch r={tabL} skin={SKIN('button-dark')} bg="#1b1b20" z={30} className="rr-tab"><span>한정 영입</span></Patch>
              <Patch r={tabS} skin={SKIN('button-lime')} bg="#1b1b20" z={30} className="rr-tab"><span style={{ color: '#15181b' }}>상시 영입</span></Patch>
            </>
          )}
          {/* 재화·포인트(원본 값과 다를 때만 숫자 영역을 덮음) */}
          {W.diamond !== REF.diamond && <Patch r={{ x: 1122, y: 20, w: 76, h: 27 }} bg={PILL} z={30} className="rr-pill" style={{ padding: 0 }}><span className="num-tab" style={{ marginLeft: 'auto', marginRight: 4 }}>{fmt(W.diamond)}</span></Patch>}
          {W.ticket !== REF.ticket && <Patch r={{ x: 1296, y: 20, w: 76, h: 27 }} bg={PILL} z={30} className="rr-pill" style={{ padding: 0 }}><span className="num-tab" style={{ marginLeft: 'auto', marginRight: 4 }}>{fmt(W.ticket)}</span></Patch>}
          <Hit r={rectOf(L, 'back')} label="돌아가기" onClick={() => nav.back()} />
          <Hit r={tabL} label={`한정 영입${kind === 'limited' ? ' (선택됨)' : ''}`} onClick={() => pickKind('limited')} sfx="none" />
          <Hit r={tabS} label={`상시 영입${kind === 'standard' ? ' (선택됨)' : ''}`} onClick={() => pickKind('standard')} sfx="none" />
          <Hit r={rectOf(L, 'currency-gems')} label={`다이아 ${W.diamond}, 충전`} onClick={() => nav.push('shop', { tab: 'currency' })} />
          <Hit r={rectOf(L, 'currency-tickets')} label={`영입 티켓 ${W.ticket}, 구매`} onClick={() => nav.push('shop', { tab: 'recommend' })} />
        </MotionItem>
        <MotionItem order={6} z={32} className="ui-chrome ui-chrome-actions" key={`actions-${bannerId}`} idle={false}>
          <RefLayers layout={L} ids={ACTION_SLICES} z={1} files={isRefBanner ? MATTE_R : undefined} />
          <Glint g={glintOf(L, 'pull-ten', isRefBanner ? MATTE_R : undefined)!} className="ui-glint-cta" />
          {pts !== REF.points && (
            <>
              <Patch r={{ x: 354, y: 741, w: 100, h: 27 }} bg={IVORY} z={30} style={{ display: 'flex', alignItems: 'baseline', gap: 6, color: '#202024' }}>
                <b className="num-tab" style={{ fontSize: 22, fontWeight: 800, marginLeft: 6 }}>{pts}</b><span style={{ fontSize: 17, color: '#55555c' }}>/ {GAME_CONFIG.scoutPointCap}</span>
              </Patch>
              <Patch r={{ x: 262, y: 770, w: 366, h: 19 }} bg={IVORY} z={30}>
                <div style={{ position: 'absolute', left: 1, top: 1, right: 1, bottom: 1, borderRadius: 9, background: '#e5ddd4', boxShadow: 'inset 0 0 0 1px #b9b1a8', overflow: 'hidden' }}>
                  <i style={{ display: 'block', height: '100%', width: `${Math.min(100, (pts / GAME_CONFIG.scoutPointCap) * 100)}%`, background: '#c6aefa' }} />
                </div>
              </Patch>
            </>
          )}

          <Hit r={rectOf(L, 'info-detail')} label="상세 정보" onClick={() => setModal('detail')} />
          <Hit r={rectOf(L, 'info-probability')} label="확률 정보" onClick={() => setModal('rates')} />
          <Hit r={rectOf(L, 'exchange')} label="교환소" onClick={() => nav.push('shop', { tab: 'exchange' })} />
          <Hit r={rectOf(L, 'recruit-points')} label={`영입 포인트 ${pts} / ${GAME_CONFIG.scoutPointCap}`} onClick={() => nav.push('shop', { tab: 'exchange' })} />
          <Hit r={rectOf(L, 'points-gift')} label="영입 포인트 보상(교환소)" onClick={() => nav.push('shop', { tab: 'exchange' })} />
          <Hit r={rectOf(L, 'pull-one')} label={`1회 영입, 영입 티켓 ${b.costPerPull.amount}장`} disabled={!!pending} onClick={() => pull(1)} sfx="none" className="hit-pull1" />
          <Hit r={rectOf(L, 'pull-ten')} label={`${GAME_CONFIG.multiPullCount}회 영입, 영입 티켓 ${b.costPerPull.amount * GAME_CONFIG.multiPullCount}장`} disabled={!!pending} onClick={() => pull(GAME_CONFIG.multiPullCount)} sfx="none" className="hit-pull10" />
        </MotionItem>

        {/* 신규 대원 미리보기 진입(원본에 없는 추가 버튼: 탭과 재화 사이 빈 상단 영역) */}
        {NEW_FACES.length > 0 && (
          <>
            <div className="rr-newfaces" aria-hidden style={{ left: 682, top: 34, width: 330, height: 50 }}>
              <span className="faces">{NEW_FACES.map((c) => <img key={c.id} src={c.assets.portrait} alt="" />)}</span>
              <b>NEW FACES</b><span>미리보기</span>
            </div>
            <Hit r={{ x: 682, y: 34, w: 330, h: 50 }} z={34} label={`신규 대원 ${NEW_FACES.length}명 미리보기 (영입 대상 아님)`} onClick={() => setFaces(true)} />
          </>
        )}
        {/* 배너 선택 */}
        {BANNER_SLICES.map((id, i) => {
          const bb = BANNER_BY_ID[BANNER_IDS[i]]
          return <MotionItem key={id} order={i} z={40} className={`ui-banner-item ${i === selIdx ? 'is-selected' : ''}`}>
            {i === 0 ? <RefLayers layout={L} ids={[id]} z={1} /> : <img className="rr-thumb" src={THUMB[bb.id]} alt="" draggable={false} style={boxStyle(rectOf(L, id), { zIndex: 1 })} />}
            <Hit r={rectOf(L, id)} label={`${bb.kind === 'limited' ? '한정' : '상시'} 배너 ${bb.title}${i === selIdx ? ' (선택됨)' : ''}`} onClick={() => { setBannerId(bb.id); setKind(bb.kind) }} sfx="select" className="hit-banner" />
          </MotionItem>
        })}
        <div className="ui-banner-cursor" aria-hidden style={{ top: rectOf(L, BANNER_SLICES[Math.max(0, selIdx)]).y + 12, height: rectOf(L, BANNER_SLICES[Math.max(0, selIdx)]).h - 24 }} />
        {overlays}
        {faces && <NewFaces onClose={() => setFaces(false)} />}
      </RefStage>
      )}

      {modal === 'detail' && (
        <Modal onClose={() => setModal(null)} labelledBy="rd-title">
          <h2 id="rd-title">{b.title} · 상세 정보</h2>
          <div className="confirm-body">
            <p>픽업: <b>{f.name}</b> ({f.rarity}★{f.pending ? '' : ` · ${ROLE_LABEL[f.role]}`})</p>
            {f.pending && <p className="muted">{f.name}은(는) 설정(역할·능력) 확정 전이라 아직 영입 대상에 넣지 않았습니다. 지금은 아래 대원만 나옵니다.</p>}
            <p>기간: {b.end ? `${b.start} ~ ${b.end}` : '상시'}</p>
            <p>비용: 영입 티켓 1장 / 1회 · {GAME_CONFIG.multiPullCount}회 영입은 {GAME_CONFIG.multiPullCount}장</p>
            <p>{b.kind === 'limited' ? `영입 1회당 영입 포인트 10 적립.${f.pending ? '' : ` 포인트 ${GAME_CONFIG.scoutPointCap}으로 교환소에서 픽업 캐릭터 교환(샘플).`}` : '상시 영입은 포인트가 적립되지 않습니다(샘플).'}</p>
            <p className="muted">천장·중복 전환·보장 규칙은 아직 정해지지 않았습니다. 이 프로토타입의 결과는 기기에서 계산되며 운영용이 아닙니다.</p>
            <h3>영입 대상</h3>
            <div className="rd-pool">{b.pool.map((id) => <span key={id}><img src={CHAR_BY_ID[id].assets.portrait} alt="" />{CHAR_BY_ID[id].name} {CHAR_BY_ID[id].rarity}★</span>)}</div>
          </div>
          <div className="confirm-actions">
            <Btn variant="dark" onClick={() => { setModal(null); nav.push('recruitHistory') }}>영입 기록</Btn>
            <Btn variant="dark" onClick={() => setModal(null)}>닫기</Btn>
          </div>
        </Modal>
      )}
      {modal === 'rates' && (
        <Modal onClose={() => setModal(null)} labelledBy="rr-title">
          <h2 id="rr-title">확률 정보 <ProvisionalTag>프로토타입 샘플 값</ProvisionalTag></h2>
          <table className="rate-table">
            <thead><tr><th>등급</th><th>확률</th><th>대상</th></tr></thead>
            <tbody>
              {b.rates.map((r) => {
                const ids = b.pool.filter((id) => CHAR_BY_ID[id].rarity === r.rarity)
                return <tr key={r.rarity}><td>{r.rarity}★</td><td className="num">{(r.rate * 100).toFixed(1)}%</td><td>{ids.map((id) => CHAR_BY_ID[id].name + (id === b.featuredId && b.pickupShare ? `(픽업 ${b.pickupShare * 100}%)` : '')).join(', ')}</td></tr>
              })}
            </tbody>
          </table>
          {f.pending && <p className="muted" style={{ marginTop: '1.2rem', fontSize: '1.4rem' }}>픽업 {f.name}({f.rarity}★)은 설정 확정 전이라 아직 영입 대상이 아닙니다.</p>}
          <p className="muted" style={{ marginTop: '1.4rem', fontSize: '1.4rem' }}>실제 확률·천장·중복 처리는 기획 확정 후 서버에서 결정합니다.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setModal(null)}>닫기</Btn></div>
        </Modal>
      )}
    </div>
  )
}
