import { useEffect, useState } from 'react'
import '../styles/screens.css'
import { useNav, type ScreenName } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame, teamPower } from '../game/store'
import { MISSIONS, NOTICES, EVENTS, ATTENDANCE_REWARDS } from '../game/data/catalog'
import { CHAR_BY_ID, CHARACTERS } from '../game/data/characters'
import { TopBar, Btn, RewardChip, EmptyState, useAction, ErrorBanner, rewardLabel, fmt, Dot } from '../ui/components'
import { IconCheck } from '../ui/icons'

const rewardToast = (rs: { id: string; qty: number; kind: 'currency' | 'item' }[]) => rs.map((r) => `${rewardLabel(r)} +${fmt(r.qty)}`).join(', ')

// ───────── 우편함 ─────────
export function Mail(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const [sel, setSel] = useState<string | null>(s.mails[0]?.id ?? null)
  const { run, pending, failed, clearFailed } = useAction()
  const m = s.mails.find((x) => x.id === sel)
  const unclaimed = s.mails.filter((x) => !x.claimed)

  const claim = async (ids: string[], key: string) => {
    const res = await run(key, (rid) => game.claimMail(ids, rid))
    if (res?.ok) { audio.sfx('coin'); nav.toast(`받음: ${rewardToast(res.value.rewards)}`, 'ok') }
  }
  return (
    <div className="scr ops">
      <TopBar title="우편함" sub="MAILBOX" />
      <div className="ops-split">
        <div className="ops-list scroll-y">
          {s.mails.length === 0 && <EmptyState title="받은 우편이 없습니다" />}
          {s.mails.map((x) => (
            <button key={x.id} className={`ops-row ${x.id === sel ? 'on' : ''} ${x.claimed ? 'done' : ''}`} onClick={() => { audio.sfx('tap'); setSel(x.id) }}>
              <span className="ops-row-title">{x.title}{!x.claimed && <Dot show />}</span>
              <span className="ops-row-sub">{x.from} · ~{x.expiresAt}</span>
            </button>
          ))}
        </div>
        <div className="ops-detail">
          {m ? (
            <>
              <h2>{m.title}</h2>
              <p className="ops-meta">{m.from} · 받은 날 {new Date(m.receivedAt).toLocaleDateString('ko-KR')} · 만료 {m.expiresAt}</p>
              <p className="ops-body">{m.body}</p>
              <div className="ops-rewards">{m.rewards.map((r, i) => <RewardChip key={i} r={r} />)}</div>
              {failed && <ErrorBanner error={failed.error} onRetry={() => claim([m.id], failed.key)} onClose={clearFailed} />}
              <div className="ops-actions">
                <Btn variant="primary" disabled={m.claimed || !!pending} onClick={() => claim([m.id], `mail:${m.id}`)}>{m.claimed ? <><IconCheck size="1.8rem" />수령 완료</> : '받기'}</Btn>
                <Btn variant="dark" disabled={unclaimed.length === 0 || !!pending} onClick={() => claim(unclaimed.map((x) => x.id), 'mail:all')}>모두 받기 ({unclaimed.length})</Btn>
              </div>
            </>
          ) : <EmptyState title="우편을 선택하세요" />}
        </div>
      </div>
    </div>
  )
}

