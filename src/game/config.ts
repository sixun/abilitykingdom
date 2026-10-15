// 임시 기준값. 기획서에서 '임시/미정'으로 분류된 항목은 전부 이 파일에서만 바꾼다.

export const GAME_CONFIG = {
  /** 시안의 4명. 실제 전투 인원 확정이 아님 */
  teamSize: 4,
  /** 팀 프리셋 수 */
  presetCount: 3,
  /** 출전 최소 인원. 전투 규칙 확정 시 변경 */
  minMembersToDeploy: 1,
  /** 동일 캐릭터 중복 배치 허용 여부. 기본 금지 */
  allowDuplicateInTeam: false,
  /** 이미 팀에 있는 캐릭터를 다른 슬롯에 넣을 때: 위치 교환 */
  duplicateSelectBehavior: 'swap' as 'swap' | 'move',
  /** 레벨 상한(샘플) */
  maxLevel: 60,
  /** 영입 10회 묶음 수 */
  multiPullCount: 10,
  /** 영입 포인트 교환 기준(샘플) */
  scoutPointCap: 200,
  /** 행동력 최대치(샘플) */
  staminaMax: 240,
}

/** 화면별 전환 시간(초기 조정값, 기획서 12항) */
export const MOTION = {
  press: 110,
  tab: 220,
  screen: 420,
  swap: 520,
  entrance: 2100,
  returnShort: 450,
}

export const ROLE_LABEL: Record<string, string> = {
  attack: '공격',
  defense: '방어',
  ability: '능력',
  support: '지원',
}

export const ATTRIBUTE_LABEL: Record<string, string> = {
  blade: '참격',
  barrier: '방벽',
  sound: '음파',
  gravity: '중력',
  vital: '생명',
  pulse: '맥동',
  space: '공간',
  star: '성광',
  mist: '연무',
  spirit: '혼불',
  tide: '물결',
}

export const CURRENCY_LABEL: Record<string, string> = {
  diamond: '다이아',
  credit: '크레딧',
  ticket: '영입 티켓',
  scoutPoint: '영입 포인트',
  exchangeMedal: '교환 메달',
  stamina: '행동력',
}
