// 캐릭터 전용 로비 장면(신규 추가 캐릭터). 인물이 함께 그려진 완성 장면 정지 그림 1장씩이다.
// - 제작: 원본 참고 이미지를 기준으로 Creative Claw(nano-banana-2)로 생성 → 구도 보정 1회. 원본 그림이 아니다.
// - 대기 영상(lobby-idle)은 아직 없다: 화면에서는 정지 그림 + 카메라 숨쉬기 + 입자만 움직인다.
// - 지안처럼 장면 위에 다른 인물을 겹치지 않는다(인물 1명 = 장면 1장).
export type LobbyScene = { poster: string; amb: 'dust' | 'city' | 'wisp'; place: string }

export const LOBBY_SCENES: Record<string, LobbyScene> = {
  baekrin: { poster: 'lobby/baekrin.webp', amb: 'city', place: 'ROOFTOP' },
  kiyomi: { poster: 'lobby/kiyomi.webp', amb: 'wisp', place: 'EAVES ALLEY' },
  swordswoman: { poster: 'lobby/swordswoman.webp', amb: 'city', place: 'PLAZA' },
  kimono: { poster: 'lobby/kimono.webp', amb: 'dust', place: 'COURTYARD' },
}
