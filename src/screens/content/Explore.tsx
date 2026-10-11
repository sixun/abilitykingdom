import { useState } from 'react'
import { DISTRICTS } from '../../game/data/catalog'
import { TopBar, ProvisionalTag } from '../../ui/components'
import { audio } from '../../app/audio'
import { StagePanel } from './common'
import { IconPin } from '../../ui/icons'

// 도시 탐색: 가상 구역 지도 → 구역 → 사건 목록 → 진입 정보. 실제 지명은 분위기 참고용.
export default function Explore(_: { params: Record<string, unknown> }) {
  const [dId, setDId] = useState<string | null>(null)
  const [incId, setIncId] = useState<string | null>(null)
  const d = DISTRICTS.find((x) => x.id === dId)
  const inc = d?.incidents.find((x) => x.id === incId) ?? d?.incidents[0]

  return (
    <div className="scr ct ct-explore">
      <div className={`map ${d ? 'zoomed' : ''}`} style={d ? { ['--zx' as string]: d.x, ['--zy' as string]: d.y } : undefined}>
        <img src="assets/bg/map.webp" alt="" />
        {DISTRICTS.map((x, i) => (
          <button key={x.id} className={`map-pin ${x.id === dId ? 'on' : ''}`} style={{ left: `${x.x * 100}%`, top: `${x.y * 100}%`, animationDelay: `${200 + i * 90}ms` }} onClick={() => { audio.sfx('select'); setDId(x.id); setIncId(null) }}>
            <IconPin size="3rem" />
            <span>{x.name}<b>{x.incidents.length}</b></span>
          </button>
        ))}
      </div>
      <TopBar title="도시 탐색" sub="CITY EXPLORATION" currencies={['stamina']} onBack={d ? () => { audio.sfx('tap'); setDId(null) } : undefined} />
      <div className="explore-note"><ProvisionalTag>맵 생성·이동·탐색 시간 규칙 미정</ProvisionalTag></div>
      {!d && <div className="explore-hint">구역을 선택하세요</div>}
      {d && inc && (
        <div className="ct-panel-wrap explore-panel" key={d.id}>
          <div className="district-head">
            <h2>{d.name}</h2>
            <p>{d.desc}</p>
          </div>
          <div className="incident-list">
            {d.incidents.map((x) => (
              <button key={x.id} className={x.id === inc.id ? 'on' : ''} onClick={() => { audio.sfx('select'); setIncId(x.id) }}>{x.name}</button>
            ))}
          </div>
          <StagePanel contentId="explore" stage={inc} />
        </div>
      )}
    </div>
  )
}
