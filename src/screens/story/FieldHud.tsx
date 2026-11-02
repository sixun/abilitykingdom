import { useEffect, useRef, useState, type PointerEvent as RPE, type ReactNode } from 'react'
import '../../styles/field-hud.css'
import type { Zone } from '../../explore/zones'
import SPRITES from 'virtual:hud-sprites'

// 스토리 탐색 필드 HUD — 사용자 시안(tools/hud/field_hud_mock.png, 1672×941)을 그대로 옮긴 배치.
// 좌표는 시안 픽셀 그대로 쓰고, 화면(1280×720)에는 통째로 줄여 얹는다. 버튼·아이콘 그림은 시안에서 잘라낸 것(src/assets/hud, tools/hud/slice_hud.py).
// 그림은 묶음 안에 data URL 로 넣는다(아티팩트 파일 개수 한도 512 때문에 따로 파일을 늘리지 않음).
// 글자·수치·막대·패널은 실제 값으로 그린다. 기능은 StoryField 가 넘겨주는 상태·동작을 그대로 쓴다(이 파일은 그리기만).
export type ChatTab = 'world' | 'party' | 'whisper' | 'system'
export type ChatLine = { tab: ChatTab; who?: string; text: string; at: number }
export type Buff = { id: string; icon: string; name: string; desc: string; left: number; max: number }
export type Marker = { x: number; y: number; k: 'npc' | 'spot' | 'portal' | 'ev' | 'target' | 'dest' }
export type HudModel = {
  zone: Zone
  me: { x: number; y: number; dir: number }
  view?: { x: number; y: number; z: number }
  lead: { name: string; level: number; trial: boolean; face: string; hp: number; hpMax: number }
  party: { id: string; name: string; level: number; trial: boolean; face: string; hp: number; hpMax: number; canSwap: boolean }[]
  active: { left: number; max: number }
  awaken: { gauge: number; on: boolean }
  dodge: { left: number; max: number }
  buffs: Buff[]
  quest: { show: boolean; tag: string; goal: string; dist: number | null; auto: boolean; done: boolean }
  wallet: { credit: number; diamond: number }
  badge: { event: boolean; menu: boolean; quest: boolean }
  markers: Marker[]
  canTalk: boolean
  talkLabel: string
  targetName: string | null
  mounted: boolean
  dancing: boolean
  chat: { tab: ChatTab; lines: ChatLine[]; small: boolean }
  exp: { level: number; cur: number; need: number }
  chapter: string
}
export type HudActions = {
  go: (screen: 'events' | 'shop' | 'recruit' | 'bag' | 'characters' | 'characterDetail' | 'missions' | 'mail' | 'notices' | 'settings' | 'caseFile', params?: Record<string, unknown>) => void
  back: () => void
  swap: (id: string) => void
  attack: () => void
  active: () => void
  awaken: () => void
  dodge: () => void
  talk: () => void
  dance: () => void
  target: () => void
  mount: () => void
  camp: () => void
  autoQuest: () => void
  moveTo: (x: number, y: number) => void
  toggleQuest: () => void
  chatTab: (t: ChatTab) => void
  chatSmall: () => void
  say: (tab: ChatTab, text: string) => void
  stick: { down: (e: RPE<HTMLDivElement>) => void; move: (e: RPE<HTMLDivElement>) => void; up: () => void; knob: { x: number; y: number } }
  questList: { id: string; no: string; title: string; place: string; state: 'done' | 'next' | 'lock' }[]
}

const n = (v: number) => v.toLocaleString('en-US')
const TAB: Record<ChatTab, string> = { world: '월드', party: '파티', whisper: '귓속말', system: '시스템' }
const img = (k: string) => SPRITES[k] ?? ''

/** 시안의 버튼: 그림 + 아래 이름표 */
function Btn({ k, x, y, w, h, label, lx, ly, onClick, dot, disabled, children, aria, className = '' }: { k?: string; x: number; y: number; w: number; h: number; label?: string; lx?: number; ly?: number; onClick: () => void; dot?: boolean; disabled?: boolean; children?: ReactNode; aria?: string; className?: string }) {
  return (
    <button type="button" className={`fh-btn ${className} ${disabled ? 'off' : ''}`} style={{ left: x, top: y, width: w, height: h }} onClick={onClick} aria-label={aria ?? label} aria-disabled={disabled || undefined}>
      {k && <img src={img(k)} alt="" draggable={false} />}
      {children}
      {dot && <i className="fh-dot" aria-hidden />}
      {label && <b className="fh-lab" style={{ left: lx ?? '50%', top: ly ?? h - 4 }}>{label}</b>}
    </button>
  )
}

