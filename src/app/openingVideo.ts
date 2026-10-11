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
