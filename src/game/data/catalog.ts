import type { ItemDefinition, RecruitmentBanner, ShopProduct, MissionDefinition, Reward } from '../types'

// ───────── 아이템(샘플) ─────────
export const ITEMS: ItemDefinition[] = [
  { id: 'exp_s', name: '훈련 기록 칩 · 소', category: 'material', desc: '캐릭터 경험치 100.', icon: 'chip', rarity: 2, expValue: 100 },
  { id: 'exp_m', name: '훈련 기록 칩 · 중', category: 'material', desc: '캐릭터 경험치 400.', icon: 'chip', rarity: 3, expValue: 400 },
  { id: 'exp_l', name: '훈련 기록 칩 · 대', category: 'material', desc: '캐릭터 경험치 1,200.', icon: 'chip', rarity: 4, expValue: 1200 },
  { id: 'part', name: '강화 부품', category: 'material', desc: '장비 강화에 쓰는 부품. 강화 시스템은 미정.', icon: 'gear', rarity: 2 },
  { id: 'eq_blade', name: '접이식 단도', category: 'equipment', desc: '공격력 +42', icon: 'weapon', rarity: 3, equipSlot: 'weapon', bonus: { atk: 42 } },
  { id: 'eq_baton', name: '경량 진압봉', category: 'equipment', desc: '공격력 +28 · 방어력 +12', icon: 'weapon', rarity: 3, equipSlot: 'weapon', bonus: { atk: 28, def: 12 } },
  { id: 'eq_jacket', name: '방검 바람막이', category: 'equipment', desc: '체력 +180 · 방어력 +20', icon: 'gear', rarity: 3, equipSlot: 'gear', bonus: { hp: 180, def: 20 } },
  { id: 'eq_vest', name: '전술 조끼', category: 'equipment', desc: '체력 +260', icon: 'gear', rarity: 4, equipSlot: 'gear', bonus: { hp: 260 } },
  { id: 'eq_phones', name: '노이즈캔슬 헤드폰', category: 'equipment', desc: '공격력 +18 · 체력 +80', icon: 'acc', rarity: 4, equipSlot: 'accessory', bonus: { atk: 18, hp: 80 } },
  { id: 'eq_card', name: '정기 승차권', category: 'equipment', desc: '방어력 +16', icon: 'acc', rarity: 2, equipSlot: 'accessory', bonus: { def: 16 } },
  { id: 'box_dia', name: '다이아 상자', category: 'consumable', desc: '열면 다이아 300을 얻는다.', icon: 'box', rarity: 3, use: { grant: { diamond: 300 } } },
  { id: 'drink', name: '에너지 드링크', category: 'consumable', desc: '행동력 30을 회복한다.', icon: 'drink', rarity: 2, use: { grant: { stamina: 30 } } },
]
export const ITEM_BY_ID: Record<string, ItemDefinition> = Object.fromEntries(ITEMS.map((i) => [i.id, i]))

