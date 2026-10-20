import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import '../styles/commander.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import { CHARACTERS, CHAR_BY_ID } from '../game/data/characters'
import { ROLE_LABEL } from '../game/config'
import { commanderOf, iconOptions, TITLES, PROFILE_BGS, SHOWCASE_SIZE, BIO_MAX, AFFILIATION } from '../game/data/profile'
import type { CommanderProfile as CP, GameState } from '../game/types'
import { Modal, Btn } from '../ui/components'
import { RoleGlyph } from '../ui/icons'
import { MotionStage } from '../ui/ui-motion'
import { ProfileIcon } from '../ui/ProfileIcon'

// 팀장 정보(로비 왼쪽 위 프로필 → 16:9 전체 화면). 시안: docs/design/commander-profile-spec.md
// - 배경(책상·클립보드·빈 대원증·소품)은 시안에서 글자·사진·오른쪽 UI를 지운 그림 1장(public/profile/plate.webp, GPT Image 2.5)
// - 글자·사진·카드·버튼은 모두 실제 UI 층. 값은 저장 데이터에서 읽는다(시안의 예시 숫자는 쓰지 않음)
// - 팀장 프로필은 이 기기에만 저장된다(서버 계정·UID·길드 미연동)
type Tab = 'profile' | 'detail' | 'log' | 'achieve' | 'collection'
const TABS: { id: Tab; label: string; ready: boolean }[] = [
  { id: 'profile', label: '프로필', ready: true },
  { id: 'detail', label: '상세 정보', ready: true },
  { id: 'log', label: '작전 기록', ready: true },
  { id: 'achieve', label: '업적', ready: false },
  { id: 'collection', label: '컬렉션', ready: true },
]
const CONTENT_LABEL: Record<string, string> = { story: '스토리', wanted: '현상수배', arena: '아레나', raid: '레이드', training: '훈련', explore: '도시 탐색', case: '사건 파일' }
type Pop = null | 'icon' | 'bio' | 'title' | 'bg' | 'guild' | { slot: number }

/** 바코드 무늬(장식). 계정 정보가 아니라 생성 시각에서 만든 무늬일 뿐이다 */
function barcode(seed: number) {
  const bars: number[] = []; let x = seed % 2147483647 || 7
  for (let i = 0; i < 46; i++) { x = (x * 48271) % 2147483647; bars.push(1 + (x % 4)) }
  return bars
}

