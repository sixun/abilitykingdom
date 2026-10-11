import { useState } from 'react'
import { useGame } from '../../game/store'
import { WANTED, type StageDef } from '../../game/data/catalog'
import { TopBar, Modal, ProvisionalTag, fmt } from '../../ui/components'
import { audio } from '../../app/audio'
import { StagePanel } from './common'

// 현상수배: 골목 게시판의 수배서. 갱신 주기·도전 횟수·대상 생성 규칙은 미정
export default function Wanted(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const [sel, setSel] = useState<string | null>(null)
  const w = WANTED.find((x) => x.id === sel)
  return (
    <div className="scr ct ct-wanted">
      <div className="ct-bg"><img src="assets/bg/wanted.webp" alt="" /><div className="ct-shade" /></div>
      <TopBar title="현상수배" sub="WANTED BOARD" currencies={['stamina', 'exchangeMedal']} />
      <div className="wanted-note"><ProvisionalTag>갱신 주기·도전 횟수 미정</ProvisionalTag></div>
      <div className="wanted-board">
        {WANTED.map((x, i) => {
          const cleared = s.content.wantedCleared.includes(x.id)
          return (
            <button key={x.id} className={`poster g-${x.grade} ${cleared ? 'cleared' : ''}`} style={{ ['--r' as string]: `${[-3, 2, -1.5, 3][i % 4]}deg`, animationDelay: `${i * 90}ms` }} onClick={() => { audio.sfx('select'); setSel(x.id) }}>
              <span className="poster-pin" />
              <span className="poster-head">WANTED</span>
              <span className="poster-silhouette" />
              <strong>{x.name}</strong>
              <span className="poster-grade">{x.grade}급</span>
              <span className="poster-power num">권장 {fmt(x.enemy.power)}</span>
              {cleared && <span className="poster-stamp">처리 완료</span>}
            </button>
          )
        })}
      </div>
      {w && (
        <Modal onClose={() => setSel(null)} className="wanted-modal" labelledBy="w-title">
          <h2 id="w-title">{w.name} <small>{w.grade}급</small></h2>
          <StagePanel contentId="wanted" stage={w as unknown as StageDef} />
        </Modal>
      )}
    </div>
  )
}
