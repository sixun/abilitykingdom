import type { CapacitorConfig } from '@capacitor/cli'

// 아이폰·안드로이드 앱 래퍼. 웹 빌드(dist)를 그대로 앱 안에 넣는다(오프라인 실행).
const config: CapacitorConfig = {
  appId: 'com.wakamonlabs.abilitykingdom',
  appName: '어빌리티킹덤',
  webDir: 'dist',
  backgroundColor: '#000000',
  android: { backgroundColor: '#000000' },
  ios: { backgroundColor: '#000000', contentInset: 'never' },
}

export default config