export default function CommanderProfile() {
  const s = useGame()
  const nav = useNav()
  const [tab, setTab] = useState<Tab>('profile')
  const [pop, setPop] = useState<Pop>(null)
  const [toast, setToast] = useState<string | null>(null)
  const cm = commanderOf(s)
  const firstTime = !s.commander
  const title = TITLES.find((t) => t.id === cm.titleId)
  const bg = PROFILE_BGS.find((b) => b.id === cm.backgroundId) ?? PROFILE_BGS[0]
  const bars = useMemo(() => barcode(s.createdAt), [s.createdAt])
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(null), 2200); return () => clearTimeout(id) } }, [toast])

  const save = async (patch: Partial<CP>, msg?: string) => {
    const r = await game.updateCommander(patch)
    if (r.ok) { audio.sfx('save'); if (msg) setToast(msg) } else { audio.sfx('error'); setToast(r.error.code === 'INVALID' ? r.error.message : '저장하지 못했습니다') }
    return r.ok
  }
  const back = () => { audio.sfx('tap'); nav.back() }

  return (
    <div className="scr profile cmd">
      <MotionStage canvas={{ width: 1672, height: 941 }} className="ui-cmd">
        <img className="cmd-plate" src="profile/plate.webp" alt="" draggable={false} />
        <i className="cmd-light" aria-hidden />

        {/* 상단 */}
        <button type="button" className="cmd-back" aria-label="뒤로" onClick={back}><svg viewBox="0 0 24 24" width="30" height="30"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <h1 className="cmd-title">팀장 정보</h1>
        <p className="cmd-brand" aria-hidden>ABILITY KINGDOM<br />CITY RESPONSE UNIT</p>

        {/* ── 대원증 ── */}
        <section className="cmd-id" aria-label="대원증">
          <button type="button" className="cmd-photo" aria-label="프로필 아이콘 바꾸기" onClick={() => { audio.sfx('open'); setPop('icon') }}>
            <ProfileIcon id={cm.iconId} className="cmd-photo-img" />
            <span className="cmd-sign" aria-hidden>{s.playerName}</span>
            <em className="cmd-edit-tag">사진 변경</em>
          </button>
          <b className="cmd-unit">CITY RESPONSE UNIT</b>
          <span className="cmd-role">팀장</span>
          <strong className="cmd-name">{s.playerName}</strong>
          <span className="cmd-lv"><small>LV.</small>{s.playerLevel}</span>
          {title && <span className="cmd-ttl">{title.name}</span>}
          <span className="cmd-uid"><small>UID</small><b>미발급</b><em>서버 계정 연결 후 발급</em></span>
          <span className="cmd-aff"><small>소속</small><i className="a7" aria-hidden />{AFFILIATION}</span>
          <span className="cmd-bar" aria-hidden>{bars.map((w, i) => <i key={i} style={{ width: w }} />)}</span>
          <span className="cmd-cap" aria-hidden>CITY RESPONSE UNIT<br />COMMANDER</span>
          <button type="button" className="cmd-bio" onClick={() => { audio.sfx('open'); setPop('bio') }} aria-label={`자기소개 편집: ${cm.bio || '비어 있음'}`}>
            <small>자기소개</small>
            <p className={cm.bio ? '' : 'empty'}>{cm.bio || '자기소개를 적어 주세요.'}</p>
            <PenIcon />
          </button>
          {/* 길드: 기능 출시 전이라 미가입만 보여 준다 */}
          <button type="button" className="cmd-guild" onClick={() => { audio.sfx('open'); setPop('guild') }} aria-label="길드: 미가입">
            <i className="emb" aria-hidden />
            <small>GUILD</small>
            <strong>길드 미가입</strong>
            <span>길드 기능 준비 중</span>
          </button>
          <div className="cmd-strip" aria-hidden>{bg.src && <img src={bg.src} alt="" />}</div>
          <p className="cmd-note" aria-hidden>오늘도 도시의 일상을 지킨다.</p>
        </section>

        {firstTime && (
          <div className="cmd-first" role="group" aria-labelledby="cmd-first-t">
            <b id="cmd-first-t">팀장 기본 아바타를 고르세요</b>
            <p>나중에 언제든 바꿀 수 있습니다. 프로필 아이콘은 보유 대원의 초상화로도 바꿀 수 있습니다.</p>
            <div>{(['m', 'f'] as const).map((a) => (
              <button key={a} type="button" onClick={() => save({ avatar: a, iconId: `cmd-${a}` }, '팀장 아바타를 정했습니다')}><ProfileIcon id={`cmd-${a}`} /><span>{a === 'm' ? '남성형' : '여성형'}</span></button>
            ))}</div>
          </div>
        )}

        {/* ── 오른쪽 ── */}
        <nav className="cmd-tabs" aria-label="팀장 정보 탭" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`${tab === t.id ? 'on' : ''} ${t.ready ? '' : 'soon'}`}
              onClick={() => { if (!t.ready) { audio.sfx('error'); setToast(`${t.label}은(는) 아직 준비 중입니다`); return } audio.sfx('tap'); setTab(t.id) }}>
              {t.label}{!t.ready && <em>준비 중</em>}
            </button>
          ))}
        </nav>

        <div className="cmd-panel" key={tab}>
          {tab === 'profile' && <ProfileTab s={s} cm={cm} title={title?.name} bg={bg} onSlot={(i) => { audio.sfx('open'); setPop({ slot: i }) }} onPop={(p) => { audio.sfx('open'); setPop(p) }} />}
          {tab === 'detail' && <DetailTab s={s} />}
          {tab === 'log' && <LogTab s={s} />}
          {tab === 'collection' && <CollectionTab s={s} onOpen={() => { audio.sfx('tap'); nav.push('characters') }} />}
        </div>

        <p className="cmd-local" aria-hidden>팀장 프로필은 이 기기에만 저장됩니다 · 서버 계정 미연동</p>
        <p className="cmd-motto" aria-hidden>FOR A MORE<br />SECURE TOMORROW.</p>
        {toast && <div className="cmd-toast" role="status" key={toast}>{toast}</div>}
      </MotionStage>

      {pop === 'icon' && <IconPicker s={s} cm={cm} onClose={() => setPop(null)} onSave={save} />}
      {pop === 'bio' && <BioEditor cm={cm} onClose={() => setPop(null)} onSave={save} />}
      {pop === 'title' && <ListPicker title="대표 칭호" note="칭호 획득 경로가 정해지면 목록이 늘어납니다." items={[{ id: null, name: '칭호 없음', note: '' }, ...TITLES]} cur={cm.titleId} onClose={() => setPop(null)} onPick={(id) => save({ titleId: id }, '대표 칭호를 바꿨습니다')} />}
      {pop === 'bg' && <ListPicker title="프로필 배경" note="대원증 아래 띠에 보이는 개인 전시 배경입니다. 지휘실 배경은 바뀌지 않습니다." items={PROFILE_BGS} cur={cm.backgroundId} preview onClose={() => setPop(null)} onPick={(id) => save({ backgroundId: id ?? 'none' }, '프로필 배경을 바꿨습니다')} />}
      {pop === 'guild' && (
        <Modal className="cmd-modal" onClose={() => setPop(null)} labelledBy="cmd-guild-t">
          <h2 id="cmd-guild-t">길드</h2>
          <p className="cmd-mnote">길드 기능은 아직 열리지 않았습니다. 길드가 생기면 엠블럼·길드명·길드 직책이 대원증에 표시되고, 여기서 길드를 찾을 수 있습니다.</p>
          <div className="confirm-actions"><Btn variant="dark" onClick={() => setPop(null)}>닫기</Btn></div>
        </Modal>
      )}
      {pop && typeof pop === 'object' && <SlotPicker s={s} cm={cm} slot={pop.slot} onClose={() => setPop(null)} onSave={save} />}
    </div>
  )
}