// ───────── 영입 배너(샘플) ─────────
// 확률·비용·천장·포인트는 미정. 아래 값은 화면 검증용 샘플이다.
const SAMPLE_RATES = [
  { rarity: 5, rate: 0.03 },
  { rarity: 4, rate: 0.17 },
  { rarity: 3, rate: 0.8 },
]
// 상시 영입 대원(한정 픽업 라온·이안 제외)
const STANDARD_POOL = ['doyun', 'baekrin', 'kiyomi', 'kimono', 'mayu', 'swordswoman', 'senka', 'seren', 'chaerin']
export const BANNERS: RecruitmentBanner[] = [
  {
    id: 'b_rion', kind: 'limited', title: '주파수 너머', subtitle: 'PIRATE SCOUTING BROADCAST', featuredId: 'rion',
    pool: [...STANDARD_POOL, 'rion'],
    start: '2026-10-08', end: '2026-10-29', costPerPull: { currency: 'ticket', amount: 1 }, rates: SAMPLE_RATES, pickupShare: 0.5,
    skin: 'broadcast', quote: '자, 어디까지 들리니? 지금, 더 멀리 가보자.',
  },
  // 아래 3개는 2026-10-13 배너 시안(SERENITY·NIGHT SHIFT·ONE MORE PLAY?). 목록 순서도 시안과 같다.
  // 영입 풀: 상시 대원 9명(아래 STANDARD_POOL) + 한정 배너는 픽업 대원. 픽업 확률 비중은 샘플 값.
  // 비용은 기존 영입 티켓 1장/회. 시안의 캡슐·추첨권·쿠지 그림은 배너별 표시용이다(재화 분리는 미정).
  {
    id: 'b_serenity', kind: 'standard', title: 'SERENITY', subtitle: 'STANDARD SCOUTING', featuredId: 'seren',
    pool: STANDARD_POOL,
    start: '2026-10-13', end: null, costPerPull: { currency: 'ticket', amount: 1 }, rates: SAMPLE_RATES, pickupShare: 0.5,
    skin: 'scene', quote: '',
  },
  {
    id: 'b_nightshift', kind: 'limited', title: 'NIGHT SHIFT', subtitle: 'LIMITED SCOUTING', featuredId: 'ian',
    pool: [...STANDARD_POOL, 'ian'],
    start: '2026-10-13', end: '2026-11-03', costPerPull: { currency: 'ticket', amount: 1 }, rates: SAMPLE_RATES, pickupShare: 0.5,
    skin: 'scene', quote: '',
  },
  {
    id: 'b_omp', kind: 'standard', title: 'ONE MORE PLAY?', subtitle: 'STANDARD SCOUTING', featuredId: 'chaerin',
    pool: STANDARD_POOL,
    start: '2026-10-13', end: null, costPerPull: { currency: 'ticket', amount: 1 }, rates: SAMPLE_RATES, pickupShare: 0.5,
    skin: 'scene', quote: '',
  },
]
export const BANNER_BY_ID: Record<string, RecruitmentBanner> = Object.fromEntries(BANNERS.map((b) => [b.id, b]))

