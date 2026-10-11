import type { CapacitorConfig } from '@capacitor/cli'

// 아이폰·안드로이드 앱 래퍼.
// 테스트 기간에는 앱이 공개 웹(GitHub Pages)을 직접 불러온다 → 웹만 배포하면 설치된 앱도 다음 실행 때 바뀐다.
// 인터넷이 없으면 앱 안에 들어 있는 native-shell/offline.html을 보여준다.
// 앱스토어 정식 출시 전에는 server 항목을 지우고 webDir을 'dist'로 바꿔 웹 파일을 앱 안에 넣는 방식으로 되돌린다.
const config: CapacitorConfig = {
  appId: 'com.wakamonlabs.abilitykingdom',
  appName: '어빌리티킹덤',
  // 앱에는 오프라인 안내 화면만 넣는다(게임 화면은 공개 웹에서 불러옴)
  webDir: 'native-shell',
  backgroundColor: '#000000',
  server: {
    url: 'https://sixun.github.io/abilitykingdom/',
    errorPath: 'offline.html',
  },
  android: { backgroundColor: '#000000' },
  ios: { backgroundColor: '#000000', contentInset: 'never' },
}

export default config