// ───────── 미션 ─────────
export function Missions(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const { run, pending, failed, clearFailed } = useAction()
  const claim = async (id: string) => {
    const res = await run(`m:${id}`, (rid) => game.claimMission(id, rid))
    if (res?.ok) { audio.sfx('coin'); nav.toast(`받음: ${rewardToast(res.value.rewards)}`, 'ok') }
  }
  return (
    <div className="scr ops">
      <TopBar title="미션" sub="DAILY MISSIONS" currencies={['diamond']} />
      <div className="ops-wide scroll-y">
        <p className="ops-meta">일일 미션 · 오늘 {s.missions.day} · 초기화 기준 시각은 미정(기기 날짜 기준)</p>
        {failed && <ErrorBanner error={failed.error} onClose={clearFailed} />}
        {MISSIONS.map((m) => {
          const st = game.missionStatus(m.id)
          return (
            <div key={m.id} className={`mission ${st.claimed ? 'done' : st.done ? 'ready' : ''}`}>
              <div className="mission-main">
                <strong>{m.title}</strong>
                <div className="mission-bar"><i style={{ width: `${(st.progress / m.target) * 100}%` }} /></div>
                <span className="num">{st.progress} / {m.target}</span>
              </div>
              <div className="mission-rewards">{m.rewards.map((r, i) => <RewardChip key={i} r={r} compact />)}</div>
              <Btn variant={st.done && !st.claimed ? 'primary' : 'dark'} disabled={!st.done || st.claimed || !!pending} onClick={() => claim(m.id)}>{st.claimed ? '완료' : st.done ? '받기' : '진행 중'}</Btn>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ───────── 공지 ─────────
export function Notices(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const [sel, setSel] = useState(NOTICES[0].id)
  const n = NOTICES.find((x) => x.id === sel)!
  useEffect(() => { game.markSeen('notice', sel) }, [sel])
  return (
    <div className="scr ops">
      <TopBar title="공지" sub="NOTICE" />
      <div className="ops-split">
        <div className="ops-list scroll-y">
          {NOTICES.map((x) => (
            <button key={x.id} className={`ops-row ${x.id === sel ? 'on' : ''}`} onClick={() => { audio.sfx('tap'); setSel(x.id) }}>
              <span className="ops-row-title"><em className="ops-tag">{x.tag}</em>{x.title}{!s.seenNotices.includes(x.id) && <Dot show />}</span>
              <span className="ops-row-sub">{x.date}</span>
            </button>
          ))}
        </div>
        <div className="ops-detail">
          <h2>{n.title}</h2>
          <p className="ops-meta">{n.tag} · {n.date}</p>
          <p className="ops-body">{n.body}</p>
        </div>
      </div>
    </div>
  )
}

// ───────── 이벤트 ─────────
export function Events({ params }: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const [sel, setSel] = useState<string>((params.focus as string) ?? EVENTS[0].id)
  const e = EVENTS.find((x) => x.id === sel)!
  useEffect(() => { game.markSeen('event', sel) }, [sel])
  return (
    <div className="scr ops">
      <TopBar title="이벤트" sub="EVENTS" />
      <div className="ops-split">
        <div className="ops-list scroll-y">
          {EVENTS.map((x) => (
            <button key={x.id} className={`ev-row ${x.id === sel ? 'on' : ''}`} style={{ ['--a' as string]: x.accent }} onClick={() => { audio.sfx('tap'); setSel(x.id) }}>
              <img src={x.image} alt="" />
              <span><strong>{x.title}</strong><small>{x.period}</small></span>
              <Dot show={!s.seenEvents.includes(x.id)} />
            </button>
          ))}
        </div>
        <div className="ops-detail ev-detail" style={{ ['--a' as string]: e.accent }} key={e.id}>
          <img className="ev-art" src={e.image} alt="" />
          <h2>{e.title}</h2>
          <p className="ops-meta">{e.period}</p>
          <p className="ops-body">{e.desc}</p>
          <div className="ops-actions"><Btn variant="primary" onClick={() => nav.push(e.link.screen as ScreenName, e.link.params)}>바로 가기</Btn></div>
        </div>
      </div>
    </div>
  )
}

// ───────── 출석 ─────────
export function Attendance(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const { run, pending, failed, clearFailed } = useAction()
  const can = game.canClaimAttendance()
  const claim = async () => {
    const res = await run('att', (rid) => game.claimAttendance(rid))
    if (res?.ok) { audio.sfx('coin'); nav.toast(`${res.value.day}일차 출석: ${rewardToast(res.value.rewards)}`, 'ok') }
  }
  return (
    <div className="scr ops att">
      <TopBar title="출석 체크" sub="ATTENDANCE" />
      <div className="att-grid">
        {ATTENDANCE_REWARDS.map((r, i) => {
          const claimed = i < s.attendance.claimedDays
          const today = i === s.attendance.claimedDays && can
          return (
            <div key={i} className={`att-day ${claimed ? 'claimed' : ''} ${today ? 'today' : ''}`} style={{ animationDelay: `${i * 50}ms` }}>
              <small>{i + 1}일차</small>
              <RewardChip r={r} />
              {claimed && <span className="att-stamp"><IconCheck size="3rem" /></span>}
            </div>
          )
        })}
      </div>
      {failed && <div className="att-err"><ErrorBanner error={failed.error} onRetry={claim} onClose={clearFailed} /></div>}
      <div className="att-actions"><Btn variant="primary" size="lg" disabled={!can || !!pending} onClick={claim}>{can ? '오늘 출석 보상 받기' : s.attendance.claimedDays >= ATTENDANCE_REWARDS.length ? '모든 보상을 받았습니다' : '오늘은 이미 받았습니다'}</Btn></div>
    </div>
  )
}

// ───────── 프로필 ─────────
export function Profile(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const lobby = CHAR_BY_ID[s.lobby.characterId]
  const t = s.teams.find((x) => x.id === s.activeTeamId)!
  return (
    <div className="scr ops profile">
      <img className="profile-art" src={lobby.assets.stand} alt="" />
      <TopBar title="프로필" sub="PROFILE" />
      <div className="profile-card">
        <h2>{s.playerName}</h2>
        <p className="num">Lv.{s.playerLevel} · ID {String(s.createdAt).slice(-8)}</p>
        <dl className="cd-dl">
          <dt>로비 대표</dt><dd>{lobby.name}</dd>
          <dt>기본 출전 팀</dt><dd>{t.name} · 리더 {t.leaderId ? CHAR_BY_ID[t.leaderId].name : '없음'} · 전투력 {fmt(teamPower(s, t))}</dd>
          <dt>보유 캐릭터</dt><dd>{Object.keys(s.owned).length} / {CHARACTERS.length}</dd>
          <dt>전투 승리</dt><dd className="num">{s.content.wins}회</dd>
          <dt>영입</dt><dd className="num">{s.recruitTx.reduce((a, x) => a + x.count, 0)}회</dd>
        </dl>
        <p className="ops-meta">로비 대표 캐릭터와 팀 리더는 따로 저장됩니다. 계정 연동은 계정 시스템 결정 후 연결합니다.</p>
        <div className="ops-actions"><Btn variant="dark" onClick={() => nav.push('characters')}>캐릭터 목록</Btn></div>
      </div>
    </div>
  )
}
