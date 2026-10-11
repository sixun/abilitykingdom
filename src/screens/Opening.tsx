import { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/opening.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import { OPENING, getOpeningVideo, releaseOpeningVideo } from '../app/openingVideo'
import { CrownMark } from './Boot'

// 오프닝: 사용자가 선택한 15초 영상. 영상 속 타이틀(13초~)부터 입력을 받는다.
// 영상이 끝나도 자동으로 로비에 들어가지 않고 마지막 장면(정지 타이틀)을 유지한다.
// 영상 재생 실패 시 정적 타이틀로 대체한다.
export default function Opening({ params }: { params: Record<string, unknown> }) {
  const nav = useNav()
  const s = useGame()
  const seenBefore = useRef(s.settings.openingSeen)
  const host = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'video' | 'static'>(params.fallback ? 'static' : 'video')
  const [press, setPress] = useState(false)
  const [ended, setEnded] = useState(false)
  const [needTap, setNeedTap] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const leaving = useRef(false)

  useEffect(() => {
    audio.bgm('none')
    if (mode !== 'video') return
    const v = getOpeningVideo(s.settings.quality === 'low')
    host.current?.appendChild(v)
    v.muted = false
    v.volume = Math.max(0, Math.min(1, s.settings.bgm))
    if (s.settings.reduceMotion) v.currentTime = OPENING.titleAt // 연출 감소: 타이틀부터
    let started = false
    const onTime = () => { if (v.currentTime >= OPENING.titleAt) setPress(true) }
    const onPlaying = () => { started = true }
    const onEnded = () => { setEnded(true); setPress(true) }
    const onError = () => setMode('static')
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('playing', onPlaying)
    v.addEventListener('ended', onEnded)
    v.addEventListener('error', onError)
    v.play().catch(() => {
      // 소리 있는 자동 재생이 막히면 음소거로 재생하고 소리 켜기 버튼을 보여준다
      v.muted = true
      v.play().then(() => setNeedTap(true)).catch(() => setMode('static'))
    })
    // 일정 시간 안에 재생이 시작되지 않으면 정적 타이틀로 대체
    const stall = window.setTimeout(() => { if (!started && v.currentTime === 0) setMode('static') }, 6000)
    const vis = () => { if (document.hidden) v.pause(); else if (!v.ended) v.play().catch(() => {}) }
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearTimeout(stall)
      document.removeEventListener('visibilitychange', vis)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('playing', onPlaying)
      v.removeEventListener('ended', onEnded)
      v.removeEventListener('error', onError)
      releaseOpeningVideo()
    }
  }, [mode])

  useEffect(() => {
    if (mode === 'static') { setPress(true); audio.sfx('title') }
  }, [mode])

  useEffect(() => { if (press) game.updateSettings({ openingSeen: true }) }, [press])

  const enter = useCallback(() => {
    if (!press || leaving.current) return
    leaving.current = true
    audio.sfx('save')
    audio.bgm('lobby')
    nav.reset('lobby', { first: true })
  }, [press, nav])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (!e.repeat) enter() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [enter])

  const skip = () => {
    audio.sfx('tap')
    getOpeningVideo().currentTime = OPENING.titleAt
    setPress(true)
  }

  return (
    <div className={`op ${ended ? 'ended' : ''}`} onPointerUp={enter}>
      {mode === 'video' && <div className="op-video-host" ref={host} />}
      {mode === 'static' && (
        <div className="op-title static">
          {!posterFailed && <img className="op-title-bg" src={OPENING.poster} alt="" onError={() => setPosterFailed(true)} />}
          {posterFailed && (
            <>
              <div className="op-title-logo">
                <div className="op-title-crown"><CrownMark /></div>
                <div className="op-title-word">ABILITY<br />KINGDOM</div>
              </div>
              <div className="op-press on">PRESS ANY BUTTON</div>
            </>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{press ? 'PRESS ANY BUTTON' : ''}</span>
      {mode === 'video' && !press && seenBefore.current && (
        <button className="op-skip" onPointerUp={(e) => { e.stopPropagation(); skip() }} aria-label="SKIP">SKIP ▸▸</button>
      )}
      {needTap && (
        <button className="op-sound" onPointerUp={(e) => { e.stopPropagation(); getOpeningVideo().muted = false; setNeedTap(false) }}>SOUND ON</button>
      )}
    </div>
  )
}
