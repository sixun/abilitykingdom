import { useNav } from '../../app/nav'
import { game, useGame, teamPower } from '../../game/store'
import { ARENA_OPPONENTS } from '../../game/data/catalog'
import { CHAR_BY_ID } from '../../game/data/characters'
import { TopBar, Btn, ProvisionalTag, fmt } from '../../ui/components'
import { audio } from '../../app/audio'

// 아레나: 등급·상대·방어 편성·전적. 실시간/비동기·매칭·시즌 미정 → 고정 샘플 상대 3명
export default function Arena(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const pts = s.content.arenaPoints
  const tier = pts >= 1600 ? '골드' : pts >= 1200 ? '실버' : '브론즈'
  const def = s.teams.find((t) => t.id === s.content.arenaDefenseTeam)!
  return (
    <div className="scr ct ct-arena">
      <div className="ct-bg"><img src="assets/bg/arena.webp" alt="" /><div className="ct-shade" /></div>
      <TopBar title="아레나" sub="ROOFTOP ARENA" currencies={['stamina', 'exchangeMedal']} />
      <aside className="arena-me">
        <small>현재 등급</small>
        <strong className="arena-tier">{tier}</strong>
        <span className="num arena-pts">{fmt(pts)} 점</span>
        <span className="num">전적 {s.content.arenaRecord.win}승 {s.content.arenaRecord.lose}패</span>
        <div className="arena-def">
          <small>방어 편성</small>
          <div className="arena-def-teams">
            {s.teams.map((t) => <button key={t.id} className={t.id === def.id ? 'on' : ''} onClick={() => { audio.sfx('select'); game.setArenaDefense(t.id) }}>{t.name}</button>)}
          </div>
          <div className="arena-faces">{def.slots.map((id, i) => id ? <img key={i} src={CHAR_BY_ID[id].assets.portrait} alt={CHAR_BY_ID[id].name} /> : <span key={i} className="empty" />)}</div>
          <span className="num">전투력 {fmt(teamPower(s, def))}</span>
        </div>
        <ProvisionalTag>실시간/비동기·매칭·시즌 미정</ProvisionalTag>
      </aside>
      <div className="arena-opps">
        {ARENA_OPPONENTS.map((o, i) => (
          <div key={o.id} className="opp" style={{ animationDelay: `${i * 90}ms` }}>
            <div className="opp-info"><strong>{o.name}</strong><span className="num">Lv.{o.level} · 전투력 {fmt(o.power)}</span></div>
            <div className="arena-faces">{o.team.map((id) => <img key={id} src={CHAR_BY_ID[id].assets.portrait} alt={CHAR_BY_ID[id].name} />)}</div>
            <Btn variant="primary" onClick={() => nav.push('prep', { contentId: 'arena', stageId: o.id })}>도전</Btn>
          </div>
        ))}
      </div>
    </div>
  )
}
