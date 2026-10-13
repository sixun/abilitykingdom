// S01 패스(시안: SENKA PASS). 화면 표시용 샘플 값이며 패스 경험치·구매·보상 지급 규칙은 아직 정해지지 않았다.
// - 레벨 35/50은 시안 값. 마일스톤은 레벨에 맞춰 표시(시안 그림은 40까지 체크돼 있으나 35레벨과 맞지 않아 데이터 기준으로 그림)
// - 보상 카드 5장은 시안 그림 그대로. 센카는 아직 캐릭터 데이터에 없다(이름·등급만 시안 표기)
export const PASS_S01 = {
  season: 'S01',
  title: 'SENKA PASS',
  level: 35,
  maxLevel: 50,
  premium: false,
  milestones: [0, 10, 20, 30, 40, 50],
  rewards: [
    { id: 'card-senka', name: '7성 센카', term: '영구', kind: '캐릭터', note: '프리미엄 최종 보상(시안 표기). 센카 캐릭터 데이터·7성 체계는 아직 없습니다.' },
    { id: 'card-lobby', name: '센카 로비', term: '영구', kind: '로비 장면', note: '센카 전용 로비 장면(시안 그림). 로비 적용은 센카 등록 후 연결합니다.' },
    { id: 'card-icons', name: '아이콘 3종', term: '영구', kind: '프로필 아이콘', note: '프로필 아이콘 3종(시안 그림).' },
    { id: 'card-talk', name: '대화권', term: '500회', kind: '소모품', note: '캐릭터 대화 이용권 500회(시안 표기). 대화 기능 규칙은 미정입니다.' },
    { id: 'card-xmas', name: '크리스마스 스킨', term: '영구', kind: '스킨', note: '센카 크리스마스 스킨(시안 그림).' },
  ],
} as const
