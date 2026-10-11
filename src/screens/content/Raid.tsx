import { useState } from 'react'
import { useGame } from '../../game/store'
import { RAIDS } from '../../game/data/catalog'
import { TopBar, ProvisionalTag } from '../../ui/components'
import { audio } from '../../app/audio'
import { StagePanel } from './common'

// 레이드: 보스·난이도·참가·결과. 솔로/협동·인원·시즌 미정 → 솔로 테스트만 연결
export default function Raid(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const r = RAIDS[0]
  const [lvId, setLvId] = useState(r.levels[0].id)
  const lv = r.levels.find((x) => x.id === lvId)!
  return (
    <div className="scr ct ct-raid">
      <div className="ct-bg raid-bg"><img src="assets/bg/raid.webp" alt="" /><div className="ct-shade" /></div>
      <TopBar title="레이드" sub="RAID ALERT" currencies={['stamina', 'diamond']} />
      <div className="raid-alert">
        <span className="raid-siren">ALERT</span>
        <h2>{r.name}</h2>
        <p>{r.desc}</p>
        <div className="raid-meta">
          <span>참가 방식: 솔로(테스트) <ProvisionalTag>협동·인원 미정</ProvisionalTag></span>
          <span>격파 기록: {Object.values(s.content.raidBest).reduce((a, b) => a + b, 0)}회</span>
        </div>
      </div>
      <div className="ct-panel-wrap">
        <div className="diff-row">
          {r.levels.map((l) => <button key={l.id} className={l.id === lvId ? 'on' : ''} onClick={() => { audio.sfx('select'); setLvId(l.id) }}>{l.name}</button>)}
        </div>
        <StagePanel contentId="raid" stage={{ ...lv, name: `${r.name} · ${lv.name}` }} />
      </div>
    </div>
  )
}