const PenIcon = () => <svg className="pen" viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>

function Head({ ko, en, right }: { ko: string; en: string; right?: string }) {
  return <h3 className="cmd-h"><i aria-hidden />{ko}<small>{en}</small>{right && <em>{right}</em>}</h3>
}

function ProfileTab({ s, cm, title, bg, onSlot, onPop }: { s: GameState; cm: CP; title?: string; bg: (typeof PROFILE_BGS)[number]; onSlot: (i: number) => void; onPop: (p: Pop) => void }) {
  const filled = cm.showcase.filter(Boolean).length
  const raid = Object.values(s.content.raidBest).reduce((a, b) => a + b, 0)
  return (
    <>
      <Head ko="대표 팀원" en="TEAM MEMBER" right={`${filled} / ${SHOWCASE_SIZE}`} />
      <div className="cmd-cards">
        {Array.from({ length: SHOWCASE_SIZE }, (_, i) => {
          const id = cm.showcase[i]; const c = id ? CHAR_BY_ID[id] : null; const o = id ? s.owned[id] : null
          return c && o ? (
            <button key={i} type="button" className="cmd-card" style={{ '--i': i, '--ac': c.accent } as CSSProperties} onClick={() => onSlot(i)} aria-label={`대표 팀원 ${i + 1}: ${c.name} Lv.${o.level}, 바꾸기`}>
              <img src={c.assets.portrait} alt="" draggable={false} />
              <span className="lv"><small>LV.</small>{o.level}</span>
              <b>{c.name}</b>
              <i className="role" title={ROLE_LABEL[c.role]}><RoleGlyph role={c.role} size="2.4rem" /></i>
            </button>
          ) : (
            <button key={i} type="button" className="cmd-card empty" style={{ '--i': i } as CSSProperties} onClick={() => onSlot(i)} aria-label={`대표 팀원 ${i + 1}: 비어 있음, 고르기`}>
              <span>+</span><em>대원 선택</em>
            </button>
          )
        })}
      </div>

      <Head ko="대표 설정" en="CUSTOMIZE" />
      <div className="cmd-sets">
        <button type="button" className="cmd-set" onClick={() => onPop('title')} aria-label={`대표 칭호: ${title ?? '없음'}, 바꾸기`}>
          <b>대표 칭호</b><small>TITLE</small>
          <span className={`ttl ${title ? '' : 'none'}`}>{title ?? '칭호 없음'}</span><PenIcon />
        </button>
        <button type="button" className="cmd-set" onClick={() => onPop('bg')} aria-label={`프로필 배경: ${bg.name}, 바꾸기`}>
          <b>프로필 배경</b><small>BACKGROUND</small>
          <span className="bgp">{bg.src ? <img src={bg.src} alt="" /> : <i className="stars" />}</span>
          <em>{bg.name}</em><PenIcon />
        </button>
        <button type="button" className="cmd-set off" onClick={() => onPop('guild')} aria-label="길드 엠블럼: 길드 미가입">
          <b>길드 엠블럼</b><small>GUILD EMBLEM</small>
          <i className="emb" aria-hidden /><em>길드 미가입</em>
        </button>
      </div>

      <Head ko="활동 요약" en="ACTIVITY SUMMARY" />
      <div className="cmd-acts">
        <Act icon="op" label="완료한 작전" v={s.content.wins} unit="회" note="승리한 전투 수" />
        <Act icon="map" label="도시 탐색" v={null} unit="%" note="탐색률 집계 없음" />
        <Act icon="raid" label="레이드 참여" v={raid} unit="회" note="레이드 격파 기록" />
        <Act icon="aim" label="현상수배 처리" v={s.content.wantedCleared.length} unit="회" note="처리한 현상수배" />
      </div>
    </>
  )
}

