// 전투 그림 설정: 유닛별 그림·크기·발 위치, 배경판별 조명·물웅덩이.
import SP from '../game/data/battle-sprites.json'
import C1 from '../game/data/ch1-sprites.json'
import type { Kind } from '../game/combat/sim'

type Sheet = { file: string; w: number; h: number; cols: number; n: number; fps: number }
type Pic = { file: string; w: number; h: number }
type Pic2 = Pic & { ax: number; ay: number; dispH: number }
const B = SP as unknown as { plate: string; rion: Sheet; hound: Sheet; ian: Pic; seren: Pic; kanna: Pic; golem: Pic; orb: Pic }
const N = C1 as unknown as { alley: string; substation: string; mite: Pic2; boss: Pic2; relay: Pic2; shutter: Pic2; pylon: Pic2 }

export interface Look {
  file: string; cw: number; ch: number // 한 칸(프레임) 크기
  cols: number; n: number; fps: number // 1이면 한 장 그림
  s: number; ax: number; ay: number // 표시 배율, 칸 안의 발 위치
  faceRight: boolean // 원본이 오른쪽을 보고 있나
  head: number // 머리 위(표시 px, 체력바 위치)
  float?: number // 공중에 뜬 높이
}
const pic = (p: Pic, h: number, ax = 0.45, faceRight = true, head = h): Look => ({ file: p.file, cw: p.w, ch: p.h, cols: 1, n: 1, fps: 0, s: h / p.h, ax: p.w * ax, ay: p.h, faceRight, head })
const pic2 = (p: Pic2, faceRight = false): Look => ({ file: p.file, cw: p.w, ch: p.h, cols: 1, n: 1, fps: 0, s: p.dispH / p.h, ax: p.ax, ay: p.ay, faceRight, head: p.dispH })

export const LOOKS: Record<Kind, Look> = {
  rion: { file: B.rion.file, cw: B.rion.w, ch: B.rion.h, cols: B.rion.cols, n: B.rion.n, fps: 12, s: 0.86, ax: 92, ay: 259, faceRight: true, head: 165 },
  hound: { file: B.hound.file, cw: B.hound.w, ch: B.hound.h, cols: B.hound.cols, n: B.hound.n, fps: 12, s: 0.6, ax: 108, ay: 214, faceRight: false, head: 110 },
  seren: pic(B.seren, 152, 0.4, true, 118),
  ian: pic(B.ian, 178, 0.45, true, 158),
  kanna: pic(B.kanna, 150, 0.45, true, 130),
  golem: pic(B.golem, 215, 0.5, false, 200),
  orb: { ...pic(B.orb, 95, 0.5, false, 150), float: 58 },
  mite: pic2(N.mite),
  boss: pic2(N.boss),
  pylon: pic2(N.pylon),
  caller: { ...pic2(N.pylon), s: 230 / N.pylon.h, head: 236 },
}
export const PROPS = { relay: pic2(N.relay, true), shutter: pic2(N.shutter, true) }
export const RION_IDLE = [...Array.from({ length: 15 }, (_, i) => 33 + i), 0, 1, 2, 3, 4, 5]

/** 배경판별 빛·물. 좌표는 1280×720 무대 */
export interface BgLook {
  file: string
  amb: [number, number, number] // 그림 전체 밝기(1 = 원본)
  sprAmb: [number, number, number] // 캐릭터 기본 밝기
  key: [number, number, number]; keyDir: [number, number, number]
  lights: { x: number; y: number; z: number; r: number; c: [number, number, number]; i: number; flicker?: number }[]
  puddles: [number, number, number, number, number][] // cx, cy, rx, ry, 반사 세기
  wetFrom: number; wet: number // 이 y부터 바닥 전체가 젖은 정도
  ripple: number
  grade: string // CSS 오버레이 색(분위기)
}
export const BGS: Record<'street' | 'alley' | 'substation', BgLook> = {
  street: {
    file: B.plate, amb: [1, 0.98, 0.95], sprAmb: [0.82, 0.78, 0.74], key: [1.0, 0.78, 0.55], keyDir: [0.55, -0.55, 0.62],
    lights: [{ x: 1180, y: 60, z: 260, r: 900, c: [1, 0.72, 0.45], i: 0.45 }, { x: 200, y: 120, z: 120, r: 380, c: [1, 0.75, 0.45], i: 0.35 }],
    puddles: [[612, 535, 150, 34, 0.7], [890, 650, 120, 26, 0.55], [330, 445, 80, 18, 0.5], [1020, 470, 90, 20, 0.45]],
    wetFrom: 999, wet: 0, ripple: 0.6, grade: 'rgba(255,170,90,.08)',
  },
  alley: {
    file: N.alley, amb: [0.86, 0.88, 0.98], sprAmb: [0.6, 0.64, 0.78], key: [0.55, 0.65, 0.95], keyDir: [-0.35, -0.6, 0.7],
    lights: [
      { x: 440, y: 168, z: 90, r: 420, c: [0.3, 1, 0.95], i: 0.75, flicker: 0.05 },
      { x: 360, y: 75, z: 80, r: 300, c: [1, 0.35, 0.75], i: 0.6, flicker: 0.12 },
      { x: 925, y: 160, z: 90, r: 440, c: [1, 0.6, 0.3], i: 0.7 },
      { x: 805, y: 100, z: 80, r: 300, c: [0.3, 1, 0.8], i: 0.45 },
      { x: 1190, y: 620, z: 40, r: 260, c: [0.75, 0.35, 1], i: 0.6, flicker: 0.2 },
    ],
    puddles: [[655, 525, 270, 72, 0.95], [770, 668, 260, 52, 0.85], [962, 405, 115, 30, 0.8], [600, 362, 125, 20, 0.7], [350, 468, 90, 22, 0.75], [140, 540, 90, 30, 0.5]],
    wetFrom: 330, wet: 0.32, ripple: 1, grade: 'rgba(40,60,140,.12)',
  },
  substation: {
    file: N.substation, amb: [0.86, 0.92, 0.95], sprAmb: [0.58, 0.66, 0.72], key: [0.45, 0.8, 0.85], keyDir: [0.1, -0.75, 0.65],
    lights: [
      { x: 140, y: 230, z: 70, r: 380, c: [0.7, 0.35, 1], i: 0.85, flicker: 0.08 },
      { x: 600, y: 300, z: 60, r: 320, c: [0.75, 0.4, 1], i: 0.6 },
      { x: 1170, y: 270, z: 80, r: 420, c: [1, 0.45, 0.2], i: 0.65, flicker: 0.25 },
      { x: 420, y: 40, z: 300, r: 620, c: [0.5, 0.95, 1], i: 0.45 },
    ],
    puddles: [[640, 560, 520, 150, 0.75], [300, 640, 220, 60, 0.7], [1000, 620, 220, 70, 0.7]],
    wetFrom: 390, wet: 0.5, ripple: 0.8, grade: 'rgba(30,90,110,.12)',
  },
}
export const ACCENT: Record<string, [number, number, number]> = {
  rion: [0.78, 0.96, 0.23], seren: [0.62, 0.72, 1], ian: [0.94, 0.47, 0.18], kanna: [0.94, 0.35, 0.27],
}
export const depthScale = (y: number) => 0.84 + Math.max(0, Math.min(1, (y - 300) / 390)) * 0.26
