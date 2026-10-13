import { useEffect, useState } from 'react'
import '../styles/newfaces.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { CHARACTERS } from '../game/data/characters'
import { BANNERS } from '../game/data/catalog'
import { LOBBY_SCENES } from '../game/data/lobbyScenes'
import { AmbientFx, MotionTitle } from '../ui/ui-motion'

// 영입 화면의 '신규 대원 미리보기'(Character-Additions 패키지 4명).
// 소개용 그림만 보여 준다: 영입 풀·확률·비용·획득 경로는 바꾸지 않았고, 이 화면에서 얻을 수 없다.
// 좌표는 영입 원본 캔버스(1456×819) 기준. 장식은 입력을 받지 않는다.
// 배너 픽업 대원(세렌·이안·칸나)은 배너에서 소개하므로 뺀다
const NEW = CHARACTERS.filter((c) => c.pending && !BANNERS.some((b) => b.featuredId === c.id))

export default function NewFaces({ onClose }: { onClose: () => void }) {
  const nav = useNav()
  const [id, setId] = useState(NEW[0]?.id)
  const c = NEW.find((x) => x.id === id) ?? NEW[0]
  const scene = LOBBY_SCENES[c.id]

  // Esc는 영입 화면을 떠나지 않고 미리보기만 닫는다
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [onClose])

  return (
    <div className="nf" role="dialog" aria-modal="true" aria-labelledby="nf-title" onClick={(e) => e.stopPropagation()}>
      <div className="nf-stripes" aria-hidden />
      <header className="nf-head">
        <small>PIRATE SCOUTING BROADCAST / PREVIEW</small>
        <h2 id="nf-title"><MotionTitle text="NEW FACES" /></h2>
        <span className="nf-chip warn">영입 대상 아님 · 출시·획득 경로 미정</span>
      </header>
      <button type="button" className="nf-close" aria-label="미리보기 닫기" onClick={() => { audio.sfx('tap'); onClose() }}>×</button>

      <div className="nf-list">
        {NEW.map((x, i) => (
          <button type="button" key={x.id} className={`nf-card ${x.id === c.id ? 'on' : ''}`} style={{ animationDelay: `${180 + i * 70}ms` }}
            aria-label={`${x.name} 미리보기${x.id === c.id ? ' (선택됨)' : ''}`} aria-pressed={x.id === c.id}
            onClick={() => { if (x.id !== c.id) { audio.sfx('select'); setId(x.id) } }}>
            <span className="pt"><img src={x.assets.portrait} alt="" /></span>
            <span className="tx"><b>{x.name}</b><em>{x.nameEn}</em><i>설정 미정</i></span>
          </button>
        ))}
      </div>

      <div className="nf-stage" key={c.id}>
        {scene
          ? <img className="nf-scene" src={scene.poster} alt={`${c.name} 전용 로비 장면(정지 그림)`} />
          : <img className="nf-fig" src={c.assets.action} alt={c.name} />}
        {scene && <AmbientFx kind={scene.amb} box={{ x: 0, y: 0, w: 1036, h: 583 }} count={18} z={2} />}
        <div className="nf-wipe" aria-hidden />
        <div className="nf-name">
          <span className="en"><MotionTitle text={c.nameEn} /></span>
          <i className="rule" aria-hidden />
          <b className="ko">{c.name}</b>
          <span className="chips"><span className="nf-chip">이름·역할·능력 설정 미정</span>{scene && <span className="nf-chip">로비: {scene.place}</span>}</span>
        </div>
      </div>

      <div className="nf-foot">
        <button type="button" className="nf-btn" onClick={() => { audio.sfx('tap'); onClose(); nav.push('characterDetail', { id: c.id }) }}>상세 보기</button>
        <p>인물 그림: 원본 참고 이미지 배경 제거본 · 로비 장면: 참고 이미지 기반 생성 정지 그림(대기 영상 없음)</p>
      </div>
    </div>
  )
}
