import { useState } from 'react'
import { useNav } from '../../app/nav'
import { audio } from '../../app/audio'
import { game, useGame, teamPower } from '../../game/store'
import { CHAR_BY_ID } from '../../game/data/characters'
import { GAME_CONFIG } from '../../game/config'
import { TopBar, Btn, RewardChip, fmt, useAction, ErrorBanner, ProvisionalTag, EmptyState } from '../../ui/components'
import { CurrencyGlyph, IconPencil, RoleGlyph, IconCrown } from '../../ui/icons'
import { CONTENT_META, findStage, type ContentId } from './common'

// 공통 출전 준비: 선택한 팀, 적 정보, 필요 자원, 보상. '출전' 버튼은 편성 저장과 분리
export default function Prep({ params }: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const contentId = params.contentId as ContentId
  const stage = findStage(contentId, params.stageId as string)
  const [teamId, setTeamId] = useState(s.activeTeamId)
  const { run, pending, failed, clearFailed } = useAction()
  if (!stage) return <div className="scr"><EmptyState title="스테이지 정보를 찾을 수 없습니다" action={<Btn onClick={() => nav.back()}>돌아가기</Btn>} /></div>
  const team = s.teams.find((t) => t.id === teamId)!
  const members = team.slots.filter(Boolean).length
  const tp = teamPower(s, team)
  const ratio = tp / stage.enemy.power

  const deploy = async () => {
    const res = await run('deploy', (rid) => game.deploy(contentId, stage.id, teamId, rid))
    if (res?.ok) { audio.sfx('slash'); nav.replace('battle', { battleId: res.value.battleId, contentId, stageId: stage.id, teamId }) }
  }

  return (
    <div className="scr ct prep">
      <div className="ct-bg"><img src={CONTENT_META[contentId].bg} alt="" /><div className="ct-shade strong" /></div>
      <TopBar title="출전 준비" sub={`${CONTENT_META[contentId].name} · ${stage.context}`} currencies={['stamina']} />
      <div className="prep-grid">
        <section className="prep-team">
          <div className="prep-team-head">
            <h3>출전 팀</h3>
            <div className="prep-team-tabs">{s.teams.map((t) => <button key={t.id} className={t.id === teamId ? 'on' : ''} onClick={() => { audio.sfx('select'); setTeamId(t.id); game.setActiveTeam(t.id) }}>{t.name}</button>)}</div>
            <Btn size="sm" variant="dark" onClick={() => nav.push('formation', { teamId })}><IconPencil size="1.6rem" />편성 변경</Btn>
          </div>
          <div className="prep-members">
            {team.slots.map((id, i) => {
              if (!id) return <div key={i} className="prep-m empty"><span className="num">{String(i + 1).padStart(2, '0')}</span>빈 슬롯</div>
              const c = CHAR_BY_ID[id]
              return (
                <div key={i} className="prep-m" style={{ ['--a' as string]: c.accent }}>
                  <img src={c.assets.stand} alt="" />
                  {team.leaderId === id && <span className="prep-leader"><IconCrown size="1.4rem" />리더</span>}
                  <div className="prep-m-info"><RoleGlyph role={c.role} size="1.6rem" /><strong>{c.name}</strong><span className="num">Lv.{s.owned[id]?.level}</span></div>
                </div>
              )
            })}
          </div>
          <div className="prep-power">
            <div><small>팀 전투력</small><strong className="num">{fmt(tp)}</strong></div>
            <div><small>권장 전투력</small><strong className="num">{fmt(stage.enemy.power)}</strong></div>
            <span className={`prep-judge ${ratio >= 1 ? 'ok' : ratio >= 0.8 ? 'mid' : 'hard'}`}>{ratio >= 1 ? '여유' : ratio >= 0.8 ? '접전' : '위험'}</span>
          </div>
        </section>
        <section className="prep-enemy">
          <h3>{stage.name}</h3>
          {stage.desc && <p className="sp-desc">{stage.desc}</p>}
          <div className="sp-enemy">
            <div><small>적</small><strong>{stage.enemy.name}</strong></div>
            {stage.enemy.trait && <div><small>특징</small><strong>{stage.enemy.trait}</strong></div>}
          </div>
          <div className="sp-rewards"><small>승리 보상</small><div>{stage.rewards.map((r, i) => <RewardChip key={i} r={r} />)}</div></div>
          <p className="prep-note"><ProvisionalTag>테스트 전투</ProvisionalTag> 전투 방식(실시간·자동·턴제)은 미정입니다. 출전하면 흐름 검증용 간이 전투가 진행됩니다.</p>
          {failed && <ErrorBanner error={failed.error} onRetry={deploy} onClose={clearFailed} />}
          <div className="sp-foot">
            <span className="sp-cost"><CurrencyGlyph id="stamina" size="2.4rem" />{stage.staminaCost} <small>보유 {s.wallet.stamina}</small></span>
            <Btn variant="primary" size="lg" disabled={members < GAME_CONFIG.minMembersToDeploy || !!pending} onClick={deploy}>{members < GAME_CONFIG.minMembersToDeploy ? `최소 ${GAME_CONFIG.minMembersToDeploy}명 필요` : pending ? '준비 중…' : '출전'}</Btn>
          </div>
        </section>
      </div>
    </div>
  )
}
