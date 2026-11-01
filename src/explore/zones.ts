import type { Bgm } from '../app/audio'
// 탐색 구역 데이터. 좌표는 구역 그림 원본 픽셀(가로 W × 세로 H) 기준.
// 대사는 확정 전까지 [임시용 스토리 대사 NN] 자리표시.
export interface Line { who?: string; text: string }
export interface Npc { id: string; name: string; img: string; x: number; y: number; lines: Line[] }
export interface Spot { id: string; label: string; x: number; y: number; r: number; kind: 'look' | 'gate' | 'exit'; lines: Line[]; clue?: string; to?: { x: number; y: number } }
export interface Zone {
  id: string; area: string; areaEn: string; place: string; dir: string; W: number; H: number
  tile: number; cols: number; rows: number // 지도 조각(카메라 근처만 받는다)
  charH: number                    // 캐릭터 키(그림 픽셀)
  start: { x: number; y: number }
  intro: { x: number; y: number; z: number } // 진입 연출: 처음 보여 줄 곳
  light: { amb: [number, number, number]; sun: [number, number, number]; dir: [number, number, number]; shadow: [number, number] }
  lamps: { x: number; y: number; r: number; i: number; c: [number, number, number] }[]
  npcs: Npc[]; spots: Spot[]
  quest: { title: string; goal: string }
  regions: { name: string; en: string; code: string; x0: number; y0: number; x1: number; y1: number }[] // 먼저 맞는 것이 이름(처음 걸어 들어가면 구역 이름 연출)
  /** 진입 연출에 쓰는 장 정보와 색(단색 카드) */
  chapter: { no: string; title: string; en: string[]; card: { bg: string; ink: string } }
  placeEn: string
  /** 사건 노드가 일어나는 자리(사건 파일 1장 순서대로 하나씩 열린다). 가까이 가면 연출 후 전투/이야기/조사 */
  events: Record<string, { x: number; y: number; r: number }>
  /** 물 연출: 분수(꼭대기 물방울 + 층마다 물줄기 x 위치, 시작·끝 y) · 폭포(사각형) — 그림에 그려진 물줄기 위치에 맞춘 값 */
  water?: { fountains: { spout: [number, number]; tiers: { xs: number[]; y0: number; y1: number }[] }[]; falls: { x: number; y: number; w: number; h: number }[] }
  /** 전경 물체(카메라 앞, 시차) — 만드는 곳: tools/build_explore_world.py */
  fg?: { k: string; x: number; y: number; w: number; flip?: boolean }[]
  fgAtlas: { file: string; rects: Record<string, [number, number, number, number]> }
  amb: string
  /** 구역 배경음악 */
  bgm: Bgm
  /** 다른 맵으로 가는 출입구: 들어서면 화면을 덮고 목적지 맵의 도착 자리로(도착 직후에는 그 자리 출입구가 잠깐 잠김) */
  portals?: Portal[]
  /** 카메라 배율(없으면 기본) · 미니맵 배율(월드 1px → 미니맵 px) */
  camZ?: number
  mini?: number
  /** true = 그림 원래 색·조명 그대로(화면 보정·빛무리·꽃잎 없음) — 사용자 제공 배경 */
  raw?: boolean
}
export interface Portal { id: string; label: string; x: number; y: number; r: number; to: { zone: string; x: number; y: number; dir: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' } }

import WORLDS from '../game/data/explore-world.json'
const WORLD = WORLDS.academy

// 전경을 두지 않을 곳: 두 분수, 정문, 게시판, 연못 폭포
const KEEP_CLEAR: [number, number][] = [[1072, 2850], [1475, 1290], [1100, 2500], [1640, 2700], [3495, 1400], [3520, 2280], [3330, 3200], [1600, 2850]]

const P = (n: number) => `[임시용 스토리 대사 ${String(n).padStart(2, '0')}]`

export const ACADEMY: Zone = {
  id: 'academy', area: '아카데미 구역', areaEn: 'ACADEMY DISTRICT', place: '정문 광장', dir: 'explore/academy', W: WORLD.W, H: WORLD.H, tile: WORLD.tile, cols: WORLD.cols, rows: WORLD.rows,
  charH: 222, // 벤치 길이·가로등 높이와 비교해 맞춘 키(예전 330은 가로등만큼 커서 배경이 장난감처럼 보였다)
  start: { x: 1232, y: 2780 },
  intro: { x: 1250, y: 2350, z: 0.46 }, // 넓게: 본관 앞뜰과 정문을 함께 보여 주고 대원에게 돌진
  // 늦은 오후 햇빛: 왼쪽 위에서. 그림자는 오른쪽 아래로
  light: { amb: [0.8, 0.78, 0.86], sun: [0.26, 0.22, 0.16], dir: [-0.55, -0.62, 0.56], shadow: [0.62, 0.2] },
  lamps: [{ x: 333, y: 2350, r: 360, i: 0.35, c: [1, 0.72, 0.42] }, { x: 300, y: 2817, r: 360, i: 0.35, c: [1, 0.72, 0.42] }, { x: 1800, y: 2400, r: 360, i: 0.35, c: [1, 0.72, 0.42] }, { x: 1850, y: 2967, r: 360, i: 0.35, c: [1, 0.72, 0.42] }, { x: 1427, y: 4118, r: 300, i: 0.3, c: [1, 0.72, 0.42] }, { x: 855, y: 4245, r: 300, i: 0.3, c: [1, 0.72, 0.42] }],
  npcs: [
    { id: 'npc-girl', name: '아카데미 학생', img: 'explore/npc-girl.webp', x: 1648, y: 2880, lines: [{ who: '아카데미 학생', text: P(1) }, { who: '아카데미 학생', text: P(2) }] },
    { id: 'npc-boy', name: '안경 쓴 학생', img: 'explore/npc-boy.webp', x: 688, y: 2844, lines: [{ who: '안경 쓴 학생', text: P(3) }, { who: '안경 쓴 학생', text: P(4) }] },
    { id: 'npc-girl-court', name: '본관 앞 학생', img: 'explore/npc-girl.webp', x: 1272, y: 1420, lines: [{ who: '본관 앞 학생', text: P(20) }] },
    { id: 'npc-boy-cafe', name: '카페 손님', img: 'explore/npc-boy.webp', x: 5080, y: 1960, lines: [{ who: '카페 손님', text: P(21) }] },
    { id: 'npc-girl-station', name: '역 앞 행인', img: 'explore/npc-girl.webp', x: 6900, y: 2620, lines: [{ who: '역 앞 행인', text: P(22) }] },
  ],
  spots: [
    { id: 'board', label: '게시판', x: 1640, y: 2700, r: 200, kind: 'look', clue: '게시판의 공고문', lines: [{ text: P(5) }, { text: P(6) }] },
    { id: 'gate', label: '정문 열기', x: 1100, y: 2600, r: 160, kind: 'gate', lines: [{ text: P(7) }], to: { x: 1148, y: 2144 } },
    { id: 'gate-in', label: '정문 밖으로', x: 1150, y: 2190, r: 150, kind: 'gate', lines: [], to: { x: 1100, y: 2660 } },
    { id: 'gazebo', label: '정원 정자', x: 520, y: 3960, r: 300, kind: 'look', lines: [{ text: P(8) }] },
    { id: 'pond', label: '연못 다리', x: 3468, y: 2916, r: 200, kind: 'look', clue: '연못가의 쪽지', lines: [{ text: P(9) }, { text: P(10) }] },
    { id: 'sign', label: '동쪽 옆문', x: 3680, y: 4392, r: 200, kind: 'look', lines: [{ text: P(11) }] },
    { id: 'hall', label: '아카데미 본관', x: 1620, y: 960, r: 300, kind: 'gate', lines: [{ text: P(12) }] },
    { id: 'clock', label: '시계탑 분수', x: 1440, y: 1240, r: 280, kind: 'look', clue: '분수대의 동전', lines: [{ text: P(13) }, { text: P(14) }] },
    { id: 'cafe', label: '카페 테라스', x: 4680, y: 1720, r: 280, kind: 'look', lines: [{ text: P(15) }] },
    { id: 'statue', label: '광장 조형물', x: 5910, y: 2240, r: 280, kind: 'look', clue: '조형물 아래 메모', lines: [{ text: P(16) }, { text: P(17) }] },
    { id: 'station', label: '성수역 입구', x: 7080, y: 2330, r: 300, kind: 'exit', lines: [{ text: P(18) }] },
    { id: 'bus', label: '버스 정류장', x: 7330, y: 2880, r: 240, kind: 'look', lines: [{ text: P(19) }] },
  ],
  quest: { title: '메인 사건', goal: '사건 현장으로 이동' },
  // 스토리는 아카데미 정문 진입로(새 맵)에서 시작한다. 이 큰 지도(성수 거리·1장 사건)는 정문 진입로의 '도시 쪽 길'로 온다
  portals: [{ id: 'to-gate', label: '아카데미 정문 진입로', x: 420, y: 2860, r: 80, to: { zone: 'academy_gate', x: 440, y: 1130, dir: 'E' } }],
  regions: [
    { name: '성수역 고가', en: 'SEONGSU STATION', code: 'AREA 06', x0: 6400, y0: 0, x1: 99999, y1: 2700 },
    { name: '성수 거리', en: 'SEONGSU STREET', code: 'AREA 05', x0: 4250, y0: 0, x1: 99999, y1: 99999 },
    { name: '아래 정원', en: 'LOWER GARDEN', code: 'AREA 02', x0: 0, y0: 3550, x1: 3000, y1: 99999 },
    { name: '벚꽃 연못', en: 'BLOSSOM POND', code: 'AREA 03', x0: 2000, y0: 2250, x1: 4250, y1: 99999 },
    { name: '본관 앞뜰', en: 'MAIN HALL COURT', code: 'AREA 04', x0: 0, y0: 0, x1: 4250, y1: 2300 },
    { name: '정문 광장', en: 'FRONT PLAZA', code: 'AREA 01', x0: 0, y0: 0, x1: 99999, y1: 99999 },
  ],
  amb: 'amb_academy',
  bgm: 'academy',
  chapter: { no: '01', title: '끊어진 신호', en: ['BROKEN', 'SIGNAL'], card: { bg: '#e2364e', ink: '#1b2c78' } },
  placeEn: 'FRONT PLAZA',
  // 사건 파일 1장 노드 → 필드 위치(걸어서 닿는 자리로 맞춤). 1장 무대(성수역 교차로·뒷골목·변전소 쪽)를 성수 거리·성수역에 배치
  events: {
    'c1-1': { x: 1600, y: 2848, r: 170 }, // 출동 명령 — 정문 광장 게시판 앞
    'c1-2': { x: 4868, y: 2672, r: 260 }, // 차단된 교차로 — 성수 거리 교차로
    'c1-3': { x: 5672, y: 3264, r: 240 }, // 쓰러진 중계기 — 뒷골목
    'c1-4': { x: 6200, y: 3900, r: 260 }, // 끊긴 신호
    'c1-5': { x: 6800, y: 3304, r: 260 }, // 신호를 따라서
    'c1-6': { x: 7220, y: 2764, r: 260 }, // 봉쇄
    'c1-7': { x: 7096, y: 2532, r: 240 }, // 스태틱(보스) — 성수역 앞
    'c1-8': { x: 7096, y: 2532, r: 240 }, // 잔향
  },
  water: {
    fountains: [
      { spout: [1460, 1062], tiers: [{ xs: [1420, 1450, 1480, 1505], y0: 1132, y1: 1172 }, { xs: [1362, 1393, 1416, 1503, 1543], y0: 1182, y1: 1242 }] }, // 본관 앞 시계탑 분수
      { spout: [1072, 2690], tiers: [{ xs: [978, 1010, 1100, 1160], y0: 2795, y1: 2925 }] },   // 정문 광장 분수(다시 그린 그림)
    ],
    falls: [{ x: 3458, y: 1318, w: 74, h: 150 }, { x: 3482, y: 2172, w: 92, h: 170 }, { x: 3262, y: 3140, w: 80, h: 70 }],
  },
  // 전경 수풀은 분수·조사 지점·사건 자리를 가리지 않게 그 근처에서는 뺀다
  fg: ((WORLD as unknown as { fg?: Zone['fg'] }).fg ?? []).filter((f) => !KEEP_CLEAR.some(([x, y]) => Math.hypot(f.x - x, f.y - y) < 620)),
  fgAtlas: { file: 'explore/fg.webp', rects: ((WORLD as unknown as { fgRects?: Zone['fgAtlas']['rects'] }).fgRects ?? {}) },
}

// ───────── 아카데미 맵 2개(사용자 제공 배경, 2026-11-01) ─────────
// 원본: ability_kingdom_academy_maps_8_and_plan.zip — 맵당 겹치는 카메라 화면 4장을 manifest 좌표로 복원한 1672×941 배경.
// 게임 월드는 원본 ×2(3344×1882, AI 4배 업스케일을 줄여 씀). 아래 좌표는 원본 1672 좌표를 적고 G()로 2배 한다.
// 걷기·가림 자료: tools/build_explore_maps8.py(바닥 분할 + 손보정 다각형 tools/explore/maps8/<맵>_overrides.json)
// 스토리 모드는 정문 진입로에서 시작한다. 정문↔복도 문과 도시 쪽 길↔큰 지도는 임시 연결(챕터 동선 미확정). 대사는 자리표시.
const G = (x: number, y: number) => ({ x: x * 2, y: y * 2 })
const gp = (id: string, label: string, x: number, y: number, r: number, lines: Line[], clue?: string): Spot => ({ id, label, ...G(x, y), r: r * 2, kind: 'look', lines, clue })
const WG = WORLDS.academy_gate, WH = WORLDS.academy_hall
const BASE8 = {
  tile: 2048, charH: 280, // 화면 높이의 약 22%(기획 기준 21~24%). 스프라이트 여백 때문에 244로는 실제 보이는 키가 19%라 올림
  camZ: 0.615,            // 화면에 원본 약 1040×585(카메라 한 장 크기)만 보인다
  mini: 0.0777,
  npcs: [] as Npc[],
  events: {} as Zone['events'],
  fgAtlas: { file: 'explore/fg.webp', rects: {} },
  amb: 'amb_academy',
  bgm: 'academy' as Bgm,
  raw: true,
  lamps: [] as Zone['lamps'], // 그림에 이미 그려진 등불 위에 빛무리를 덧칠하지 않는다
}

export const ACADEMY_GATE: Zone = {
  ...BASE8,
  id: 'academy_gate', area: '아카데미', areaEn: 'ACADEMY GATE', place: '정문 진입로', placeEn: 'MAIN GATE', dir: 'explore/academy_gate',
  W: WG.W, H: WG.H, cols: WG.cols, rows: WG.rows,
  start: G(230, 588),                       // 도시 쪽 보도에서 들어온다
  intro: { ...G(700, 300), z: 0.66 },       // 맵 전체가 아니라 카메라 한 화면: 정문·안내실을 보여 준 뒤 대원에게 돌진
  light: { amb: [0.84, 0.8, 0.84], sun: [0.24, 0.2, 0.14], dir: [-0.55, -0.62, 0.56], shadow: [0.55, 0.2] },
  spots: [
    gp('booth', '안내실', 965, 292, 48, [{ text: P(31) }, { text: P(32) }]),
    gp('board8', '게시판', 1372, 398, 48, [{ text: P(33) }], '정문 게시판의 공지'),
  ],
  portals: [
    { id: 'to-hall', label: '수업동 복도로 (테스트 연결)', ...G(375, 182), r: 80, to: { zone: 'academy_hall', ...G(900, 384), dir: 'S' } },
    // 도시 쪽 길 → 기존 큰 지도(성수 거리·1장 사건 현장). 맵 동선 확정 전 임시 연결
    { id: 'to-field', label: '도시 쪽 길 → 성수 거리', ...G(40, 575), r: 70, to: { zone: 'academy', x: 520, y: 2860, dir: 'E' } },
  ],
  quest: { title: '메인 사건', goal: '사건 현장: 왼쪽 아래 도시 쪽 길 → 성수 거리' },
  regions: [{ name: '정문 진입로', en: 'MAIN GATE', code: 'AC 01', x0: 0, y0: 0, x1: 99999, y1: 99999 }],
  chapter: { no: '01', title: '아카데미', en: ['ACADEMY', 'MAIN GATE'], card: { bg: '#1d2d6b', ink: '#e9c46a' } },
}

export const ACADEMY_HALL: Zone = {
  ...BASE8,
  id: 'academy_hall', area: '아카데미', areaEn: 'ACADEMY HALL', place: '수업동 복도', placeEn: 'CLASS HALL', dir: 'explore/academy_hall',
  W: WH.W, H: WH.H, cols: WH.cols, rows: WH.rows,
  start: G(720, 420),                       // 위층 복도 가운데
  intro: { ...G(720, 300), z: 0.66 },
  // 실내: 창으로 드는 오후 빛 + 벽등의 따뜻한 빛
  light: { amb: [0.88, 0.82, 0.8], sun: [0.18, 0.14, 0.1], dir: [-0.5, -0.6, 0.62], shadow: [0.45, 0.16] },
  spots: [
    gp('a205', '강의실 A-205', 360, 246, 46, [{ text: P(35) }]),
    gp('lounge', '라운지', 690, 318, 50, [{ text: P(36) }]),
    gp('hallboard', '복도 게시판', 1470, 345, 46, [{ text: P(37) }], '복도 게시판의 시간표'),
  ],
  portals: [{ id: 'to-gate', label: '정문 진입로로 (테스트 연결)', ...G(905, 318), r: 76, to: { zone: 'academy_gate', ...G(386, 276), dir: 'S' } }],
  quest: { title: '메인 사건', goal: '유리문 → 정문 진입로(테스트 연결)' },
  regions: [{ name: '수업동 복도', en: 'CLASS HALL', code: 'AC 05', x0: 0, y0: 0, x1: 99999, y1: 99999 }],
  chapter: { no: '01', title: '아카데미', en: ['ACADEMY', 'CLASS HALL'], card: { bg: '#1d2d6b', ink: '#e9c46a' } },
}

export const ZONES: Record<string, Zone> = { academy: ACADEMY, academy_gate: ACADEMY_GATE, academy_hall: ACADEMY_HALL }
