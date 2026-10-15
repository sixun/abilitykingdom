import type { CharacterDefinition } from '../types'

// 샘플 캐릭터 데이터. 수치는 Lv.40 기준(지안 = 캐릭터 상세 원본 화면 값). 이름·역할·속성·희귀도는 확정 데이터가 아니다.
// 이미지: AI 생성 임시 에셋(정적 1장 × 포즈 2종). 제작용 리깅/애니메이션 에셋 아님.

const a = (id: string) => ({
  portrait: `assets/chars/${id}_portrait.webp`,
  stand: `assets/chars/${id}_stand.webp`,
  action: `assets/chars/${id}_action.webp`,
})

export const CHARACTERS: CharacterDefinition[] = [
  {
    id: 'doyun', name: '도윤', nameEn: 'DOYUN', role: 'support', attribute: 'vital', rarity: 3, accent: '#b7e36a',
    tagline: '다음 열차까진 3분. 충분해.',
    profile: { affiliation: '주안 구역 · 대학생', ability: '생명력을 빛으로 나눠 동료를 회복시킨다', note: '휴대전화로 노선도를 자주 확인한다.' },
    skills: [
      { name: '응급 처치', kind: '기본', desc: '체력이 가장 낮은 아군을 회복한다.' },
      { name: '환승 신호', kind: '스킬', desc: '아군 하나의 스킬 대기시간을 줄인다.' },
      { name: '첫차', kind: '궁극기', desc: '아군 전체를 크게 회복하고 해로운 효과를 해제한다.' },
    ],
    baseStats: { hp: 19550, atk: 1742, def: 1644 },
    subStats: { critRate: 5, critDmg: 120, speed: 104 },
    en: { unit: 'JUAN DISTRICT', motto: "NEXT TRAIN IN THREE MINUTES.|THAT'S ENOUGH." },
    assets: a('doyun'),
    formation: { scale: 1.04, offsetX: 0, offsetY: 0, faceY: 0.06 },
    lobby: { entrance: 'heal', idle: 'breath' },
    idleSeed: 0.8,
  },
  {
    id: 'rion', name: '샤오랑', nameEn: 'XIAOLANG', role: 'attack', attribute: 'sound', rarity: 5, accent: '#c8f53b',
    tagline: '자, 어디까지 들리니?',
    profile: { affiliation: '해적 방송국 · 진행자', ability: '음파를 칼날처럼 다듬어 멀리까지 보낸다', note: '방송 중엔 절대 헤드폰을 벗지 않는다.' },
    skills: [
      { name: '하울링', kind: '기본', desc: '직선 위의 적에게 음파 피해를 준다.' },
      { name: '온 에어', kind: '스킬', desc: '아군 전체 공격력을 잠시 올린다.' },
      { name: '주파수 너머', kind: '궁극기', desc: '전장 전체에 음파 폭발을 일으킨다.' },
    ],
    baseStats: { hp: 17340, atk: 3278, def: 1142 },
    subStats: { critRate: 18, critDmg: 145, speed: 115 },
    en: { unit: 'PIRATE BROADCAST', motto: 'HOW FAR|CAN YOU HEAR?' },
    assets: a('rion'),
    formation: { scale: 0.97, offsetX: 0, offsetY: 0, faceY: 0.07 },
    lobby: { entrance: 'wave', idle: 'sway' },
    idleSeed: 0.2,
  },
  // ── 신규 추가 패키지(2026-10-12, Ability-Kingdom-Character-Additions): 설정 미확정 ──
  // 원본 참고 이미지 8장 = 4명. 그림(배경 제거본)만 확정이고 이름(뒤의 둘)·역할·희귀도·수치·스킬·획득 경로는 미정.
  // 아래 role/attribute/rarity/수치는 형식용 자리값이며 화면에 표시하지 않는다(pending).
  ...([
    { id: 'baekrin', name: '백린', nameEn: 'BAEKRIN', accent: '#ff7a2e' },
    { id: 'kiyomi', name: '키요미', nameEn: 'KIYOMI', accent: '#4aa8ff' },
    { id: 'swordswoman', name: 'P', nameEn: 'P', accent: '#e0263c' },
    { id: 'kimono', name: '연', nameEn: 'YEON', accent: '#e9e4da' },
    { id: 'senka', name: '센카', nameEn: 'SENKA', accent: '#c5a8ee' },
    { id: 'mayu', name: '마유', nameEn: 'MAYU', accent: '#68cfe8' },
  ] as const).map((x, i): CharacterDefinition => ({
    ...x, role: 'attack', attribute: 'blade', rarity: 0,
    tagline: '설정 확정 전입니다.',
    profile: { affiliation: '미정', ability: '미정', note: '능력·소속·스킬은 아직 정해지지 않았습니다.' },
    skills: [],
    baseStats: { hp: 0, atk: 0, def: 0 },
    subStats: { critRate: 0, critDmg: 0, speed: 0 },
    en: { unit: 'PROFILE PENDING', motto: 'SETTINGS ARE NOT|CONFIRMED YET.' },
    assets: x.id === 'senka' || x.id === 'mayu'
      ? { portrait: x.id === 'senka' ? 'ref/pass/hero.webp' : 'ref/pass/summer/base.webp', stand: x.id === 'senka' ? 'ref/pass/hero.webp' : 'ref/pass/summer/base.webp', action: x.id === 'senka' ? 'ref/pass/hero.webp' : 'ref/pass/summer/base.webp' }
      : a(x.id),
    formation: { scale: 1.0, offsetX: 0, offsetY: 0, faceY: 0.07 },
    lobby: { entrance: 'slash', idle: 'breath' },
    idleSeed: 0.2 + i * 0.17,
    pending: true,
  })),
  // ── 영입 배너 3종(2026-10-13 시안: SERENITY·NIGHT SHIFT·ONE MORE PLAY?)의 픽업 대원: 이름·5성만 시안 표기, 나머지는 미정 ──
  // 그림은 배너 시안에서 따낸 반신(배너 아래 바에 가려진 아래쪽은 없음). 역할·수치·스킬은 자리값이며 화면에 표시하지 않는다(pending).
  ...([
    { id: 'seren', name: '세렌', nameEn: 'SEREN', accent: '#9fb3e6', idleSeed: 0.31 },
    { id: 'ian', name: '이안', nameEn: 'IAN', accent: '#f0782f', idleSeed: 0.57 },
    { id: 'chaerin', name: '칸나', nameEn: 'KANNA', accent: '#ef5a45', idleSeed: 0.83 },
  ] as const).map(({ idleSeed, ...x }): CharacterDefinition => ({
    ...x, role: 'attack', attribute: 'blade', rarity: 5,
    tagline: '설정 확정 전입니다.',
    profile: { affiliation: '미정', ability: '미정', note: '영입 배너 픽업 대원. 이름·등급(5성)만 정해졌고 능력·소속은 아직 정해지지 않았습니다.' },
    skills: [],
    baseStats: { hp: 0, atk: 0, def: 0 },
    subStats: { critRate: 0, critDmg: 0, speed: 0 },
    en: { unit: 'PROFILE PENDING', motto: 'SETTINGS ARE NOT|CONFIRMED YET.' },
    assets: a(x.id),
    formation: { scale: 1.0, offsetX: 0, offsetY: 0, faceY: 0.07 },
    lobby: { entrance: 'slash', idle: 'breath' },
    idleSeed,
    pending: true,
  })),
]

export const CHAR_BY_ID: Record<string, CharacterDefinition> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]))