function Act({ icon, label, v, unit, note }: { icon: string; label: string; v: number | null; unit: string; note: string }) {
  const P: Record<string, string> = {
    op: 'M5 19 19 5M8 5l11 11M5 9l4-4M15 19l4-4', map: 'M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4 21h16',
    raid: 'M12 3 3 20h18zM12 9l-4 8h8z', aim: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  }
  return (
    <div className={`cmd-act ${v == null ? 'na' : ''}`} title={note}>
      <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden><path d={P[icon]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span><small>{label}</small><b className="num-tab">{v == null ? '—' : v}<em>{v == null ? '' : unit}</em></b><i>{note}</i></span>
    </div>
  )
}

function DetailTab({ s }: { s: GameState }) {
  const owned = Object.keys(s.owned).filter((id) => CHAR_BY_ID[id]).length
  const total = CHARACTERS.filter((c) => !c.pending).length
  const caseDone = Object.keys(s.content.caseFile?.stars ?? {}).length
  const rows: [string, string][] = [
    ['팀장 레벨', `LV. ${s.playerLevel}`],
    ['보유 대원', `${owned} / ${total}`],
    ['승리한 전투', `${s.content.wins}회`],
    ['사건 파일 진행', `${caseDone}개 장면`],
    ['스토리 클리어', `${s.content.storyCleared.length}개 스테이지`],
    ['현상수배 처리', `${s.content.wantedCleared.length}건`],
    ['레이드 격파', `${Object.values(s.content.raidBest).reduce((a, b) => a + b, 0)}회`],
    ['아레나 전적', `${s.content.arenaRecord.win}승 ${s.content.arenaRecord.lose}패 · ${s.content.arenaPoints}점`],
    ['영입 횟수', `${s.recruitTx.reduce((n, t) => n + t.count, 0)}회`],
    ['출석', `${s.attendance.claimedDays}일`],
    ['기록 시작', new Date(s.createdAt).toLocaleDateString('ko-KR')],
  ]
  return (
    <>
      <Head ko="상세 정보" en="DETAIL" />
      <dl className="cmd-dl">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num-tab">{v}</dd></div>)}</dl>
      <p className="cmd-foot">이 기기의 저장 데이터에서 읽은 값입니다. 도시 탐색률·누적 플레이 시간은 아직 집계하지 않습니다.</p>
    </>
  )
}

function LogTab({ s }: { s: GameState }) {
  const list = s.content.battles
  return (
    <>
      <Head ko="작전 기록" en="OPERATION LOG" right={`최근 ${list.length}건`} />
      {list.length ? (
        <ol className="cmd-log">
          {list.map((b) => (
            <li key={b.requestId} className={b.won ? 'won' : 'lost'}>
              <b>{b.won ? '성공' : '실패'}</b>
              <span>{CONTENT_LABEL[b.contentId] ?? b.contentId} · {b.stageId}</span>
              <time className="num-tab">{new Date(b.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
            </li>
          ))}
        </ol>
      ) : <p className="cmd-empty">아직 기록된 작전이 없습니다. 전투를 마치면 최근 30건까지 여기에 남습니다.</p>}
    </>
  )
}

function CollectionTab({ s, onOpen }: { s: GameState; onOpen: () => void }) {
  const list = CHARACTERS.filter((c) => !c.pending)
  const owned = list.filter((c) => s.owned[c.id]).length
  return (
    <>
      <Head ko="컬렉션" en="COLLECTION" right={`${owned} / ${list.length}`} />
      <div className="cmd-col">
        {list.map((c) => <span key={c.id} className={s.owned[c.id] ? '' : 'lock'} title={c.name}><img src={c.assets.portrait} alt="" /><b>{c.name}</b></span>)}
      </div>
      <div className="cmd-col-foot"><Btn variant="dark" onClick={onOpen}>캐릭터 화면으로</Btn><p>코스튬·로비 장면·아이콘 같은 다른 수집품 목록은 아직 없습니다.</p></div>
    </>
  )
}

function IconPicker({ s, cm, onClose, onSave }: { s: GameState; cm: CP; onClose: () => void; onSave: (p: Partial<CP>, m?: string) => Promise<boolean> }) {
  const opts = iconOptions(s)
  return (
    <Modal className="cmd-modal cmd-icons" onClose={onClose} labelledBy="cmd-icon-t">
      <h2 id="cmd-icon-t">프로필 아이콘</h2>
      <p className="cmd-mnote">고른 아이콘이 대원증 사진과 로비 왼쪽 위 원형 사진에 함께 쓰입니다. 대표 팀원·전투 편성은 바뀌지 않습니다.</p>
      <div className="cmd-avt">
        <span>팀장 기본 아바타</span>
        {(['m', 'f'] as const).map((a) => (
          <button key={a} type="button" className={cm.avatar === a ? 'on' : ''} onClick={() => onSave({ avatar: a }, `기본 아바타: ${a === 'm' ? '남성형' : '여성형'}`)}>{a === 'm' ? '남성형' : '여성형'}</button>
        ))}
      </div>
      <div className="cmd-icon-grid">
        {opts.map((o) => (
          <button key={o.id} type="button" disabled={o.locked} className={`${cm.iconId === o.id ? 'on' : ''} ${o.locked ? 'lock' : ''}`}
            onClick={async () => { if (await onSave({ iconId: o.id }, '프로필 아이콘을 바꿨습니다')) onClose() }} aria-label={`${o.label}${o.locked ? ` (잠김: ${o.lockNote})` : ''}`}>
            <ProfileIcon id={o.id} />
            <b>{o.label}</b>
            {o.locked && <em>{o.lockNote}</em>}
          </button>
        ))}
      </div>
    </Modal>
  )
}

function SlotPicker({ s, cm, slot, onClose, onSave }: { s: GameState; cm: CP; slot: number; onClose: () => void; onSave: (p: Partial<CP>, m?: string) => Promise<boolean> }) {
  const owned = CHARACTERS.filter((c) => s.owned[c.id])
  const pick = async (id: string | null) => {
    const sc = [...cm.showcase]; const at = id ? sc.indexOf(id) : -1
    if (at >= 0 && at !== slot) sc[at] = sc[slot] // 이미 다른 칸에 있으면 자리를 바꾼다
    sc[slot] = id
    if (await onSave({ showcase: sc }, id ? `${slot + 1}번 칸: ${CHAR_BY_ID[id].name}` : `${slot + 1}번 칸을 비웠습니다`)) onClose()
  }
  return (
    <Modal className="cmd-modal" onClose={onClose} labelledBy="cmd-slot-t">
      <h2 id="cmd-slot-t">대표 팀원 · {slot + 1}번 칸</h2>
      <p className="cmd-mnote">프로필에 전시할 대원입니다. 전투 편성과는 따로 저장되어, 바꿔도 편성은 그대로입니다.</p>
      <div className="cmd-icon-grid tall">
        {owned.map((c) => {
          const at = cm.showcase.indexOf(c.id)
          return (
            <button key={c.id} type="button" className={at === slot ? 'on' : ''} onClick={() => pick(c.id)} aria-label={`${c.name} Lv.${s.owned[c.id].level}${at >= 0 && at !== slot ? `, ${at + 1}번 칸과 자리 바꾸기` : ''}`}>
              <img src={c.assets.portrait} alt="" />
              <b>{c.name} · Lv.{s.owned[c.id].level}</b>
              {at >= 0 && at !== slot && <em>{at + 1}번 칸에 있음</em>}
            </button>
          )
        })}
      </div>
      <div className="confirm-actions">
        {cm.showcase[slot] && <Btn variant="ghost" onClick={() => pick(null)}>칸 비우기</Btn>}
        <Btn variant="dark" onClick={onClose}>닫기</Btn>
      </div>
    </Modal>
  )
}

function BioEditor({ cm, onClose, onSave }: { cm: CP; onClose: () => void; onSave: (p: Partial<CP>, m?: string) => Promise<boolean> }) {
  const [v, setV] = useState(cm.bio)
  return (
    <Modal className="cmd-modal" onClose={onClose} labelledBy="cmd-bio-t">
      <h2 id="cmd-bio-t">자기소개</h2>
      <textarea className="cmd-ta" value={v} maxLength={BIO_MAX} rows={3} onChange={(e) => setV(e.target.value)} placeholder="예: 함께 더 멀리, 도시의 일상을 지키기 위해." autoFocus />
      <p className="cmd-mnote num-tab">{v.length} / {BIO_MAX}자 · 이 기기에만 저장</p>
      <div className="confirm-actions">
        <Btn variant="ghost" onClick={onClose}>취소</Btn>
        <Btn variant="primary" onClick={async () => { if (await onSave({ bio: v }, '자기소개를 저장했습니다')) onClose() }}>저장</Btn>
      </div>
    </Modal>
  )
}

function ListPicker({ title, note, items, cur, preview, onClose, onPick }: { title: string; note: string; items: { id: string | null; name: string; note: string; src?: string }[]; cur: string | null; preview?: boolean; onClose: () => void; onPick: (id: string | null) => Promise<boolean> }) {
  return (
    <Modal className="cmd-modal" onClose={onClose} labelledBy="cmd-list-t">
      <h2 id="cmd-list-t">{title}</h2>
      <p className="cmd-mnote">{note}</p>
      <div className={`cmd-list ${preview ? 'pv' : ''}`}>
        {items.map((it) => (
          <button key={String(it.id)} type="button" className={cur === it.id ? 'on' : ''} onClick={async () => { if (await onPick(it.id)) onClose() }}>
            {preview && <span className="bgp">{it.src ? <img src={it.src} alt="" /> : <i className="stars" />}</span>}
            <b>{it.name}</b>{it.note && <em>{it.note}</em>}
          </button>
        ))}
      </div>
      <div className="confirm-actions"><Btn variant="dark" onClick={onClose}>닫기</Btn></div>
    </Modal>
  )
}
