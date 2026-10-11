import { useEffect, useRef, useState } from 'react'
import { useNav } from '../../app/nav'
import { audio } from '../../app/audio'
import { game, useGame, charPower } from '../../game/store'
import { CHAR_BY_ID } from '../../game/data/characters'
import type { Reward } from '../../game/types'
import { Btn, ConfirmDialog, RewardChip, fmt } from '../../ui/components'
import { IconPause, RoleGlyph } from '../../ui/icons'
import { CONTENT_META, findStage, type ContentId } from './common'

// 테스트 전투: 흐름(체력·스킬·목표·일시정지 → 결과·보상·재도전·로비 복귀) 검증용.
// 실제 전투 규칙이 아니며, 전투 방식 확정 후 별도로 구현한다.
const TICK = 400

export default function Battle({ params }: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const contentId = params.contentId as ContentId
  const stage = findStage(contentId, params.stageId as string)!
  const team = s.teams.find((t) => t.id === params.teamId)!
  const members = team.slots.filter(Boolean) as string[]
  const tp = members.reduce((a, id) => a + charPower(s, id), 0)
  const ep = stage.enemy.power

  const maxTeam = Math.max(1, tp)
  const maxEnemy = ep * 1.2
  const [hp, setHp] = useState({ team: maxTeam, enemy: maxEnemy, shield: 0 })
  const [cd, setCd] = useState<Record<string, number>>({})
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [fx, setFx] = useState<{ id: number; kind: string; text: string } | null>(null)
  const [result, setResult] = useState<null | { won: boolean; rewards: Reward[] }>(null)
  const ended = useRef(false)

  useEffect(() => { audio.bgm('battle'); return () => audio.bgm('menu') }, [])

  const finish = async (won: boolean) => {
    if (ended.current) return
    ended.current = true
    const res = await game.finishBattle(params.battleId as string, won)
    // 응답 유실 시 재요청해도 서버 기록(battleId)이 같아 보상은 한 번만 지급된다
    const final = res.ok ? res : await game.finishBattle(params.battleId as string, won)
    audio.sfx(won ? 'save' : 'error')
    setResult({ won, rewards: final.ok ? final.value.rewards ?? [] : [] })
  }

  useEffect(() => {
    if (paused || result) return
    const t = setInterval(() => {
      setHp((h) => {
        if (h.enemy <= 0 || h.team <= 0) return h
        const dealt = tp * 0.05 * (0.85 + Math.random() * 0.3)
        let taken = ep * 0.04 * (0.85 + Math.random() * 0.3)
        let shield = h.shield
        if (shield > 0) { const ab = Math.min(shield, taken); shield -= ab; taken -= ab }
        return { team: Math.max(0, h.team - taken), enemy: Math.max(0, h.enemy - dealt), shield }
      })
      setCd((c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.max(0, v - TICK * speed)])))
    }, TICK / speed)
    return () => clearInterval(t)
  }, [paused, result, speed, tp, ep])

  // 승패 판정: 틱이든 스킬이든 체력이 0이 되면 한 번만 종료
  useEffect(() => {
    if (hp.enemy <= 0) { const t = setTimeout(() => finish(true), 300); return () => clearTimeout(t) }
    if (hp.team <= 0) { const t = setTimeout(() => finish(false), 300); return () => clearTimeout(t) }
  }, [hp.enemy, hp.team])

  const skill = (id: string) => {
    if ((cd[id] ?? 0) > 0 || paused || result) return
    const c = CHAR_BY_ID[id]
    const p = charPower(s, id)
    setCd((x) => ({ ...x, [id]: 6000 }))
    if (c.role === 'support') { audio.sfx('coin'); setHp((h) => ({ ...h, team: Math.min(maxTeam, h.team + p * 0.5) })); setFx({ id: Date.now(), kind: 'heal', text: `${c.skills[1]?.name ?? '회복'}` }) }
    else if (c.role === 'defense') { audio.sfx('select'); setHp((h) => ({ ...h, shield: h.shield + p * 0.5 })); setFx({ id: Date.now(), kind: 'shield', text: `${c.skills[1]?.name ?? '방어'}` }) }
    else { audio.sfx('slash'); setHp((h) => ({ ...h, enemy: Math.max(0, h.enemy - p * 0.9) })); setFx({ id: Date.now(), kind: 'hit', text: `${c.skills[1]?.name ?? '스킬'}` }) }
  }

  const retry = () => nav.replace('prep', { contentId, stageId: stage.id })

  return (
    <div className="scr battle">
      <div className="ct-bg"><img src={CONTENT_META[contentId].bg} alt="" /><div className="ct-shade" /></div>
      <div className="bt-top">
        <span className="bt-test">테스트 전투 · 전투 규칙 미정</span>
        <span className="bt-goal">목표: {stage.enemy.name} 격파</span>
        <div className="bt-ctrl">
          <button onClick={() => { audio.sfx('tap'); setSpeed((v) => (v === 1 ? 2 : 1)) }} aria-label="배속">×{speed}</button>
          <button onClick={() => { audio.sfx('tap'); setPaused(true) }} aria-label="일시정지"><IconPause size="2.2rem" /></button>
        </div>
      </div>

      <div className={`bt-enemy ${fx?.kind === 'hit' ? 'hit' : ''}`} key={fx?.kind === 'hit' ? `e${fx.id}` : 'enemy'}>
        <div className="bt-boss" />
        <strong>{stage.enemy.name}</strong>
        <div className="bt-bar enemy"><i style={{ width: `${(hp.enemy / maxEnemy) * 100}%` }} /></div>
        <span className="num">{fmt(Math.ceil(hp.enemy))} / {fmt(Math.ceil(maxEnemy))}</span>
      </div>

      <div className="bt-team">
        {members.map((id) => <img key={id} src={CHAR_BY_ID[id].assets.stand} alt="" className="bt-fig" />)}
      </div>

      {fx && !result && <div className={`bt-fx ${fx.kind}`} key={`fx${fx.id}`}>{fx.text}</div>}

      <div className="bt-bottom">
        <div className="bt-hp">
          <small>팀 체력{hp.shield > 0 ? ` · 보호막 ${fmt(Math.ceil(hp.shield))}` : ''}</small>
          <div className="bt-bar team"><i style={{ width: `${(hp.team / maxTeam) * 100}%` }} /></div>
          <span className="num">{fmt(Math.ceil(hp.team))} / {fmt(maxTeam)}</span>
        </div>
        <div className="bt-skills">
          {members.map((id) => {
            const c = CHAR_BY_ID[id]
            const left = cd[id] ?? 0
            return (
              <button key={id} className="bt-skill" disabled={left > 0} onClick={() => skill(id)} style={{ ['--a' as string]: c.accent, ['--cd' as string]: left / 6000 }} aria-label={`${c.name} ${c.skills[1]?.name}`}>
                <img src={c.assets.portrait} alt="" />
                <span className="bt-skill-role"><RoleGlyph role={c.role} size="1.4rem" /></span>
                <span className="bt-skill-name">{c.skills[1]?.name}</span>
                {left > 0 && <span className="bt-cd num">{Math.ceil(left / 1000)}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {paused && !result && (
        <ConfirmDialog title="일시정지" body="전투를 포기하면 패배로 처리되고 소모한 행동력은 돌아오지 않습니다(임시 규칙)." actions={[
          { label: '포기', variant: 'dark', onClick: () => { setPaused(false); finish(false) } },
          { label: '계속', variant: 'primary', onClick: () => { audio.sfx('tap'); setPaused(false) } },
        ]} />
      )}

      {result && (
        <div className={`bt-result ${result.won ? 'win' : 'lose'}`}>
          <div className="bt-result-word">{result.won ? 'VICTORY' : 'DEFEAT'}</div>
          <h2>{result.won ? '승리' : '패배'}</h2>
          <div className="bt-result-rewards">
            {result.won ? result.rewards.map((r, i) => <RewardChip key={i} r={r} />) : <p>보상이 없습니다. 편성이나 성장을 조정해 보세요.</p>}
          </div>
          <div className="bt-result-actions">
            <Btn variant="dark" size="lg" onClick={retry}>재도전</Btn>
            <Btn variant="light" size="lg" onClick={() => nav.back()}>{CONTENT_META[contentId].name}(으)로</Btn>
            <Btn variant="primary" size="lg" onClick={() => nav.home()}>로비 복귀</Btn>
          </div>
        </div>
      )}
    </div>
  )
}
