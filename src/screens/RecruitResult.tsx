import { useEffect, useState } from 'react'
import '../styles/recruit.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import { CHAR_BY_ID } from '../game/data/characters'
import { BANNER_BY_ID } from '../game/data/catalog'
import { ROLE_LABEL } from '../game/config'
import { Btn, Stars, useAction, ErrorBanner, EmptyState } from '../ui/components'
import { IconSkip } from '../ui/icons'

// 결과 흐름: 신규 캐릭터 등장 → 개별 정보 → 전체 결과 → 닫기/재영입
// 이미 확정된 거래(RecruitmentTransaction)를 보여주기만 한다. 스킵·재열람은 결과를 다시 계산하지 않는다.
export default function RecruitResult({ params }: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const savedTx = s.recruitTx.find((t) => t.requestId === params.txId)
  const tx = savedTx ? { ...savedTx, results: savedTx.results.filter((r) => CHAR_BY_ID[r.characterId]) } : undefined
  const [i, setI] = useState(params.summary ? Infinity : 0)
  const { run, pending, failed, clearFailed } = useAction()

  const cur = tx && i < tx.results.length ? tx.results[i] : null
  useEffect(() => {
    if (!cur) { audio.sfx('save'); return }
    audio.sfx(cur.rarity >= 5 ? 'reveal5' : 'reveal')
  }, [i, cur])

  if (!tx) return <div className="scr rr"><EmptyState title="영입 기록을 찾을 수 없습니다" action={<Btn onClick={() => nav.back()}>돌아가기</Btn>} /></div>

  const again = async () => {
    const res = await run('again', (rid) => game.recruit(tx.bannerId, tx.count, rid))
    if (res?.ok) nav.replace('recruitResult', { txId: res.value.requestId })
  }

  if (cur) {
    const c = CHAR_BY_ID[cur.characterId]
    return (
      <div className={`scr rr rr-reveal r${cur.rarity}`} style={{ ['--a' as string]: c.accent }} onClick={() => setI((n) => n + 1)}>
        <div className="rr-burst" key={`b${i}`} />
        <img className="rr-fig" key={`f${i}`} src={cur.isNew ? c.assets.action : c.assets.stand} alt="" />
        <div className="rr-card" key={`c${i}`}>
          {cur.isNew && <span className="rr-new">NEW</span>}
          {cur.isPickup && <span className="rr-pickup">PICK UP</span>}
          <Stars n={cur.rarity} />
          <h2>{c.name}</h2>
          <p>{ROLE_LABEL[c.role]} · “{c.tagline}”</p>
          {!cur.isNew && <p className="rr-dupe">중복 획득 · 전환 규칙 미정(기록만 저장)</p>}
        </div>
        <div className="rr-count num">{i + 1} / {tx.results.length}</div>
        <button className="rr-skip" onClick={(e) => { e.stopPropagation(); audio.sfx('tap'); setI(Infinity) }}><IconSkip size="1.8rem" />건너뛰기</button>
        <div className="rr-hint">화면을 눌러 계속</div>
      </div>
    )
  }

  const banner = BANNER_BY_ID[tx.bannerId]
  return (
    <div className="scr rr rr-summary">
      <div className="rr-sum-head">
        <h2>영입 결과</h2>
        <span>{banner?.title ?? "이전 배너"} · {tx.count}회 · {new Date(tx.createdAt).toLocaleString('ko-KR')}</span>
        {tx.pointsGained > 0 && <span className="rr-pt">영입 포인트 +{tx.pointsGained}</span>}
      </div>
      <div className={`rr-grid n${tx.results.length}`}>
        {tx.results.map((r, k) => {
          const c = CHAR_BY_ID[r.characterId]
          return (
            <div key={k} className={`rr-cell r${r.rarity}`} style={{ ['--a' as string]: c.accent, animationDelay: `${k * 60}ms` }}>
              <img src={c.assets.portrait} alt="" />
              <div className="rr-cell-info"><Stars n={r.rarity} /><strong>{c.name}</strong></div>
              {r.isNew ? <span className="rr-new sm">NEW</span> : <span className="rr-dup sm">중복</span>}
            </div>
          )
        })}
      </div>
      {failed && <div className="rr-err"><ErrorBanner error={failed.error} onRetry={again} onClose={clearFailed} /></div>}
      <div className="rr-actions">
        <Btn variant="dark" size="lg" onClick={() => nav.back()}>확인</Btn>
        {!params.summary && <Btn variant="accent" size="lg" disabled={!!pending} onClick={again}>{tx.count}회 다시 영입</Btn>}
      </div>
    </div>
  )
}
