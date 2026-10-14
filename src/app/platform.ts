// iPadOS 데스크톱 UA도 iOS 미디어 경로를 사용한다.
export const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
