import { useCallback, useEffect, useRef, useState } from 'react'
import '../styles/opening.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import {
  OPENING, SONG, getOpeningVideo, releaseOpeningVideo, getOpeningSong, startOpeningSong, openingSongPlaying,
  msUntilVideo, syncSongTo, pauseOpeningSong, resumeOpeningSong, stopOpeningSong,
} from '../app/openingVideo'
import { CrownMark } from './Boot'

// 오프닝: 사용자가 선택한 15초 영상 + 오프닝 노래. 노래가 먼저 시작되고 0.6초 뒤 영상이 시작된다(영상 원래 소리와 겹쳐 재생).
// 영상 속 타이틀(13초~)부터 입력을 받는다.
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
    // 부트 화면을 거치지 않았거나 노래가 막혔으면 여기서 시작(막히면 SOUND ON 버튼)
    const startAt = s.settings.reduceMotion ? OPENING.titleAt : 0
    if (!openingSongPlaying()) startOpeningSong(s.settings.bgm, startAt).then((ok) => { if (!ok) setNeedTap(true) })
    host.current?.appendChild(getOpeningSong())
    if (mode !== 'video') return
    const v = getOpeningVideo(s.settings.quality === 'low')
    host.current?.appendChild(v)
    v.muted = false // 영상 원래 소리 + 오프닝 노래를 함께 재생
    v.volume = Math.max(0, Math.min(1, s.settings.bgm))
    v.pause()
    if (startAt) v.currentTime = startAt // 연출 감소: 타이틀부터
    let started = false
    const onTime = () => { if (v.currentTime >= OPENING.titleAt) setPress(true) }
    const onPlaying = () => { started = true }
    const onEnded = () => { setEnded(true); setPress(true) }
    const onError = () => setMode('static')
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('playing', onPlaying)
    v.addEventListener('ended', onEnded)
    v.addEventListener('error', onError)
    // 노래 시작 0.6초 뒤 영상 시작
    const go = window.setTimeout(() => {
      v.play().then(() => syncSongTo(v.currentTime)).catch(() => {
        // 소리 있는 재생이 막히면 음소거로 재생하고 SOUND ON 버튼을 보여준다
        v.muted = true
        v.play().then(() => { syncSongTo(v.currentTime); setNeedTap(true) }).catch(() => setMode('static'))
      })
    }, msUntilVideo())
    // 일정 시간 안에 재생이 시작되지 않으면 정적 타이틀로 대체
    const stall = window.setTimeout(() => { if (!started && v.currentTime <= startAt) setMode('static') }, 6000 + SONG.videoDelay * 1000)
    const vis = () => {
      if (document.hidden) { v.pause(); pauseOpeningSong() }
      else { if (!v.ended) { v.play().catch(() => {}); syncSongTo(v.currentTime) } resumeOpeningSong() }
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearTimeout(go)
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
    if (mode === 'static') setPress(true)
  }, [mode])

  useEffect(() => { if (press) game.updateSettings({ openingSeen: true }) }, [press])

  const enter = useCallback(() => {
    if (!press || leaving.current) return
    leaving.current = true
    audio.sfx('save')
    stopOpeningSong()
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
    syncSongTo(OPENING.titleAt)
    setPress(true)
  }

  return (
    <div className={`op ${ended ? 'ended' : ''}`} onPointerUp={enter}>
      <div className="op-video-host" ref={host} />
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
        <button className="op-sound" onPointerUp={(e) => {
          e.stopPropagation()
          const v = mode === 'video' ? getOpeningVideo() : null
          if (v) v.muted = false
          startOpeningSong(s.settings.bgm, v ? v.currentTime + SONG.videoDelay : 0).then((ok) => setNeedTap(!ok))
        }}>SOUND ON</button>
      )}
    </div>
  )
}
