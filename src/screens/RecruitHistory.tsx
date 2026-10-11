import '../styles/recruit.css'
import { useNav } from '../app/nav'
import { useGame } from '../game/store'
import { BANNER_BY_ID } from '../game/data/catalog'
import { CHAR_BY_ID } from '../game/data/characters'
import { TopBar, EmptyState } from '../ui/components'
import { audio } from '../app/audio'

export default function RecruitHistory(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  return (
    <div className="scr rh">
      <TopBar title="영입 기록" sub="HISTORY" />
      <div className="rh-list scroll-y">
        {s.recruitTx.length === 0 && <EmptyState title="아직 영입 기록이 없습니다" desc="영입 결과는 여기에서 다시 볼 수 있습니다." />}
        {s.recruitTx.map((tx) => (
          <button key={tx.requestId} className="rh-row" onClick={() => { audio.sfx('tap'); nav.push('recruitResult', { txId: tx.requestId, summary: true }) }}>
            <span className="rh-when num">{new Date(tx.createdAt).toLocaleString('ko-KR')}</span>
            <span className="rh-banner">{BANNER_BY_ID[tx.bannerId]?.title} · {tx.count}회</span>
            <span className="rh-faces">
              {tx.results.map((r, i) => <img key={i} src={CHAR_BY_ID[r.characterId].assets.portrait} alt={CHAR_BY_ID[r.characterId].name} className={`r${r.rarity}`} />)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
