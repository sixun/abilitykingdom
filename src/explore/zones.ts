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
  regions: { name: string; x0: number; y0: number; x1: number; y1: number }[] // 먼저 맞는 것이 이름(걸어 들어가면 장소 이름이 뜬다)
  amb: string
}

import WORLDS from '../game/data/explore-world.json'
const WORLD = WORLDS.academy

const P = (n: number) => `[임시용 스토리 대사 ${String(n).padStart(2, '0')}]`

export const ACADEMY: Zone = {
  id: 'academy', area: '아카데미 구역', areaEn: 'ACADEMY DISTRICT', place: '정문 광장', dir: 'explore/academy', W: WORLD.W, H: WORLD.H, tile: WORLD.tile, cols: WORLD.cols, rows: WORLD.rows,
  charH: 330,
  start: { x: 2560, y: 1880 },
  intro: { x: 1700, y: 1050, z: 0.62 },
  // 늦은 오후 햇빛: 왼쪽 위에서. 그림자는 오른쪽 아래로
  light: { amb: [0.8, 0.78, 0.86], sun: [0.26, 0.22, 0.16], dir: [-0.55, -0.62, 0.56], shadow: [0.62, 0.2] },
  lamps: [{ x: 4575, y: 1135, r: 900, i: 0.35, c: [1, 0.72, 0.42] }, { x: 3085, y: 3140, r: 700, i: 0.3, c: [1, 0.72, 0.42] }, { x: 4063, y: 3320, r: 700, i: 0.3, c: [1, 0.72, 0.42] }],
  npcs: [
    { id: 'npc-girl', name: '아카데미 학생', img: 'explore/npc-girl.webp', x: 3080, y: 1400, lines: [{ who: '아카데미 학생', text: P(1) }, { who: '아카데미 학생', text: P(2) }] },
    { id: 'npc-boy', name: '안경 쓴 학생', img: 'explore/npc-boy.webp', x: 1560, y: 1960, lines: [{ who: '안경 쓴 학생', text: P(3) }, { who: '안경 쓴 학생', text: P(4) }] },
  ],
  spots: [
    { id: 'board', label: '게시판', x: 3880, y: 1480, r: 330, kind: 'look', clue: '게시판의 공고문', lines: [{ text: P(5) }, { text: P(6) }] },
    { id: 'gate', label: '아카데미 정문', x: 1640, y: 1150, r: 380, kind: 'gate', lines: [{ text: P(7) }] },
    { id: 'gazebo', label: '정원 정자', x: 1200, y: 3700, r: 320, kind: 'look', lines: [{ text: P(8) }] },
    { id: 'pond', label: '연못 다리', x: 6100, y: 1760, r: 300, kind: 'look', clue: '연못가의 쪽지', lines: [{ text: P(9) }, { text: P(10) }] },
    { id: 'sign', label: '이정표', x: 6676, y: 3524, r: 280, kind: 'look', lines: [{ text: P(11) }] },
  ],
  quest: { title: '메인 사건', goal: '학교 내부로 이동하기' },
  regions: [
    { name: '아래 정원', x0: 0, y0: 3020, x1: 99999, y1: 99999 },
    { name: '벚꽃 연못', x0: 5350, y0: 0, x1: 99999, y1: 3020 },
    { name: '정문 광장', x0: 0, y0: 0, x1: 99999, y1: 99999 },
  ],
  amb: 'amb_academy',
}
