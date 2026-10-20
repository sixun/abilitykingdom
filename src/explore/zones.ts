import type { Bgm } from '../app/audio'
// 탐색 구역 데이터. 좌표는 구역 그림 원본 픽셀(가로 W × 세로 H) 기준.
// 대사는 확정 전까지 [임시용 스토리 대사 NN] 자리표시.
export interface Line { who?: string; text: string }
export interface Npc { id: string; name: string; img: string; x: number; y: number; lines: Line[] }
export interface Spot { id: string; label: string; x: number; y: number; r: number; kind: 'look' | 'gate' | 'exit'; lines: Line[]; clue?: string }
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
  /** 전경 물체(카메라 앞, 시차) — 만드는 곳: tools/build_explore_world.py */
  fg?: { k: string; x: number; y: number; w: number; flip?: boolean }[]
  fgAtlas: { file: string; rects: Record<string, [number, number, number, number]> }
  amb: string
  /** 구역 배경음악 */
  bgm: Bgm
}

import WORLDS from '../game/data/explore-world.json'
const WORLD = WORLDS.academy

const P = (n: number) => `[임시용 스토리 대사 ${String(n).padStart(2, '0')}]`

export const ACADEMY: Zone = {
  id: 'academy', area: '아카데미 구역', areaEn: 'ACADEMY DISTRICT', place: '정문 광장', dir: 'explore/academy', W: WORLD.W, H: WORLD.H, tile: WORLD.tile, cols: WORLD.cols, rows: WORLD.rows,
  charH: 330,
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
    { id: 'gate', label: '아카데미 정문', x: 984, y: 2830, r: 304, kind: 'gate', lines: [{ text: P(7) }] },
    { id: 'gazebo', label: '정원 정자', x: 720, y: 4360, r: 256, kind: 'look', lines: [{ text: P(8) }] },
    { id: 'pond', label: '연못 다리', x: 3660, y: 3196, r: 240, kind: 'look', clue: '연못가의 쪽지', lines: [{ text: P(9) }, { text: P(10) }] },
    { id: 'sign', label: '이정표', x: 4006, y: 4254, r: 224, kind: 'look', lines: [{ text: P(11) }] },
    { id: 'hall', label: '아카데미 본관', x: 1620, y: 960, r: 300, kind: 'gate', lines: [{ text: P(12) }] },
    { id: 'clock', label: '시계탑 분수', x: 1440, y: 1240, r: 280, kind: 'look', clue: '분수대의 동전', lines: [{ text: P(13) }, { text: P(14) }] },
    { id: 'cafe', label: '카페 테라스', x: 4950, y: 1700, r: 280, kind: 'look', lines: [{ text: P(15) }] },
    { id: 'statue', label: '광장 조형물', x: 5910, y: 2240, r: 280, kind: 'look', clue: '조형물 아래 메모', lines: [{ text: P(16) }, { text: P(17) }] },
    { id: 'station', label: '성수역 입구', x: 7080, y: 2330, r: 300, kind: 'exit', lines: [{ text: P(18) }] },
    { id: 'bus', label: '버스 정류장', x: 7330, y: 2880, r: 240, kind: 'look', lines: [{ text: P(19) }] },
  ],
  quest: { title: '메인 사건', goal: '학교 내부로 이동하기' },
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
  fg: (WORLD as unknown as { fg?: Zone['fg'] }).fg ?? [],
  fgAtlas: { file: 'explore/fg.webp', rects: ((WORLD as unknown as { fgRects?: Zone['fgAtlas']['rects'] }).fgRects ?? {}) },
}
