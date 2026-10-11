// 오프닝 영상(사용자 제공, 15.05초, 1920×1080 원본 HEVC → H.264 재인코딩).
// 초기 로딩 화면에서 미리 버퍼링하고, 오프닝 화면이 같은 요소를 그대로 이어받는다.

export const OPENING = {
  src1080: 'assets/video/opening_1080.mp4',
  src720: 'assets/video/opening_720.mp4',
  srcWebm: 'assets/video/opening_1080.webm',
  poster: 'assets/video/opening_title.webp',
  /** 영상 속 타이틀(ABILITY KINGDOM · PRESS ANY BUTTON)이 완성되는 시점. 이후부터 입력을 받는다 */
  titleAt: 13.0,
  duration: 15.05,
}

let el: HTMLVideoElement | null = null

export function pickSource(lowQuality: boolean) {
  // VP9/Opus WebM을 확실히 재생하는 브라우저(Chrome·Edge·Firefox)는 WebM, 그 외(Safari 등)는 H.264 MP4
  const probe = document.createElement('video')
  if (!lowQuality && probe.canPlayType('video/webm; codecs="vp9, opus"') === 'probably') return OPENING.srcWebm
  const short = Math.min(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1)
  return lowQuality || short < 900 ? OPENING.src720 : OPENING.src1080
}

export function getOpeningVideo(lowQuality = false): HTMLVideoElement {
  if (!el) {
    el = document.createElement('video')
    el.src = pickSource(lowQuality)
    el.preload = 'auto'
    el.playsInline = true
    el.setAttribute('playsinline', '')
    el.setAttribute('webkit-playsinline', '')
    el.className = 'op-video'
    el.load()
  }
  return el
}

/** 재생 가능할 만큼 버퍼링되면 resolve(최대 대기 후 그냥 진행) */
export function waitForVideo(v: HTMLVideoElement, onProgress: (k: number) => void, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (v.readyState >= 4) { onProgress(1); resolve(true); return }
    let done = false
    const finish = (ok: boolean) => { if (done) return; done = true; clearInterval(iv); clearTimeout(to); v.removeEventListener('canplaythrough', onOk); v.removeEventListener('error', onErr); resolve(ok) }
    const onOk = () => { onProgress(1); finish(true) }
    const onErr = () => finish(false)
    const iv = window.setInterval(() => {
      try {
        if (v.buffered.length && v.duration) onProgress(Math.min(1, v.buffered.end(v.buffered.length - 1) / v.duration))
      } catch { /* noop */ }
    }, 200)
    const to = window.setTimeout(() => finish(true), timeoutMs) // 느린 회선: 스트리밍으로 진행
    v.addEventListener('canplaythrough', onOk)
    v.addEventListener('error', onErr)
  })
}

export function releaseOpeningVideo() {
  if (!el) return
  el.pause()
  el.remove()
  el.removeAttribute('src')
  el.load()
  el = null
}

// ───────── 오프닝 노래(사용자 제공 "Four-Note Storm", 39.96초) ─────────
// 오프닝 시작 순간 노래가 먼저 시작되고, 0.6초 뒤 영상이 시작된다(영상 자체 소리는 끈다).
// 노래 시간 = 영상 시간 + 0.6초로 맞춰 두고, 건너뛰기·일시정지 복귀 때도 이 간격을 유지한다.
export const SONG = { src: 'assets/audio/opening_song.mp3', videoDelay: 0.6 }

let song: HTMLAudioElement | null = null
let songStartedAt = 0 // performance.now() 기준 노래 시작 시각
let fadeTimer = 0

export function getOpeningSong(): HTMLAudioElement {
  if (!song) {
    song = new Audio()
    song.src = SONG.src
    song.preload = 'auto'
    song.loop = true // 타이틀에서 오래 머물러도 노래가 끊기지 않게 반복
    song.className = 'op-song'
    song.load()
  }
  return song
}

/** 노래 시작(사용자 입력 직후에 부르면 자동 재생 제한에 걸리지 않는다). at = 노래 시작 위치(초) */
export function startOpeningSong(volume: number, at = 0): Promise<boolean> {
  const a = getOpeningSong()
  window.clearInterval(fadeTimer)
  a.volume = Math.max(0, Math.min(1, volume))
  try { a.currentTime = at } catch { /* 메타데이터 전 */ }
  songStartedAt = performance.now()
  return a.play().then(() => true).catch(() => false)
}

export function openingSongPlaying() { return !!song && !song.paused }
// 자동 검증용: 노래 재생 여부
;(window as unknown as { __AK_SONG__: () => boolean }).__AK_SONG__ = openingSongPlaying

/** 노래 시작 후 영상을 시작해야 할 때까지 남은 시간(ms) */
export function msUntilVideo() {
  if (!song || song.paused) return SONG.videoDelay * 1000
  return Math.max(0, SONG.videoDelay * 1000 - (performance.now() - songStartedAt))
}

/** 영상 위치에 맞춰 노래 위치를 다시 맞춘다(노래 = 영상 + 0.6초) */
export function syncSongTo(videoTime: number) {
  if (!song) return
  const want = videoTime + SONG.videoDelay
  if (Math.abs(song.currentTime - want) > 0.08) { try { song.currentTime = want } catch { /* noop */ } }
}

export function pauseOpeningSong() { song?.pause() }
export function resumeOpeningSong() { song?.play().catch(() => {}) }

/** 로비로 넘어갈 때 짧게 줄이며 끈다 */
export function stopOpeningSong(fadeMs = 450) {
  const a = song
  if (!a) return
  window.clearInterval(fadeTimer)
  const v0 = a.volume, t0 = performance.now()
  fadeTimer = window.setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / fadeMs)
    a.volume = v0 * (1 - k)
    if (k >= 1) { window.clearInterval(fadeTimer); a.pause(); a.removeAttribute('src'); a.load(); if (song === a) song = null }
  }, 30)
}
