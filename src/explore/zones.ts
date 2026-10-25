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
}

import WORLDS from '../game/data/explore-world.json'
const WORLD = WORLDS.academy

// 전경을 두지 않을 곳: 두 분수, 정문, 게시판, 연못 폭포
const KEEP_CLEAR: [number, number][] = [[545, 3300], [1475, 1290], [984, 2700], [2328, 3028], [3495, 1400], [3490, 2580], [2100, 3100]]

const P = (n: number) => `[임시용 스토리 대사 ${String(n).padStart(2, '0')}]`

export const ACADEMY: Zone = {
  id: 'academy', area: '아카데미 구역', areaEn: 'ACADEMY DISTRICT', place: '정문 광장', dir: 'explore/academy', W: WORLD.W, H: WORLD.H, tile: WORLD.tile, cols: WORLD.cols, rows: WORLD.rows,
  charH: 222, // 벤치 길이·가로등 높이와 비교해 맞춘 키(예전 330은 가로등만큼 커서 배경이 장난감처럼 보였다)
  start: { x: 1536, y: 3268 },
  intro: { x: 1250, y: 2350, z: 0.46 }, // 넓게: 본관 앞뜰과 정문을 함께 보여 주고 대원에게 돌진
  // 늦은 오후 햇빛: 왼쪽 위에서. 그림자는 오른쪽 아래로
  light: { amb: [0.8, 0.78, 0.86], sun: [0.26, 0.22, 0.16], dir: [-0.55, -0.62, 0.56], shadow: [0.62, 0.2] },
  lamps: [{ x: 2745, y: 2821, r: 540, i: 0.35, c: [1, 0.72, 0.42] }, { x: 1851, y: 4024, r: 420, i: 0.3, c: [1, 0.72, 0.42] }, { x: 2438, y: 4132, r: 420, i: 0.3, c: [1, 0.72, 0.42] }],
  npcs: [
    { id: 'npc-girl', name: '아카데미 학생', img: 'explore/npc-girl.webp', x: 1848, y: 2980, lines: [{ who: '아카데미 학생', text: P(1) }, { who: '아카데미 학생', text: P(2) }] },
    { id: 'npc-boy', name: '안경 쓴 학생', img: 'explore/npc-boy.webp', x: 936, y: 3316, lines: [{ who: '안경 쓴 학생', text: P(3) }, { who: '안경 쓴 학생', text: P(4) }] },
    { id: 'npc-girl-court', name: '본관 앞 학생', img: 'explore/npc-girl.webp', x: 1250, y: 1420, lines: [{ who: '본관 앞 학생', text: P(20) }] },
    { id: 'npc-boy-cafe', name: '카페 손님', img: 'explore/npc-boy.webp', x: 5080, y: 1960, lines: [{ who: '카페 손님', text: P(21) }] },
    { id: 'npc-girl-station', name: '역 앞 행인', img: 'explore/npc-girl.webp', x: 6900, y: 2620, lines: [{ who: '역 앞 행인', text: P(22) }] },
  ],
  spots: [
    { id: 'board', label: '게시판', x: 2328, y: 3028, r: 264, kind: 'look', clue: '게시판의 공고문', lines: [{ text: P(5) }, { text: P(6) }] },
    { id: 'gate', label: '정문 열기', x: 984, y: 2830, r: 304, kind: 'gate', lines: [{ text: P(7) }], to: { x: 1564, y: 2116 } },
    { id: 'gate-in', label: '정문 밖으로', x: 1564, y: 2080, r: 220, kind: 'gate', lines: [], to: { x: 992, y: 2900 } },
    { id: 'gazebo', label: '정원 정자', x: 720, y: 4360, r: 256, kind: 'look', lines: [{ text: P(8) }] },
    { id: 'pond', label: '연못 다리', x: 3660, y: 3196, r: 240, kind: 'look', clue: '연못가의 쪽지', lines: [{ text: P(9) }, { text: P(10) }] },
    { id: 'sign', label: '이정표', x: 4006, y: 4254, r: 224, kind: 'look', lines: [{ text: P(11) }] },
    { id: 'hall', label: '아카데미 본관', x: 1620, y: 960, r: 300, kind: 'gate', lines: [{ text: P(12) }] },
    { id: 'clock', label: '시계탑 분수', x: 1440, y: 1240, r: 280, kind: 'look', clue: '분수대의 동전', lines: [{ text: P(13) }, { text: P(14) }] },
    { id: 'cafe', label: '카페 테라스', x: 4680, y: 1720, r: 280, kind: 'look', lines: [{ text: P(15) }] },
    { id: 'statue', label: '광장 조형물', x: 5910, y: 2240, r: 280, kind: 'look', clue: '조형물 아래 메모', lines: [{ text: P(16) }, { text: P(17) }] },
    { id: 'station', label: '성수역 입구', x: 7080, y: 2330, r: 300, kind: 'exit', lines: [{ text: P(18) }] },
    { id: 'bus', label: '버스 정류장', x: 7330, y: 2880, r: 240, kind: 'look', lines: [{ text: P(19) }] },
  ],
  quest: { title: '메인 사건', goal: '사건 현장으로 이동' },
  regions: [
    { name: '성수역 고가', en: 'SEONGSU STATION', code: 'AREA 06', x0: 6400, y0: 0, x1: 99999, y1: 2700 },
    { name: '성수 거리', en: 'SEONGSU STREET', code: 'AREA 05', x0: 4250, y0: 0, x1: 99999, y1: 99999 },
    { name: '아래 정원', en: 'LOWER GARDEN', code: 'AREA 02', x0: 0, y0: 3952, x1: 99999, y1: 99999 },
    { name: '벚꽃 연못', en: 'BLOSSOM POND', code: 'AREA 03', x0: 3150, y0: 1300, x1: 4250, y1: 3952 },
    { name: '본관 앞뜰', en: 'MAIN HALL COURT', code: 'AREA 04', x0: 0, y0: 0, x1: 4250, y1: 2250 },
    { name: '정문 광장', en: 'FRONT PLAZA', code: 'AREA 01', x0: 0, y0: 0, x1: 99999, y1: 99999 },
  ],
  amb: 'amb_academy',
  bgm: 'academy',
  chapter: { no: '01', title: '끊어진 신호', en: ['BROKEN', 'SIGNAL'], card: { bg: '#e2364e', ink: '#1b2c78' } },
  placeEn: 'FRONT PLAZA',
  // 사건 파일 1장 노드 → 필드 위치(걸어서 닿는 자리로 맞춤). 1장 무대(성수역 교차로·뒷골목·변전소 쪽)를 성수 거리·성수역에 배치
  events: {
    'c1-1': { x: 2100, y: 3100, r: 220 }, // 출동 명령 — 정문 광장 게시판 앞
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
      { spout: [545, 3212], tiers: [{ xs: [505, 555, 600], y0: 3250, y1: 3300 }, { xs: [450, 487, 569, 646, 661], y0: 3336, y1: 3448 }] },   // 정문 광장 분수
    ],
    falls: [{ x: 3458, y: 1318, w: 74, h: 150 }, { x: 3452, y: 2508, w: 74, h: 142 }, { x: 2722, y: 3972, w: 66, h: 56 }],
  },
  // 전경 수풀은 분수·조사 지점·사건 자리를 가리지 않게 그 근처에서는 뺀다
  fg: ((WORLD as unknown as { fg?: Zone['fg'] }).fg ?? []).filter((f) => !KEEP_CLEAR.some(([x, y]) => Math.hypot(f.x - x, f.y - y) < 620)),
  fgAtlas: { file: 'explore/fg.webp', rects: ((WORLD as unknown as { fgRects?: Zone['fgAtlas']['rects'] }).fgRects ?? {}) },
}