function Bar({ x, y, w, h, v, kind, text, tip = true }: { x: number; y: number; w: number; h: number; v: number; kind: 'hp' | 'act' | 'thin' | 'thin-act'; text?: string; tip?: boolean }) {
  return (
    <div className={`fh-bar ${kind} ${tip ? 'tip' : ''}`} style={{ left: x, top: y, width: w, height: h }}>
      <i style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
      {text && <span>{text}</span>}
    </div>
  )
}

export function FieldHud({ m, a }: { m: HudModel; a: HudActions }) {
  const [pop, setPop] = useState<null | 'menu' | 'chapter' | 'map' | 'quests' | 'buff'>(null)
  const [buffTip, setBuffTip] = useState<Buff | null>(null)
  const [miniZoom, setMiniZoom] = useState(1)
  const [showParty, setShowParty] = useState(true)
  const [typing, setTyping] = useState(false)
  const [msg, setMsg] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [net, setNet] = useState<{ rtt: number | null; online: boolean; batt: number | null; charging: boolean }>({ rtt: null, online: true, batt: null, charging: false })
  const chatRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000)
    const nav = navigator as Navigator & { connection?: { rtt?: number }; getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (e: string, f: () => void) => void }> }
    const upd = () => setNet((s) => ({ ...s, rtt: nav.connection?.rtt ?? null, online: navigator.onLine }))
    upd(); const id2 = setInterval(upd, 5000)
    nav.getBattery?.().then((b) => { const f = () => setNet((s) => ({ ...s, batt: b.level, charging: b.charging })); f(); b.addEventListener('levelchange', f); b.addEventListener('chargingchange', f) }).catch(() => {})
    return () => { clearInterval(id); clearInterval(id2) }
  }, [])
  useEffect(() => { const el = chatRef.current; if (el) el.scrollTop = el.scrollHeight }, [m.chat.lines.length, m.chat.tab])

  const toggle = (p: NonNullable<typeof pop>) => setPop((v) => (v === p ? null : p))
  const z = m.zone
  // 미니맵: 지름 220 원 안에 대원을 가운데 두고 지도 그림(low.webp)을 움직인다
  const K = 0.092 * miniZoom
  const R = 110, MX = 1468, MY = 222
  // 지도가 원보다 크면 가장자리에서 멈춰 빈 곳이 안 보이게(그때는 내 표시가 가운데에서 벗어난다)
  const clampT = (v: number, size: number) => (size > R * 2 ? Math.min(0, Math.max(R * 2 - size, v)) : R - size / 2)
  const tx = clampT(R - m.me.x * K, z.W * K), ty = clampT(R - m.me.y * K, z.H * K)
  const lines = m.chat.lines.filter((l) => m.chat.tab === 'world' ? l.tab !== 'whisper' : l.tab === m.chat.tab).slice(-30)
  const expPct = m.exp.need ? (m.exp.cur / m.exp.need) * 100 : 0
  const send = () => { const t = msg.trim(); if (t) a.say(m.chat.tab === 'system' ? 'world' : m.chat.tab, t); setMsg(''); setTyping(false) }

  return (
    <div className="fh" onKeyDown={(e) => e.stopPropagation()}>
      {/* ── 왼쪽 위: 조종 중인 대원 ── */}
      <button type="button" className="fh-face main" style={{ left: 30, top: 14 }} onClick={() => a.go('characterDetail', { id: m.lead.face.match(/face-(\w+)/)?.[1] })} aria-label={`${m.lead.name} 상세`}>
        <img src={m.lead.face} alt="" draggable={false} />
      </button>
      <img className="fh-art" src={img('portrait')} alt="" style={{ left: 8, top: 0, width: 192, height: 160 }} draggable={false} />
      <div className="fh-lv" style={{ left: 210, top: 24 }}><small>Lv.</small>{m.lead.level}<span>{m.lead.name}</span>{m.lead.trial && <em>체험</em>}</div>
      <Bar x={178} y={60} w={312} h={22} v={m.lead.hp / m.lead.hpMax} kind="hp" text={`${n(m.lead.hp)} / ${n(m.lead.hpMax)}`} />
      <Bar x={170} y={86} w={290} h={18} v={1 - m.active.left / m.active.max} kind="act" text={m.active.left > 0 ? `액티브 ${m.active.left.toFixed(1)}초` : '액티브 준비'} />
      <div className="fh-buffs" style={{ left: 200, top: 115 }}>
        {m.buffs.map((b) => (
          <button key={b.id} type="button" className="fh-buff" onClick={() => { setBuffTip(b); setPop('buff') }} aria-label={`${b.name} ${Math.ceil(b.left)}초`}>
            <img src={img(b.icon)} alt="" draggable={false} />
            {b.max > 0 && <i style={{ height: `${(1 - b.left / b.max) * 100}%` }} />}
            {b.max > 0 && <b>{Math.ceil(b.left)}</b>}
          </button>
        ))}
      </div>
      {pop === 'buff' && buffTip && <div className="fh-tip" style={{ left: 200, top: 152 }} onClick={() => setPop(null)}><b>{buffTip.name}</b>{buffTip.desc}{buffTip.max > 0 ? ` · 남은 시간 ${Math.ceil(m.buffs.find((x) => x.id === buffTip.id)?.left ?? 0)}초` : ''}</div>}

      {/* ── 파티(교체할 수 있는 대원) ── */}
      {showParty && m.party.map((p, i) => (
        <div key={p.id} className="fh-party" style={{ top: 168 + i * 77 }}>
          <button type="button" className="fh-face sm" onClick={() => (p.canSwap ? a.swap(p.id) : a.go('characterDetail', { id: p.id }))} aria-label={p.canSwap ? `${p.name}(으)로 교체` : `${p.name} 상세(탐색 교체는 아직 세렌·이안만)`}><img src={p.face} alt="" draggable={false} /></button>
          <i className="fh-dia" aria-hidden />
          <div className="fh-pname"><b>{p.level}</b>{p.name}{p.trial && <em>체험</em>}</div>
          <Bar x={135} y={38} w={150} h={7} v={p.hp / p.hpMax} kind="thin" tip={false} />
          <Bar x={135} y={50} w={185} h={15} v={1} kind="thin-act" text="액티브 준비" />
        </div>
      ))}

      {/* ── 왼쪽 세로 탭: 퀘스트 알림판 보이기 · 사건 파일 · 파티 ── */}
      <img className="fh-art" src={img('side-tab')} alt="" style={{ left: 16, top: 332, width: 48, height: 176 }} draggable={false} />
      <Btn x={18} y={336} w={44} h={52} onClick={a.toggleQuest} aria={m.quest.show ? '메인 사건 알림판 숨기기' : '메인 사건 알림판 보이기'} className={`fh-tab ${m.quest.show ? 'on' : ''}`} />
      <Btn x={18} y={392} w={44} h={52} onClick={() => a.go('caseFile')} aria="사건 파일(1장 진행)" className="fh-tab" />
      <Btn x={18} y={448} w={44} h={56} onClick={() => setShowParty((v) => !v)} aria={showParty ? '파티 창 숨기기' : '파티 창 보이기'} className={`fh-tab ${showParty ? 'on' : ''}`} />

      {/* ── 메인 사건 알림판(자동 이동) ── */}
      {m.quest.show && (
        <div className="fh-quest sf-quest" style={{ left: 64, top: 343 }}>
          <div className="fh-qh"><i aria-hidden>!</i><b>메인 사건</b><small>{m.quest.tag}</small></div>
          <div className="fh-qg"><i aria-hidden>◇</i>{m.quest.goal}</div>
          <div className="fh-qd"><i aria-hidden>◆</i>{m.quest.dist == null ? '' : `${m.quest.dist}m`}</div>
          {!m.quest.done && <button type="button" className={`fh-auto ${m.quest.auto ? 'on' : ''}`} onClick={a.autoQuest} aria-label={m.quest.auto ? '자동 이동 멈추기' : '목표까지 자동 이동'}><i /></button>}
        </div>
      )}

      {/* ── 위: 재화 ── */}
      <div className="fh-cur" style={{ left: 640, top: 16, width: 190 }}><img src={img('coin')} alt="" style={{ left: -16, top: -4, width: 36, height: 36 }} /><span>{n(m.wallet.credit)}</span><button type="button" onClick={() => a.go('shop', { tab: 'currency' })} aria-label="크레딧 충전(상점)">+</button></div>
      <div className="fh-cur" style={{ left: 895, top: 16, width: 155 }}><img src={img('gem')} alt="" style={{ left: -26, top: -10, width: 38, height: 48 }} /><span>{n(m.wallet.diamond)}</span><button type="button" onClick={() => a.go('shop', { tab: 'currency' })} aria-label="다이아 충전(상점)">+</button></div>

      {/* ── 위: 메뉴 아이콘 ── */}
      <Btn k="gift" x={1100} y={2} w={65} h={58} label="이벤트" ly={56} dot={m.badge.event} onClick={() => a.go('events')} />
      <Btn k="scales" x={1185} y={2} w={70} h={58} label="상점" ly={56} onClick={() => a.go('shop')} />
      <Btn k="compass" x={1276} y={2} w={62} h={62} label="소환" ly={56} onClick={() => a.go('recruit')} />
      <Btn k="bag" x={1374} y={6} w={60} h={54} label="가방" ly={52} onClick={() => a.go('bag')} />
      <Btn k="char" x={1468} y={2} w={62} h={58} label="캐릭터" ly={56} onClick={() => a.go('characters')} />
      <Btn k="menu" x={1550} y={8} w={98} h={62} aria="전체 메뉴" dot={m.badge.menu} onClick={() => toggle('menu')} />
      {pop === 'menu' && (
        <div className="fh-pop fh-menu" style={{ right: 26, top: 74 }}>
          {([['미션', 'missions'], ['우편함', 'mail'], ['공지', 'notices'], ['사건 파일', 'caseFile'], ['설정', 'settings']] as const).map(([l, sc]) => <button key={sc} type="button" onClick={() => { setPop(null); a.go(sc) }}>{l}</button>)}
          <button type="button" className="sf-back" onClick={() => { setPop(null); a.back() }}>로비로 나가기</button>
        </div>
      )}

      {/* ── 오른쪽 위: 미니맵 ── */}
      <div className="fh-mini" style={{ left: MX - R, top: MY - R, width: R * 2, height: R * 2 }} aria-label={`미니맵 · ${z.area}`}>
        <div className="fh-mini-in" style={{ transform: `translate(${tx}px, ${ty}px)` }}>
          <img src={`${z.dir}/low.webp`} alt="" style={{ width: z.W * K, height: z.H * K }} draggable={false} />
          {m.view && <i className="cam" style={{ left: (m.view.x - 640 / m.view.z) * K, top: (m.view.y - 360 / m.view.z) * K, width: 1280 / m.view.z * K, height: 720 / m.view.z * K }} />}
          {m.markers.map((mk, i) => <i key={i} className={`mk ${mk.k}`} style={{ left: mk.x * K, top: mk.y * K }} />)}
        </div>
        <i className="fh-me" style={{ left: m.me.x * K + tx, top: m.me.y * K + ty, transform: `translate(-50%, -50%) rotate(${m.me.dir}deg)` }} aria-hidden />
      </div>
      <img className="fh-art" src={img('mini-ring')} alt="" style={{ left: 1340, top: 84, width: 260, height: 266 }} draggable={false} />
      <div className="fh-area" style={{ left: 1384, top: 103 }}>{z.area}</div>
      <button type="button" className="fh-ch" style={{ left: 1540, top: 100 }} onClick={() => toggle('chapter')} aria-label="챕터 선택">{m.chapter}<i aria-hidden /></button>
      {pop === 'chapter' && (
        <div className="fh-pop fh-chap" style={{ left: 1480, top: 136 }}>
          <button type="button" className="on" onClick={() => setPop(null)}>CH. 1 · 끊어진 신호</button>
          <button type="button" disabled>CH. 2 · 잠김</button>
        </div>
      )}
      <Btn x={1534} y={276} w={44} h={44} onClick={() => setMiniZoom((v) => (v === 1 ? 1.8 : 1))} aria={miniZoom === 1 ? '미니맵 확대' : '미니맵 축소'} className="fh-ghost" />
      <Btn x={1446} y={306} w={44} h={42} onClick={a.autoQuest} aria="목표 지점으로 자동 이동" className="fh-ghost" />
      <Btn k="map" x={1598} y={156} w={64} h={64} label="지도" ly={56} onClick={() => toggle('map')} />
      <Btn k="quest" x={1598} y={242} w={64} h={66} label="퀘스트" ly={58} dot={m.badge.quest} onClick={() => toggle('quests')} />

      {/* ── 왼쪽 아래: 탈것·귀환·조이스틱 ── */}
      <Btn k="mount" x={18} y={584} w={70} h={72} onClick={a.mount} aria={m.mounted ? '탈것 내리기' : '탈것 타기(이동 속도 증가)'} className={m.mounted ? 'on' : ''} />
      <Btn k="camp" x={18} y={656} w={70} h={70} onClick={a.camp} aria="귀환(아카데미 정문으로)" />
      <div className="fh-stick sf-stick" style={{ left: 103, top: 611 }} onPointerDown={a.stick.down} onPointerMove={a.stick.move} onPointerUp={a.stick.up} onPointerCancel={a.stick.up} aria-label="이동 조이스틱(키보드: WASD·방향키)">
        <i style={{ transform: `translate(${a.stick.knob.x}px, ${a.stick.knob.y}px)` }} />
      </div>

      {/* ── 채팅 ── */}
      <div className={`fh-chat ${m.chat.small ? 'small' : ''}`} style={{ left: 20, top: m.chat.small ? 843 : 765 }}>
        <div className="fh-ctabs">
          {(Object.keys(TAB) as ChatTab[]).map((t) => <button key={t} type="button" className={m.chat.tab === t ? 'on' : ''} onClick={() => a.chatTab(t)}>{TAB[t]}</button>)}
          <button type="button" className="gear" onClick={a.chatSmall} aria-label={m.chat.small ? '채팅창 펼치기' : '채팅창 접기'}>⚙</button>
        </div>
        {!m.chat.small && (
          <div className="fh-cbody">
            <button type="button" className="fh-cicon" onClick={() => setTyping((v) => !v)} aria-label="채팅 입력" />
            {typing ? (
              <form className="fh-cin" onSubmit={(e) => { e.preventDefault(); send() }}>
                <input autoFocus value={msg} maxLength={60} onChange={(e) => setMsg(e.target.value)} placeholder={`[${TAB[m.chat.tab === 'system' ? 'world' : m.chat.tab]}] 메시지 입력 · 서버 연결 전이라 이 기기에서만 보입니다`} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setTyping(false) }} />
              </form>
            ) : (
              <div className="fh-clines" ref={chatRef}>
                {lines.length === 0 && <p className="empty">{m.chat.tab === 'whisper' ? '받은 귓속말이 없습니다.' : '아직 메시지가 없습니다.'}</p>}
                {lines.map((l, i) => <p key={i} className={l.tab}>[{TAB[l.tab]}] {l.who ? <b>{l.who} : </b> : null}{l.text}</p>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 오른쪽 아래: 동작 버튼 ── */}
      <Btn k="dance" x={1562} y={490} w={100} h={100} label="춤" ly={86} onClick={a.dance} className={m.dancing ? 'on' : ''} />
      <Btn k="awaken" x={1392} y={580} w={108} h={110} label="각성" ly={90} onClick={a.awaken} disabled={m.awaken.gauge < 1} aria={m.awaken.gauge < 1 ? `각성 게이지 ${Math.floor(m.awaken.gauge * 100)}%` : '각성'}>
        <svg className="fh-ring" viewBox="0 0 100 100" aria-hidden><circle cx="50" cy="50" r="44" pathLength="100" strokeDasharray={`${m.awaken.gauge * 100} 100`} /></svg>
      </Btn>
      <Btn k="active" x={1318} y={652} w={98} h={100} label="액티브" ly={92} onClick={a.active} disabled={m.active.left > 0}>
        {m.active.left > 0 && <i className="fh-cd" style={{ '--p': `${(m.active.left / m.active.max) * 100}%` } as React.CSSProperties} />}
        <b className="fh-cdn">{(m.active.left > 0 ? m.active.left : m.active.max).toFixed(1)}</b>
      </Btn>
      <Btn k="attack" x={1450} y={642} w={180} h={178} label="평타" ly={150} onClick={a.attack} />
      <Btn k="dodge" x={1176} y={758} w={106} h={106} label="회피" ly={86} onClick={a.dodge} disabled={m.dodge.left > 0}>
        {m.dodge.left > 0 && <i className="fh-cd" style={{ '--p': `${(m.dodge.left / m.dodge.max) * 100}%` } as React.CSSProperties} />}
      </Btn>
      <Btn k="talk" x={1314} y={758} w={112} h={110} label="대화" ly={88} onClick={a.talk} disabled={!m.canTalk} aria={m.canTalk ? `대화(E) · ${m.talkLabel}` : '대화(E) · 가까운 대상 없음'} className={m.canTalk ? 'ready' : ''} />
      <Btn k="target" x={1576} y={800} w={76} h={76} onClick={a.target} aria={m.targetName ? `대상: ${m.targetName} (다음 대상)` : '가까운 대상 고르기'} className={m.targetName ? 'on' : ''} />
      {m.targetName && <div className="fh-tname" style={{ left: 1500, top: 880 }}>대상 · {m.targetName}</div>}

      {/* ── 맨 아래: 팀장 경험치 · 기기 상태 ── */}
      <div className="fh-exp">
        <i className="fh-pico" aria-hidden />
        <b>Lv.{m.exp.level}</b><span>EXP {expPct.toFixed(2)}%</span>
        <div className="fh-ebar"><i style={{ width: `${expPct}%` }} /></div>
        <span className="num">{n(m.exp.cur)} / {n(m.exp.need)}</span>
        <span className="dev">
          <i className={`sig ${net.online ? '' : 'off'}`} aria-hidden />{net.online ? (net.rtt ? `${net.rtt}ms` : '온라인') : '오프라인'}
          {net.batt != null && <><i className={`bat ${net.charging ? 'chg' : ''}`} style={{ '--b': net.batt } as React.CSSProperties} aria-label={`배터리 ${Math.round(net.batt * 100)}%`} /></>}
          <b>{String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}</b>
        </span>
      </div>

      {/* ── 지도 전체(눌러서 그곳으로 자동 이동) ── */}
      {pop === 'map' && (
        <div className="fh-sheet" onClick={() => setPop(null)}>
          <div className="fh-map" onClick={(e) => e.stopPropagation()}>
            <header><b>{z.area} · {z.place}</b><small>지도를 누르면 그곳까지 자동으로 걸어갑니다</small><button type="button" onClick={() => setPop(null)} aria-label="지도 닫기">✕</button></header>
            {(() => {
              const MW = 1060, MH = 560, k = Math.min(MW / z.W, MH / z.H)
              return (
                <div className="fh-map-in" style={{ width: z.W * k, height: z.H * k }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const sc = r.width / (z.W * k); a.moveTo((e.clientX - r.left) / sc / k, (e.clientY - r.top) / sc / k); setPop(null) }}>
                  <img src={`${z.dir}/low.webp`} alt="" draggable={false} />
                  {m.markers.map((mk, i) => <i key={i} className={`mk ${mk.k}`} style={{ left: mk.x * k, top: mk.y * k }} />)}
                  {(z.portals ?? []).map((p) => <span key={p.id} className="plab" style={{ left: p.x * k, top: p.y * k }}>{p.label}</span>)}
                  <i className="fh-me" style={{ left: m.me.x * k, top: m.me.y * k, transform: `translate(-50%, -50%) rotate(${m.me.dir}deg)` }} />
                </div>
              )
            })()}
          </div>
        </div>
      )}
      {/* ── 퀘스트(1장 사건 목록) ── */}
      {pop === 'quests' && (
        <div className="fh-sheet" onClick={() => setPop(null)}>
          <div className="fh-qlist" onClick={(e) => e.stopPropagation()}>
            <header><b>퀘스트 · 1장 끊어진 신호</b><button type="button" onClick={() => setPop(null)} aria-label="퀘스트 닫기">✕</button></header>
            <ol>
              {a.questList.map((q) => (
                <li key={q.id} className={q.state}>
                  <b>{q.no}</b><span>{q.title}<small>{q.place}</small></span>
                  {q.state === 'next' ? <button type="button" onClick={() => { setPop(null); a.autoQuest() }}>자동 이동</button> : <em>{q.state === 'done' ? '완료' : '잠김'}</em>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
