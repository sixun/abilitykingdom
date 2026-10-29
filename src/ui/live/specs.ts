// 로비 버튼별 움직임. 좌표는 원본 조각(1배) 기준, 부위 윤곽은 live-parts.json(tools/build_live_parts.py).
// 박자 b: 0→1 진행(박자 밖이면 -1). t: 초. alert: 알림 있음.
// 원칙: 광택(빛 훑기)으로 때우지 않고 그림 속 물건이 실제로 움직이게 한다. glints 기능은 남겨 두지만 역 로비에선 쓰지 않음.
// 층위: 핵심(메인 목표 화살표·도시 탐색 핀·스토리 건물)은 늘 움직이고, 공지·우편·메뉴는 알림이 있을 때만,
//       나머지는 몇 초에 한 번 짧게(버튼마다 엇갈림). 누르거나 마우스를 올리면 모두 바로 크게 한 번.
export type Xf = { dx?: number; dy?: number; rot?: number; sx?: number; sy?: number; ox?: number; oy?: number }
export type MaskSpec = { crit: 'bright' | 'alpha' | 'blue' | 'orange' | 'warm'; rect?: [number, number, number, number]; notCircle?: [number, number, number] }
export type Glint = {
  mask: MaskSpec
  mode?: 'sweep' | 'down' | 'orbit' | 'pulse'
  when?: 'beat' | 'cycle' // beat = 박자에 맞춰, cycle = 혼자 주기적으로(cycle초마다 dur초 동안)
  cycle?: number; dur?: number; phase?: number
  cx?: number; cy?: number; width?: number; strength?: number; color?: string
  glow?: number; glowColor?: string // 번짐 반경(px)·색
}
// ox·oy를 비우면 부위 윤곽 상자의 가운데(pivot: 'bottom'이면 아래 가운데)를 축으로 쓴다
export type PartAnim = { at: (b: number, t: number, alert: boolean) => Xf; fill?: number[] | null; circle?: [number, number, number]; pivot?: 'center' | 'bottom' | 'top'; exact?: boolean }
// exact: 정확한 각도(90°·한 바퀴)로 끝나야 하는 움직임 → 눌렀을 때도 크기를 키우지 않는다(끝에서 툭 튀는 것 방지)
export type LiveSpec = {
  beat: number // 한 박자 길이(초)
  offset: number // 버튼마다 엇갈리는 시작
  period?: number // 평소 박자 간격(없으면 평소엔 가만히)
  alertPeriod?: number // 알림 있을 때 박자 간격
  parts?: Record<string, PartAnim>
  parent?: Record<string, string> // 자식 부위 → 부모 부위(함께 움직임)
  glints?: Glint[]
  badge?: [number, number, number] // 알림 표시 원(cx, cy, r): 표시 있는 원본에서 이 원만 얹는다
}

export const hop = (b: number, s = 0, e = 1) => (b < s || b > e ? 0 : Math.sin(((b - s) / (e - s)) * Math.PI))
export const ease = (b: number, s = 0, e = 1) => (b <= s ? 0 : b >= e ? 1 : (1 - Math.cos(((b - s) / (e - s)) * Math.PI)) / 2)
/** 흔들리다 잦아드는 진동(종·옷걸이·달력 알람) */
const ring = (b: number, n: number) => (b < 0 || b > 1 ? 0 : Math.sin(b * Math.PI * n) * (1 - b) ** 1.4)
const r3 = (v: number) => Math.round(v * 1000) / 1000
const I = 7.5 // 평소 박자 간격(하단 메뉴와 같음)

