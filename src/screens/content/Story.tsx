import { useState } from 'react'
import { useGame } from '../../game/store'
import { useNav } from '../../app/nav'
import '../../styles/case.css'
import { STORY_CHAPTERS } from '../../game/data/catalog'
import { TopBar, ProvisionalTag } from '../../ui/components'
import { audio } from '../../app/audio'
import { StagePanel } from './common'
import { IconCheck } from '../../ui/icons'

// 스토리: 챕터 = 노선, 스테이지 = 역. 해금 규칙은 미정이므로 '이전 스테이지 클리어 시 다음 표시'만 임시 적용
export default function Story({ params }: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  // 로비의 '메인 목표'에서 들어오면 해당 스테이지 상세를 연다(전투는 자동 시작하지 않음)
  const target = STORY_CHAPTERS.find((c) => c.stages.some((st) => st.id === params.stageId))
  const [chId, setChId] = useState(target?.id ?? STORY_CHAPTERS[0].id)
  const ch = STORY_CHAPTERS.find((c) => c.id === chId)!
  const firstOpen = ch.stages.find((st) => !s.content.storyCleared.includes(st.id))?.id ?? ch.stages[ch.stages.length - 1].id
  const [stageId, setStageId] = useState(target ? (params.stageId as string) : firstOpen)
  const stage = ch.stages.find((st) => st.id === stageId) ?? ch.stages[0]
  const isOpen = (i: number) => i === 0 || s.content.storyCleared.includes(ch.stages[i - 1].id)

  return (
    <div className="scr ct ct-story">
      <div className="ct-bg"><img src="assets/bg/story.webp" alt="" /><div className="ct-shade" /></div>
      <TopBar title="스토리" sub="MAIN STORY" currencies={['stamina']} />
      <aside className="story-chapters">
        {STORY_CHAPTERS.map((c, i) => (
          <button key={c.id} className={c.id === chId ? 'on' : ''} onClick={() => { audio.sfx('select'); setChId(c.id); setStageId(c.stages[0].id) }}>
            <small>CHAPTER {String(i + 1).padStart(2, '0')}</small>
            <strong>{c.name}</strong>
            <span>{c.desc}</span>
          </button>
        ))}
        <ProvisionalTag>분량·해금 규칙 미정</ProvisionalTag>
      </aside>
      {chId === 'ch1' && (
        <button type="button" className="story-case" onClick={() => { audio.sfx('select'); nav.push('caseFile', {}) }} aria-label="CASE 01 끊어진 신호 — 사건 파일 열기">
          <img src="ref/ch1/alley.webp" alt="" />
          <small>CASE 01 · 인게임 1장</small><b>끊어진 신호</b>
          <span>스토리 · 조사 · 전투 5종 · 보스 「스태틱」 — 노드 8개 · 진행 {Object.keys(s.content.caseFile?.stars ?? {}).length} / 8</span>
          <em>사건 파일 열기 ›</em>
        </button>
      )}
      <div className="story-line" key={chId} hidden={chId === 'ch1'}>
        <div className="story-rail" />
        {ch.stages.map((st, i) => {
          const cleared = s.content.storyCleared.includes(st.id)
          const open = isOpen(i)
          return (
            <button key={st.id} disabled={!open} className={`story-st ${st.id === stage.id ? 'on' : ''} ${cleared ? 'cleared' : ''}`} style={{ animationDelay: `${i * 80}ms` }} onClick={() => { audio.sfx('select'); setStageId(st.id) }}>
              <span className="story-dot">{cleared ? <IconCheck size="1.6rem" /> : null}</span>
              <span className="story-st-id num">{st.id}</span>
              <span className="story-st-name">{open ? st.name : '잠김'}</span>
            </button>
          )
        })}
      </div>
      {chId !== 'ch1' && <div className="ct-panel-wrap"><StagePanel contentId="story" stage={stage} /></div>}
    </div>
  )
}
