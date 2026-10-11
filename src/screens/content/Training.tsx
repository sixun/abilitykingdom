import { useState } from 'react'
import { TRAININGS } from '../../game/data/catalog'
import { TopBar, ProvisionalTag } from '../../ui/components'
import { audio } from '../../app/audio'
import { StagePanel } from './common'
import { IconDumbbell } from '../../ui/icons'

// 훈련: 종류 → 난이도 → 재료 보상. 소모 자원·소탕·입장 제한은 미정
export default function Training(_: { params: Record<string, unknown> }) {
  const [tId, setTId] = useState(TRAININGS[0].id)
  const t = TRAININGS.find((x) => x.id === tId)!
  const [lvId, setLvId] = useState(t.levels[0].id)
  const lv = t.levels.find((x) => x.id === lvId) ?? t.levels[0]
  return (
    <div className="scr ct ct-training">
      <div className="ct-bg"><img src="assets/bg/training.webp" alt="" /><div className="ct-shade" /></div>
      <TopBar title="훈련" sub="TRAINING FACILITY" currencies={['stamina', 'credit']} />
      <div className="train-list">
        {TRAININGS.map((x, i) => (
          <button key={x.id} className={x.id === tId ? 'on' : ''} style={{ animationDelay: `${i * 70}ms` }} onClick={() => { audio.sfx('select'); setTId(x.id); setLvId(x.levels[0].id) }}>
            <IconDumbbell size="3rem" />
            <span><strong>{x.name}</strong><small>보상: {x.reward}</small></span>
          </button>
        ))}
        <ProvisionalTag>소탕·입장 제한 미정</ProvisionalTag>
      </div>
      <div className="ct-panel-wrap" key={tId}>
        <div className="diff-row">
          {t.levels.map((l) => <button key={l.id} className={l.id === lv.id ? 'on' : ''} onClick={() => { audio.sfx('select'); setLvId(l.id) }}>{l.name}</button>)}
        </div>
        <StagePanel contentId="training" stage={{ ...lv, name: `${t.name} · ${lv.name}` }} />
      </div>
    </div>
  )
}
