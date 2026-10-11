import '../../styles/content.css'
import type { StageDef } from '../../game/data/catalog'
import { STORY_CHAPTERS, DISTRICTS, WANTED, TRAININGS, RAIDS, ARENA_OPPONENTS } from '../../game/data/catalog'
import { useNav } from '../../app/nav'
import { Btn, RewardChip, fmt } from '../../ui/components'
import { CurrencyGlyph } from '../../ui/icons'

export type ContentId = 'story' | 'explore' | 'wanted' | 'training' | 'arena' | 'raid'

export const CONTENT_META: Record<ContentId, { name: string; bg: string }> = {
  story: { name: '스토리', bg: 'assets/bg/story.webp' },
  explore: { name: '도시 탐색', bg: 'assets/bg/map.webp' },
  wanted: { name: '현상수배', bg: 'assets/bg/wanted.webp' },
  training: { name: '훈련', bg: 'assets/bg/training.webp' },
  arena: { name: '아레나', bg: 'assets/bg/arena.webp' },
  raid: { name: '레이드', bg: 'assets/bg/raid.webp' },
}

export function findStage(contentId: ContentId, stageId: string): (StageDef & { context: string }) | null {
  if (contentId === 'story') for (const ch of STORY_CHAPTERS) { const s = ch.stages.find((x) => x.id === stageId); if (s) return { ...s, context: ch.name } }
  if (contentId === 'explore') for (const d of DISTRICTS) { const s = d.incidents.find((x) => x.id === stageId); if (s) return { ...s, context: d.name } }
  if (contentId === 'wanted') { const w = WANTED.find((x) => x.id === stageId); if (w) return { ...(w as unknown as StageDef), context: `${w.grade}급 수배` } }
  if (contentId === 'training') for (const t of TRAININGS) { const s = t.levels.find((x) => x.id === stageId); if (s) return { ...s, name: `${t.name} · ${s.name}`, context: t.name } }
  if (contentId === 'raid') for (const r of RAIDS) { const s = r.levels.find((x) => x.id === stageId); if (s) return { ...s, name: `${r.name} · ${s.name}`, context: r.name } }
  if (contentId === 'arena') {
    const o = ARENA_OPPONENTS.find((x) => x.id === stageId)
    if (o) return { id: o.id, name: `${o.name} (Lv.${o.level})`, desc: '상대의 방어 편성과 대결합니다. 비동기 대전 가정(미정).', enemy: { name: `${o.name}의 팀`, power: o.power, trait: '플레이어 방어 편성' }, staminaCost: 5, rewards: [{ kind: 'currency', id: 'exchangeMedal', qty: 5 }], bg: 'arena', context: '아레나' }
  }
  return null
}

export function StagePanel({ contentId, stage, extra }: { contentId: ContentId; stage: StageDef; extra?: React.ReactNode }) {
  const nav = useNav()
  return (
    <div className="stage-panel" key={stage.id}>
      <h3>{stage.name}</h3>
      {stage.desc && <p className="sp-desc">{stage.desc}</p>}
      <div className="sp-enemy">
        <div><small>적</small><strong>{stage.enemy.name}</strong></div>
        <div><small>권장 전투력</small><strong className="num">{fmt(stage.enemy.power)}</strong></div>
        {stage.enemy.trait && <div><small>특징</small><strong>{stage.enemy.trait}</strong></div>}
      </div>
      <div className="sp-rewards">
        <small>보상</small>
        <div>{stage.rewards.map((r, i) => <RewardChip key={i} r={r} compact />)}</div>
      </div>
      {extra}
      <div className="sp-foot">
        <span className="sp-cost"><CurrencyGlyph id="stamina" size="2.2rem" />{stage.staminaCost}</span>
        <Btn variant="primary" size="lg" onClick={() => nav.push('prep', { contentId, stageId: stage.id })}>출전 준비</Btn>
      </div>
    </div>
  )
}