// ───────── 상점 상품(샘플) ─────────
export const PRODUCTS: ShopProduct[] = [
  { id: 'p_ticket1', tab: 'recommend', name: '영입 티켓', desc: '영입 1회에 사용', contents: [{ kind: 'currency', id: 'ticket', qty: 1 }], price: { type: 'currency', currency: 'diamond', amount: 160 }, limit: null, endsAt: null },
  { id: 'p_ticket10', tab: 'recommend', name: '영입 티켓 ×10', desc: '영입 10회분', contents: [{ kind: 'currency', id: 'ticket', qty: 10 }], price: { type: 'currency', currency: 'diamond', amount: 1600 }, limit: null, endsAt: null, badge: '추천' },
  { id: 'p_daily', tab: 'recommend', name: '오늘의 보급', desc: '매일 1회 (일일 초기화는 미구현)', contents: [{ kind: 'item', id: 'exp_m', qty: 3 }, { kind: 'currency', id: 'credit', qty: 5000 }], price: { type: 'currency', currency: 'diamond', amount: 50 }, limit: 1, endsAt: null, badge: '한정 1회' },
  { id: 'pk_start', tab: 'package', name: '스타터 패키지', desc: '다이아·티켓·성장 재료 구성', contents: [{ kind: 'currency', id: 'diamond', qty: 1200 }, { kind: 'currency', id: 'ticket', qty: 5 }, { kind: 'item', id: 'exp_l', qty: 5 }], price: { type: 'real', krw: 5900 }, limit: 1, endsAt: '2026-11-30', badge: '1회' },
  { id: 'pk_month', tab: 'package', name: '월간 통근 패스', desc: '30일간 매일 다이아 지급 (일일 지급 로직 미구현)', contents: [{ kind: 'currency', id: 'diamond', qty: 300 }], price: { type: 'real', krw: 6600 }, limit: 1, endsAt: null },
  { id: 'pk_rion', tab: 'package', name: '온 에어 패키지', desc: '픽업 기간 한정', contents: [{ kind: 'currency', id: 'ticket', qty: 10 }, { kind: 'item', id: 'eq_phones', qty: 1 }], price: { type: 'real', krw: 33000 }, limit: 2, endsAt: '2026-10-29', badge: '기간 한정' },
  { id: 'c_dia_s', tab: 'currency', name: '다이아 600', desc: '', contents: [{ kind: 'currency', id: 'diamond', qty: 600 }], price: { type: 'real', krw: 12000 }, limit: null, endsAt: null },
  { id: 'c_dia_l', tab: 'currency', name: '다이아 3,280', desc: '', contents: [{ kind: 'currency', id: 'diamond', qty: 3280 }], price: { type: 'real', krw: 59000 }, limit: null, endsAt: null },
  { id: 'c_credit', tab: 'currency', name: '크레딧 20,000', desc: '다이아로 교환', contents: [{ kind: 'currency', id: 'credit', qty: 20000 }], price: { type: 'currency', currency: 'diamond', amount: 100 }, limit: 5, endsAt: null },
  { id: 'c_stamina', tab: 'currency', name: '행동력 60', desc: '다이아로 회복', contents: [{ kind: 'currency', id: 'stamina', qty: 60 }], price: { type: 'currency', currency: 'diamond', amount: 50 }, limit: 3, endsAt: null },
  { id: 'x_pick', tab: 'exchange', name: '픽업 캐릭터 · 라온', desc: '영입 포인트 200으로 교환', contents: [{ kind: 'item', id: 'char:rion', qty: 1 }], price: { type: 'currency', currency: 'scoutPoint', amount: 200 }, limit: 1, endsAt: '2026-10-29', badge: '교환소' },
  { id: 'x_ticket', tab: 'exchange', name: '영입 티켓', desc: '교환 메달 사용', contents: [{ kind: 'currency', id: 'ticket', qty: 1 }], price: { type: 'currency', currency: 'exchangeMedal', amount: 30 }, limit: 10, endsAt: null },
  { id: 'x_vest', tab: 'exchange', name: '전술 조끼', desc: '교환 메달 사용', contents: [{ kind: 'item', id: 'eq_vest', qty: 1 }], price: { type: 'currency', currency: 'exchangeMedal', amount: 60 }, limit: 1, endsAt: null },
]
export const PRODUCT_BY_ID: Record<string, ShopProduct> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]))

// ───────── 여섯 콘텐츠(초안) ─────────
export interface StageDef {
  id: string
  name: string
  desc: string
  enemy: { name: string; power: number; trait: string }
  staminaCost: number
  rewards: Reward[]
  bg: string
}

export const STORY_CHAPTERS = [
  {
    id: 'ch1', name: '1장 · 끊어진 신호', desc: '성수 구역의 통신망이 한꺼번에 끊겼다.',
    stages: [
      { id: '1-1', name: '2호선 지연', desc: '열차가 멈춘 플랫폼에서 괴이가 목격됐다.', enemy: { name: '그림자 승객', power: 3200, trait: '무리 지어 움직인다' }, staminaCost: 6, rewards: [{ kind: 'currency', id: 'credit', qty: 1200 }, { kind: 'item', id: 'exp_s', qty: 3 }], bg: 'story' },
      { id: '1-2', name: '역 출구 4번', desc: '출구 계단이 끝없이 이어진다.', enemy: { name: '무한 계단', power: 4100, trait: '이동을 방해한다' }, staminaCost: 6, rewards: [{ kind: 'currency', id: 'credit', qty: 1400 }, { kind: 'item', id: 'exp_s', qty: 4 }], bg: 'story' },
      { id: '1-3', name: '고가 아래', desc: '능력자 하나가 무언가를 쫓고 있다.', enemy: { name: '잔향', power: 5200, trait: '공격을 반사한다' }, staminaCost: 8, rewards: [{ kind: 'currency', id: 'diamond', qty: 50 }, { kind: 'item', id: 'exp_m', qty: 2 }], bg: 'story' },
    ] as StageDef[],
  },
  {
    id: 'ch2', name: '2장 · 같은 도시, 다른 사람', desc: '부평 구역의 공연장에 초대장이 도착했다.',
    stages: [
      { id: '2-1', name: '리허설', desc: '무대 위 조명이 혼자 움직인다.', enemy: { name: '조명 괴이', power: 6400, trait: '시야를 가린다' }, staminaCost: 8, rewards: [{ kind: 'currency', id: 'credit', qty: 2000 }, { kind: 'item', id: 'exp_m', qty: 2 }], bg: 'story' },
      { id: '2-2', name: '앙코르 금지', desc: '관객이 모두 사라졌다.', enemy: { name: '빈 객석', power: 7600, trait: '체력이 높다' }, staminaCost: 10, rewards: [{ kind: 'currency', id: 'diamond', qty: 80 }, { kind: 'item', id: 'exp_m', qty: 3 }], bg: 'story' },
    ] as StageDef[],
  },
]

