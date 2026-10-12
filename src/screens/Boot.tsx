import { useEffect, useState } from 'react'
import '../styles/opening.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { CHARACTERS } from '../game/data/characters'
import { useGame } from '../game/store'
import { getOpeningVideo, waitForVideo, getOpeningSong, startOpeningSong, OPENING } from '../app/openingVideo'

// 초기 로딩: 핵심 에셋을 미리 받는다. 이 화면부터 오프닝까지는 한글을 쓰지 않는다.
export const OPENING_ASSETS = [
  OPENING.poster, 'assets/bg/platform.webp', 'assets/bg/lobby.webp',
  ...CHARACTERS.filter((c) => !c.pending).flatMap((c) => [c.assets.stand, c.assets.action, c.assets.portrait]), // 신규(설정 미정) 캐릭터는 보는 화면에서 불러온다
]

export function preload(urls: string[], onProgress: (k: number) => void) {
  let done = 0, failed = 0
  return Promise.all(urls.map((u) => new Promise<void>((res) => {
    const img = new Image()
    img.onload = () => { done++; onProgress(done / urls.length); res() }
    img.onerror = () => { done++; failed++; onProgress(done / urls.length); res() }
    img.src = u
  }))).then(() => failed)
}

export default function Boot(_: { params: Record<string, unknown> }) {
  const nav = useNav()
  const s = useGame()
  const [p, setP] = useState(0)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(0)

  useEffect(() => {
    let alive = true
    let pi = 0, pv = 0
    const upd = () => alive && setP(pi * 0.3 + pv * 0.7)
    // 오프닝 영상을 미리 버퍼링(오프닝 화면이 같은 요소를 이어받음)
    const v = getOpeningVideo(s.settings.quality === 'low')
    getOpeningSong() // 오프닝 노래도 미리 받아 둔다
    Promise.all([
      preload(OPENING_ASSETS, (k) => { pi = k; upd() }),
      waitForVideo(v, (k) => { pv = k; upd() }),
    ]).then(([f, videoOk]) => { if (alive) { setFailed(videoOk ? 0 : 1 + f); setReady(true) } })
    return () => { alive = false }
  }, [])

  const start = () => {
    if (!ready) return
    audio.unlock()
    // 탭한 순간 오프닝 노래 시작(0.6초 뒤 오프닝 화면이 영상을 시작한다)
    startOpeningSong(s.settings.bgm, s.settings.reduceMotion ? OPENING.titleAt : 0)
    nav.replace('opening', { fallback: failed > 0 })
  }

  useEffect(() => {
    if (!ready) return
    const k = (e: KeyboardEvent) => { if (!e.repeat) start() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  return (
    <div className="boot" onPointerUp={start} role="button" aria-label="TAP TO START">
      <div className="boot-mark" aria-hidden><CrownMark /></div>
      <div className="boot-word">ABILITY KINGDOM</div>
      <div className="boot-bar"><i style={{ transform: `scaleX(${p})` }} /></div>
      <div className={`boot-cta ${ready ? 'on' : ''}`}>{ready ? 'TAP TO START' : `LOADING ${Math.round(p * 100)}%`}</div>
      <div className="boot-note">SOUND ON · LANDSCAPE</div>
    </div>
  )
}

export function CrownMark({ size = '100%' }: { size?: string }) {
  return (
    <svg viewBox="0 0 120 80" style={{ width: size, height: 'auto' }} aria-hidden>
      <path d="M8 70 L16 14 L40 42 L60 6 L80 42 L104 14 L112 70 Z" fill="none" stroke="currentColor" strokeWidth="7" strokeLinejoin="miter" />
      <path d="M2 76 H118" stroke="currentColor" strokeWidth="5" />
    </svg>
  )
}