export const LIVE: Record<string, LiveSpec> = {
  // ── 상단 ──
  // 프로필: 따로 움직이지 않음(사진·이름·레벨은 정보 표시라 가만히 둔다)
  profile: { beat: 1, offset: 0 },
  // 다이아: 보석이 살짝 떠올라 기울었다 내려앉음
  'currency-gems': {
    beat: 1.1, offset: 1.9, period: 6,
    parts: { gem: { at: (b) => ({ dy: r3(-2 * hop(b)), rot: r3(0.06 * hop(b)), ox: 39, oy: 30 }) } },
  },
  // 크레딧: 카드가 한 바퀴 뒤집힘
  'currency-coins': {
    beat: 1.0, offset: 4.6, period: 7,
    parts: { card: { exact: true, at: (b) => ({ sx: r3(Math.cos(ease(b) * Math.PI * 2)) }) } },
  },

  // 공지: 알림이 있으면 종이 딸랑 흔들림
  notice: {
    beat: 1.0, offset: 0, alertPeriod: 3.2, badge: [51, 20, 10],
    parts: { bell: { at: (b) => ({ rot: r3(0.38 * ring(b, 5)), ox: 37, oy: 15 }) } },
  },
  // 우편: 알림이 있으면 봉투가 폴짝 들썩
  mail: {
    beat: 0.8, offset: 1.1, alertPeriod: 3.4,
    parts: { env: { at: (b) => ({ dy: r3(-5 * hop(b, 0, 0.6) + 1 * hop(b, 0.6, 1)), rot: r3(0.1 * ring(b, 3)), sy: r3(1 - 0.06 * hop(b, 0.6, 0.9)), ox: 28, oy: 48 }) } },
  },
  // 전체 메뉴: 알림이 있으면 네 칸이 차례로 톡톡
  menu: {
    beat: 1.0, offset: 2.0, alertPeriod: 3.0, badge: [47, 18, 10],
    parts: Object.fromEntries([[19, 24], [38, 24], [19, 42], [38, 42]].map(([ox, oy], i) => [`t${i}`, {
      at: (b: number) => { const k = hop(b, i * 0.14, i * 0.14 + 0.45); return { sx: r3(1 + 0.16 * k), sy: r3(1 + 0.16 * k), ox, oy } },
    }])),
  },
  // ── 왼쪽 ──
  // 메시지: 말풍선이 폴짝 + 가끔 눈 깜빡
  messages: {
    beat: 0.8, offset: 0.3, period: I,
    parts: {
      icon: { at: (b) => ({ dy: r3(-5 * hop(b, 0, 0.6)), sx: r3(1 + 0.04 * hop(b, 0.6, 0.9)), sy: r3(1 - 0.05 * hop(b, 0.6, 0.9)), ox: 41, oy: 62 }) },
      eyes: { at: (b, t) => { const k = (t % 3.7) < 0.16 ? hop((t % 3.7) / 0.16) : hop(b, 0.15, 0.4); return { sy: r3(1 - 0.85 * k), ox: 40, oy: 29 } } },
    },
    parent: { eyes: 'icon' },
  },
  // 이벤트 달력: 알람처럼 부르르(알림 있으면 자주)
  events: {
    beat: 0.9, offset: 1.4, period: I, alertPeriod: 3.0, badge: [77, 13, 10],
    parts: { cal: { at: (b) => ({ rot: r3(0.11 * ring(b, 7)), dy: r3(-2 * hop(b)), ox: 46, oy: 40 }) } },
  },
  // 쿠폰: 티켓이 팔랑
  coupon: {
    beat: 0.9, offset: 2.2, period: I,
    parts: { tix: { at: (b) => ({ rot: r3(-0.14 * ring(b, 3)), sx: r3(1 + 0.06 * hop(b)), sy: r3(1 + 0.06 * hop(b)), ox: 45, oy: 32 }) } },
  },
  // 코스튬: 옷걸이가 고리에 매달려 흔들
  costume: {
    beat: 1.3, offset: 3.0, period: I,
    parts: { hanger: { at: (b) => ({ rot: r3(0.26 * ring(b, 4)), ox: 44, oy: 21 }) } },
  },
  // 현상수배: 조준경이 90도 돌며 조여짐
  wanted: {
    beat: 1.0, offset: 3.7, period: I,
    parts: { scope: { exact: true, at: (b) => ({ rot: r3(ease(b, 0, 0.8) * Math.PI / 2), sx: r3(1 - 0.12 * hop(b)), sy: r3(1 - 0.12 * hop(b)), ox: 39, oy: 47 }) } },
  },
  // 상점: 가판대가 폴짝
  shop: {
    beat: 0.8, offset: 4.4, period: I,
    parts: { stall: { at: (b) => ({ dy: r3(-5 * hop(b, 0, 0.6)), sy: r3(1 - 0.06 * hop(b, 0.6, 0.9)), ox: 55, oy: 126 }) } },
  },
  // 훈련: 운동기구를 들어 올림
  training: {
    beat: 0.9, offset: 5.1, period: I,
    parts: { gear: { at: (b) => ({ dy: r3(-6 * hop(b, 0, 0.6) + 1.2 * hop(b, 0.6, 1)), ox: 72, oy: 98 }) } },
  },
  // ── 오른쪽 ──
  // 메인 목표: ! 표시가 숨 쉬듯 커졌다 작아지고, 화살표가 계속 오른쪽으로 톡톡(늘 움직이는 핵심)
  quest: {
    beat: 0.8, offset: 0.6, period: 2.8,
    parts: {
      mark: { at: (b) => ({ sx: r3(1 + 0.09 * hop(b)), sy: r3(1 + 0.09 * hop(b)), ox: 37, oy: 33 }) },
      arrow: { at: (_b, t) => ({ dx: r3(3.5 * hop((t * 0.85) % 1, 0, 0.45)), ox: 328, oy: 35 }) },
    },
  },
  // 출석: 새로고침 화살표가 한 바퀴
  attendance: {
    beat: 1.2, offset: 0.9, period: I,
    parts: { refresh: { exact: true, circle: [32, 47, 15], fill: null, at: (b) => ({ rot: r3(-ease(b, 0, 0.85) * Math.PI * 2), ox: 32, oy: 47 }) } },
  },
  // 아레나: 인물 카드가 폴짝
  arena: {
    beat: 0.8, offset: 4.8, period: I,
    parts: { card: { at: (b) => ({ dy: r3(-5 * hop(b, 0, 0.6)), sy: r3(1 - 0.05 * hop(b, 0.6, 0.9)), ox: 69, oy: 89 }) } },
  },
  // 레이드: 방패가 툭 앞으로 나오며 흔들
  raid: {
    beat: 0.9, offset: 5.6, period: I,
    parts: { shield: { at: (b) => ({ rot: r3(0.1 * ring(b, 3)), sx: r3(1 + 0.08 * hop(b, 0, 0.5)), sy: r3(1 + 0.08 * hop(b, 0, 0.5)), ox: 67, oy: 60 }) } },
  },
  // 도시 탐색: 위치 핀이 통통 튀며 내려앉음(늘 움직이는 핵심)
  exploration: {
    beat: 0.9, offset: 0, period: 2.4,
    parts: { pin: { at: (b) => ({ dy: r3(-8 * hop(b, 0, 0.55) + 1.2 * hop(b, 0.55, 0.75)), sx: r3(1 + 0.06 * hop(b, 0.55, 0.8)), sy: r3(1 - 0.08 * hop(b, 0.55, 0.8)), ox: 66, oy: 101 }) } },
  },
  // 스토리: 건물(책) 아이콘이 톡 커졌다 돌아옴(늘 움직이는 핵심)
  story: {
    beat: 0.8, offset: 1.6, period: 3.2,
    parts: { bldg: { pivot: 'bottom', at: (b) => ({ sx: r3(1 + 0.07 * hop(b)), sy: r3(1 + 0.09 * hop(b)) }) } },
  },

  // ───── 폐기(2026-10-29): 카페(소파) 로비 버튼. 카페 로비를 쓰지 않으므로 주석 처리 ─────
//   // ── 카페(소파) 로비 ──
//   // 뒤로: 누르면 화살표가 왼쪽으로 휙
//   'sofa:back': {
//     beat: 0.6, offset: 0,
//     parts: { arrow: { at: (b) => ({ dx: r3(-4 * hop(b)), rot: r3(-0.1 * ring(b, 2)) }) } },
//   },
//   // 행동력: 배터리가 들썩하며 번개가 번쩍
//   'sofa:stamina': {
//     beat: 0.9, offset: 0.8, period: 6.5,
//     parts: { bat: { pivot: 'bottom', at: (b) => ({ dy: r3(-2 * hop(b, 0, 0.6)), sy: r3(1 + 0.05 * hop(b, 0, 0.5)) }) } },
//     glints: [{ mask: { crit: 'warm', rect: [118, 0, 46, 50] }, mode: 'pulse', strength: 0.9, glow: 6, color: '255,240,150' }],
//   },
//   // 크레딧: 동전이 한 바퀴 뒤집힘
//   'sofa:currency-coins': {
//     beat: 1.0, offset: 2.5, period: 7,
//     parts: { coin: { exact: true, at: (b) => ({ sx: r3(Math.cos(ease(b) * Math.PI * 2)) }) } },
//   },
//   // 교환 메달: 살짝 떠오르며 반짝
//   'sofa:currency-gems': {
//     beat: 1.1, offset: 4.2, period: 7,
//     parts: { medal: { at: (b) => ({ dy: r3(-2 * hop(b)), rot: r3(0.07 * hop(b)) }) } },
//     glints: [{ mask: { crit: 'alpha', rect: [108, 0, 52, 50] }, width: 10 }],
//   },
//   // 로비 캐릭터 바꾸기: 양쪽 화살표가 바깥으로 휙 돌고 사람이 폴짝
//   'sofa:character-switch': {
//     beat: 1.0, offset: 1.7, period: I,
//     parts: {
//       person: { pivot: 'bottom', at: (b) => ({ dy: r3(-2.5 * hop(b, 0.2, 0.7)) }) },
//       al: { at: (b) => ({ dx: r3(-3 * hop(b)), rot: r3(-0.5 * hop(b)) }) },
//       ar: { at: (b) => ({ dx: r3(3 * hop(b)), rot: r3(0.5 * hop(b)) }) },
//     },
//   },
//   // 하단 메뉴 10개: 몇 초에 한 번 차례로(왼쪽→오른쪽 물결)
//   'sofa:nav-story': { beat: 0.9, offset: 0.0, period: I, parts: { book: { at: (b) => ({ sx: r3(1 - 0.3 * hop(b, 0, 0.5) + 0.06 * hop(b, 0.5, 1)) }) } } },
//   'sofa:nav-explore': { beat: 0.8, offset: 7.2, period: I, parts: { pin: { pivot: 'bottom', at: (b) => ({ dy: r3(-6 * hop(b, 0, 0.6)), sy: r3(1 - 0.08 * hop(b, 0.6, 0.85)) }) } } },
//   'sofa:nav-wanted': { beat: 0.9, offset: 6.9, period: I, parts: { scope: { exact: true, at: (b) => ({ rot: r3(ease(b, 0, 0.8) * Math.PI / 2), sx: r3(1 - 0.1 * hop(b)), sy: r3(1 - 0.1 * hop(b)) }) } } },
//   'sofa:nav-training': { beat: 0.8, offset: 6.6, period: I, parts: { bell: { at: (b) => ({ dy: r3(-5 * hop(b, 0, 0.6) + 1 * hop(b, 0.6, 1)) }) } } },
//   'sofa:nav-arena': { beat: 0.8, offset: 6.3, period: I, parts: { swords: { at: (b) => ({ rot: r3(0.14 * ring(b, 3)), sx: r3(1 + 0.08 * hop(b, 0, 0.4)), sy: r3(1 + 0.08 * hop(b, 0, 0.4)) }) } } },
//   'sofa:nav-raid': { beat: 0.8, offset: 6.0, period: I, parts: { beast: { pivot: 'bottom', at: (b) => ({ dx: r3(1.6 * Math.sin(b * Math.PI * 10) * (b < 0 ? 0 : 1 - b)), sy: r3(1 + 0.06 * hop(b, 0, 0.4)) }) } } },
//   'sofa:nav-characters': { beat: 0.8, offset: 5.7, period: I, parts: { person: { pivot: 'bottom', at: (b) => ({ dy: r3(-5 * hop(b, 0, 0.6)), sy: r3(1 - 0.05 * hop(b, 0.6, 0.9)) }) } } },
//   'sofa:nav-formation': {
//     beat: 0.9, offset: 5.4, period: I,
//     parts: Object.fromEntries([0, 1, 2].map((i) => [`p${i}`, { pivot: 'bottom' as const, at: (b: number) => ({ dy: r3(-(i === 1 ? 5 : 4) * hop(b, i * 0.2, i * 0.2 + 0.45)) }) }])),
//   },
//   'sofa:nav-shop': { beat: 0.8, offset: 5.1, period: I, parts: { cart: { pivot: 'bottom', at: (b) => ({ dx: r3(4 * hop(b, 0, 0.6) - 1 * hop(b, 0.6, 1)), rot: r3(-0.07 * hop(b, 0, 0.5)) }) } } },
//   'sofa:nav-recruit': { beat: 1.0, offset: 4.8, period: I, parts: { hex: { exact: true, at: (b) => ({ rot: r3(ease(b, 0, 0.85) * Math.PI / 3), sx: r3(1 + 0.08 * hop(b)), sy: r3(1 + 0.08 * hop(b)) }) } } },
//   // 오른쪽 이벤트 카드(그림): 그림 속 불빛이 켜졌다 꺼지고, 박자 때 빛이 비스듬히 지나감
//   'sofa:event-story': {
//     beat: 1.2, offset: 1.0, period: I,
//     glints: [
//       { mask: { crit: 'warm', rect: [0, 0, 171, 92] }, mode: 'pulse', when: 'cycle', cycle: 3.4, dur: 1.7, strength: 0.7, glow: 5, color: '255,226,150' },
//       { mask: { crit: 'alpha' }, width: 26, strength: 0.4 },
//     ],
//   },
//   'sofa:event-explore': {
//     beat: 1.2, offset: 2.4, period: I,
//     glints: [
//       { mask: { crit: 'warm', rect: [0, 0, 171, 98] }, mode: 'pulse', when: 'cycle', cycle: 2.6, dur: 0.5, phase: 0.7, strength: 0.8, glow: 5, color: '255,220,140' },
//       { mask: { crit: 'alpha' }, width: 26, strength: 0.4 },
//     ],
//   },
//   'sofa:event-wanted': {
//     beat: 1.2, offset: 3.8, period: I,
//     glints: [{ mask: { crit: 'alpha' }, width: 26, strength: 0.45 }],
//   },
}