export const DISTRICTS = [
  { id: 'seongsu', name: '성수 구역', x: 0.66, y: 0.42, desc: '공장을 개조한 카페와 작업실이 모인 동네.', incidents: [
    { id: 'd-ss-1', name: '골목의 낙서가 움직인다', desc: '벽화 속 인물이 밤마다 자리를 옮긴다는 제보.', enemy: { name: '움직이는 벽화', power: 3600, trait: '분신을 만든다' }, staminaCost: 5, rewards: [{ kind: 'currency', id: 'credit', qty: 1500 }, { kind: 'item', id: 'part', qty: 2 }], bg: 'story' },
    { id: 'd-ss-2', name: '분실물 센터의 소리', desc: '잃어버린 이어폰에서 누군가 말을 건다.', enemy: { name: '목소리', power: 4200, trait: '혼란을 건다' }, staminaCost: 5, rewards: [{ kind: 'currency', id: 'credit', qty: 1700 }, { kind: 'item', id: 'exp_s', qty: 4 }], bg: 'story' },
  ] as StageDef[] },
  { id: 'gangnam', name: '강남 구역', x: 0.52, y: 0.64, desc: '빌딩 숲과 대형 전광판의 거리.', incidents: [
    { id: 'd-gn-1', name: '꺼지지 않는 전광판', desc: '새벽 4시에도 광고가 같은 문장을 반복한다.', enemy: { name: '광고 정령', power: 5600, trait: '빛으로 공격한다' }, staminaCost: 6, rewards: [{ kind: 'currency', id: 'diamond', qty: 30 }, { kind: 'item', id: 'part', qty: 3 }], bg: 'story' },
  ] as StageDef[] },
  { id: 'bupyeong', name: '부평 구역', x: 0.24, y: 0.36, desc: '지하상가와 공연장이 이어진 구역.', incidents: [
    { id: 'd-bp-1', name: '지하상가 미로', desc: '같은 매장 앞을 세 번째 지나가고 있다.', enemy: { name: '미로 주인', power: 4800, trait: '길을 바꾼다' }, staminaCost: 6, rewards: [{ kind: 'currency', id: 'credit', qty: 2200 }, { kind: 'item', id: 'exp_m', qty: 1 }], bg: 'story' },
  ] as StageDef[] },
  { id: 'juan', name: '주안 구역', x: 0.3, y: 0.7, desc: '대학가와 오래된 주택가가 섞인 언덕.', incidents: [
    { id: 'd-ja-1', name: '도서관 7층', desc: '존재하지 않는 층의 열람실 불이 켜져 있다.', enemy: { name: '사서', power: 5200, trait: '스킬을 봉인한다' }, staminaCost: 6, rewards: [{ kind: 'currency', id: 'credit', qty: 2000 }, { kind: 'item', id: 'exp_m', qty: 2 }], bg: 'story' },
  ] as StageDef[] },
]

