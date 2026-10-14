// 화면 장면·캐릭터 대기 영상.
// - 현재 맨 위 화면일 때만 재생하고, 다른 화면이 위에 쌓이거나 앱이 백그라운드로 가면 멈춘다(동시에 여러 영상 디코딩 방지).
// - 동작 줄이기(OS·앱 설정), 재생 실패, 알파 WebM 미지원(사파리·아이폰 앱)에서는 정지 포스터를 쓴다.
// - 영상은 화면 요소(버튼)가 아니다: pointer-events 없음, 소리 없음(BGM은 기존 오디오 시스템 담당).
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNav, useScreenKey } from '../app/nav'
import { useGame } from '../game/store'
import { IS_IOS } from '../app/platform'

/** 이 화면이 스택 맨 위(사용자가 보고 있는 화면)인지 */
export function useScreenActive() {
  const nav = useNav()
  const key = useScreenKey()
  return nav.stack[nav.stack.length - 1]?.key === key
}

/** 앱 설정 또는 OS의 동작 줄이기 */
export function useReduceMotion() {
  const s = useGame()
  const [os, setOs] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const q = matchMedia('(prefers-reduced-motion: reduce)'); const f = () => setOs(q.matches)
    q.addEventListener('change', f); return () => q.removeEventListener('change', f)
  }, [])
  return os || s.settings.reduceMotion
}

/** VP9 알파 WebM을 투명하게 재생할 수 있는 환경인지(사파리 계열·iOS WebView는 제외 → 포스터 사용) */
const ALPHA_OK = (() => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const safari = /^((?!chrome|chromium|crios|android|edg).)*safari/i.test(ua)
  if (ios || safari) return false
  return document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== ''
})()

export function MotionVideo({ src, poster, alpha = false, style, className = '' }: { src: string; poster: string; alpha?: boolean; style?: CSSProperties; className?: string }) {
  const active = useScreenActive()
  const reduce = useReduceMotion()
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)
  const still = reduce || failed || (alpha && !ALPHA_OK)

  useEffect(() => {
    const v = ref.current
    if (!v || still) return
    const sync = () => {
      if (active && !document.hidden) v.play().catch(() => setFailed(true))
      else v.pause()
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      v.pause()
    }
  }, [active, still])

  if (still) return <img className={`mv ${className}`} src={poster} alt="" draggable={false} style={style} />
  return (
    <video
      ref={ref}
      className={`mv ${IS_IOS ? 'mv-ios' : ''} ${className}`}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      disablePictureInPicture
      aria-hidden
      style={style}
    >
      {/* 알파 영상은 WebM만. 불투명 장면은 WebM(VP9) → MP4(H.264) 순으로 고른다 */}
      {!IS_IOS && <source src={src.replace(/\.(mp4|webm)$/, '.webm')} type="video/webm" onError={alpha ? () => setFailed(true) : undefined} />}
      {!alpha && <source src={src.replace(/\.(mp4|webm)$/, '.mp4')} type="video/mp4" onError={() => setFailed(true)} />}
    </video>
  )
}

/** 영상 배치(원본 화면 좌표): 화면 크기 × 배율 s, 위치 (x, y) */
export function fitBox(f: { s: number; x: number; y: number }, canvas: { width: number; height: number }): CSSProperties {
  return { position: 'absolute', left: f.x, top: f.y, width: canvas.width * f.s, height: canvas.height * f.s }
}