export const WANTED = [
  { id: 'w1', name: '레드 라인', grade: 'B', desc: '심야 버스 노선을 따라 나타나는 괴이.', enemy: { name: '레드 라인', power: 6000, trait: '빠르게 이동한다' }, staminaCost: 10, rewards: [{ kind: 'currency', id: 'exchangeMedal', qty: 10 }, { kind: 'currency', id: 'credit', qty: 3000 }], bg: 'wanted' },
  { id: 'w2', name: '검은 우산', grade: 'A', desc: '비 오는 날에만 목격되는 능력자 사냥꾼.', enemy: { name: '검은 우산', power: 8200, trait: '원거리 공격을 막는다' }, staminaCost: 12, rewards: [{ kind: 'currency', id: 'exchangeMedal', qty: 20 }, { kind: 'item', id: 'eq_blade', qty: 1 }], bg: 'wanted' },
  { id: 'w3', name: '스크린도어', grade: 'C', desc: '열리지 않는 스크린도어 너머의 무언가.', enemy: { name: '스크린도어', power: 4200, trait: '방어력이 높다' }, staminaCost: 8, rewards: [{ kind: 'currency', id: 'exchangeMedal', qty: 6 }, { kind: 'item', id: 'part', qty: 3 }], bg: 'wanted' },
  { id: 'w4', name: '자판기 왕', grade: 'S', desc: '도시 전역 자판기를 점령한 괴이의 우두머리.', enemy: { name: '자판기 왕', power: 11000, trait: '아이템을 훔친다' }, staminaCost: 15, rewards: [{ kind: 'currency', id: 'exchangeMedal', qty: 35 }, { kind: 'currency', id: 'diamond', qty: 100 }], bg: 'wanted' },
]

export const TRAININGS = [
  { id: 't_exp', name: '기초 체력 훈련', reward: '경험치 재료', levels: [
    { id: 't_exp_1', name: '초급', desc: '', enemy: { name: '훈련용 더미', power: 2000, trait: '반격하지 않는다' }, staminaCost: 10, rewards: [{ kind: 'item', id: 'exp_m', qty: 3 }], bg: 'training' },
    { id: 't_exp_2', name: '중급', desc: '', enemy: { name: '훈련용 더미 Mk.2', power: 5000, trait: '가끔 반격한다' }, staminaCost: 15, rewards: [{ kind: 'item', id: 'exp_l', qty: 2 }], bg: 'training' },
  ] as StageDef[] },
  { id: 't_credit', name: '현장 실습', reward: '크레딧', levels: [
    { id: 't_cr_1', name: '초급', desc: '', enemy: { name: '모의 괴이', power: 2400, trait: '' }, staminaCost: 10, rewards: [{ kind: 'currency', id: 'credit', qty: 6000 }], bg: 'training' },
    { id: 't_cr_2', name: '중급', desc: '', enemy: { name: '모의 괴이 Mk.2', power: 5400, trait: '' }, staminaCost: 15, rewards: [{ kind: 'currency', id: 'credit', qty: 12000 }], bg: 'training' },
  ] as StageDef[] },
  { id: 't_gear', name: '장비 점검', reward: '강화 부품', levels: [
    { id: 't_gr_1', name: '초급', desc: '', enemy: { name: '정비 로봇', power: 2600, trait: '' }, staminaCost: 10, rewards: [{ kind: 'item', id: 'part', qty: 5 }], bg: 'training' },
  ] as StageDef[] },
]

export const ARENA_OPPONENTS = [
  { id: 'op1', name: '새벽첫차', level: 34, power: 21800, team: ['senka', 'kimono', 'swordswoman', 'baekrin'] },
  { id: 'op2', name: '성수동고양이', level: 31, power: 19400, team: ['chaerin', 'mayu', 'kiyomi', 'doyun'] },
  { id: 'op3', name: '막차는싫어', level: 38, power: 26100, team: ['ian', 'seren', 'rion', 'mayu'] },
]

export const RAIDS = [
  { id: 'r_bridge', name: '강 위의 그림자', desc: '대교 아래에서 솟아오른 거대 괴이. 도시 전체의 능력자가 소집됐다.', levels: [
    { id: 'r_b_n', name: '보통', desc: '', enemy: { name: '강 위의 그림자', power: 9000, trait: '광역 공격 · 보호막 재생' }, staminaCost: 20, rewards: [{ kind: 'currency', id: 'diamond', qty: 120 }, { kind: 'item', id: 'eq_vest', qty: 1 }], bg: 'raid' },
    { id: 'r_b_h', name: '어려움', desc: '', enemy: { name: '강 위의 그림자 · 폭주', power: 15000, trait: '광역 공격 · 보호막 재생 · 분노' }, staminaCost: 25, rewards: [{ kind: 'currency', id: 'diamond', qty: 250 }, { kind: 'item', id: 'exp_l', qty: 4 }], bg: 'raid' },
  ] as StageDef[] },
]

// ───────── 운영(샘플) ─────────
export const NOTICES = [
  { id: 'n1', date: '2026-10-11', tag: '안내', title: '프로토타입 빌드 안내', body: '이 빌드는 메뉴·편성·성장 흐름 검증용입니다. 전투, 확률, 가격, 결제는 확정되지 않은 샘플이며, 모든 데이터는 이 기기 브라우저에만 저장됩니다.' },
  { id: 'n2', date: '2026-10-08', tag: '영입', title: '한정 영입 「주파수 너머」 오픈', body: '해적 방송국 진행자 라온이 픽업됩니다. 확률과 기간은 샘플 값입니다.' },
  { id: 'n3', date: '2026-10-01', tag: '점검', title: '정기 점검 안내(샘플)', body: '서버 연동 이후 점검 공지가 이 영역에 표시됩니다.' },
]

export const EVENTS = [
  { id: 'e_rion', title: '주파수 너머', period: '10.08 – 10.29', desc: '한정 영입 기간. 영입 포인트 200으로 라온을 교환할 수 있습니다(샘플).', link: { screen: 'recruit', params: { bannerId: 'b_rion' } }, accent: '#c8f53b', image: 'assets/chars/rion_action.webp' },
  { id: 'e_attend', title: '출석 체크', period: '상시', desc: '7일 출석 보상을 받을 수 있습니다.', link: { screen: 'attendance', params: {} }, accent: '#2ee6d6', image: 'assets/chars/mayu_action.webp' },
  { id: 'e_raid', title: '강 위의 그림자', period: '10.11 – 10.25', desc: '레이드 보스가 출현했습니다. 참가 방식은 미정입니다.', link: { screen: 'raid', params: {} }, accent: '#a97bff', image: 'assets/chars/senka_action.webp' },
]

export const MISSIONS: MissionDefinition[] = [
  { id: 'm_login', title: '접속하기', metric: 'login', target: 1, rewards: [{ kind: 'currency', id: 'diamond', qty: 20 }], period: 'daily' },
  { id: 'm_save', title: '편성 저장 1회', metric: 'saveTeam', target: 1, rewards: [{ kind: 'currency', id: 'credit', qty: 2000 }], period: 'daily' },
  { id: 'm_win', title: '전투 승리 3회', metric: 'battleWin', target: 3, rewards: [{ kind: 'item', id: 'exp_m', qty: 2 }], period: 'daily' },
  { id: 'm_recruit', title: '영입 1회', metric: 'recruit', target: 1, rewards: [{ kind: 'currency', id: 'diamond', qty: 40 }], period: 'daily' },
  { id: 'm_buy', title: '상점에서 구매 1회', metric: 'purchase', target: 1, rewards: [{ kind: 'currency', id: 'credit', qty: 3000 }], period: 'daily' },
  { id: 'm_level', title: '캐릭터 레벨업 1회', metric: 'levelUp', target: 1, rewards: [{ kind: 'currency', id: 'ticket', qty: 1 }], period: 'daily' },
]

export const ATTENDANCE_REWARDS: Reward[] = [
  { kind: 'currency', id: 'diamond', qty: 100 },
  { kind: 'currency', id: 'credit', qty: 5000 },
  { kind: 'item', id: 'exp_m', qty: 3 },
  { kind: 'currency', id: 'ticket', qty: 1 },
  { kind: 'item', id: 'drink', qty: 2 },
  { kind: 'currency', id: 'diamond', qty: 200 },
  { kind: 'currency', id: 'ticket', qty: 3 },
]
