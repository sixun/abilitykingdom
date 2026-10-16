// 전투 그림 설정: 유닛별 그림·크기·발 위치, 배경판별 조명·물웅덩이.
import SP from '../game/data/battle-sprites.json'
import C1 from '../game/data/ch1-sprites.json'
import MS from '../game/data/motion-sets.json'
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
  ms?: MotionSet // 동작 세트(있으면 이 그림으로 그린다)
}
/** 동작 세트: 한 장(아틀라스)에 동작별 프레임을 빽빽하게 담는다. fr = [x, y, w, h, 발x, 발y](아틀라스 px) */
export type ClipName = 'idle' | 'run' | 'atk1' | 'atk2' | 'atk3' | 'buff' | 'skill' | 'hit'
export interface ClipDef { s: number; n: number; fps: number; imp?: number; loop?: boolean }
export interface MotionSet { file: string; W: number; H: number; s: number; fr: number[][]; clips: Partial<Record<ClipName, ClipDef>> }
export const MOTION = MS as unknown as Partial<Record<Kind, MotionSet>>
const pic = (p: Pic, h: number, ax = 0.45, faceRight = true, head = h): Look => ({ file: p.file, cw: p.w, ch: p.h, cols: 1, n: 1, fps: 0, s: h / p.h, ax: p.w * ax, ay: p.h, faceRight, head })
const pic2 = (p: Pic2, faceRight = false): Look => ({ file: p.file, cw: p.w, ch: p.h, cols: 1, n: 1, fps: 0, s: p.dispH / p.h, ax: p.ax, ay: p.ay, faceRight, head: p.dispH })

export const LOOKS: Record<Kind, Look> = {
  rion: { file: B.rion.file, cw: B.rion.w, ch: B.rion.h, cols: B.rion.cols, n: B.rion.n, fps: 12, s: 0.84, ax: 92, ay: 266, faceRight: true, head: 178 },
  hound: { file: B.hound.file, cw: B.hound.w, ch: B.hound.h, cols: B.hound.cols, n: B.hound.n, fps: 12, s: 0.66, ax: 108, ay: 220, faceRight: false, head: 128 },
  seren: { file: B.seren.file, cw: B.seren.w, ch: B.seren.h, cols: 1, n: 1, fps: 0, s: 0.78, ax: 160, ay: 278, faceRight: true, head: 170 },
  ian: { file: B.ian.file, cw: B.ian.w, ch: B.ian.h, cols: 1, n: 1, fps: 0, s: 0.56, ax: 181, ay: 365, faceRight: true, head: 196 },
  kanna: { file: B.kanna.file, cw: B.kanna.w, ch: B.kanna.h, cols: 1, n: 1, fps: 0, s: 0.56, ax: 179, ay: 315, faceRight: true, head: 172 },
  golem: { file: B.golem.file, cw: B.golem.w, ch: B.golem.h, cols: 1, n: 1, fps: 0, s: 0.6, ax: 215, ay: 417, faceRight: false, head: 245 },
  orb: { file: B.orb.file, cw: B.orb.w, ch: B.orb.h, cols: 1, n: 1, fps: 0, s: 0.6, ax: 111, ay: 193, faceRight: false, head: 115, float: 62 },
  mite: pic2(N.mite),
  boss: pic2(N.boss),
  pylon: pic2(N.pylon),
  caller: { ...pic2(N.pylon), s: 230 / N.pylon.h, head: 236 },
}
for (const k of Object.keys(MOTION) as Kind[]) if (LOOKS[k]) LOOKS[k] = { ...LOOKS[k], ms: MOTION[k] }
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
  // ── 던파식 배경(선택) ──
  depth?: string // 깊이 그림(흰색=가까움). 카메라가 움직이면 먼 곳일수록 덜 움직여 층이 갈라져 보인다
  far?: number // 가장 먼 곳이 카메라를 따라 움직이는 비율(0~1, 기본 0.35)
  fg?: { file: string; par: number; y: number; h: number; x?: number; w?: number }[] // 앞쪽 소품 층: par>1이면 바닥보다 빨리 흐른다
  persp?: [number, number] // 원근 크기(바닥 맨 위, 맨 아래). 배경 그림의 원근과 맞춘다
  air?: ('rain' | 'dust' | 'steam' | 'embers')[] // 공기 효과
  streaks?: number // 불빛이 젖은 바닥에 세로로 길게 번지는 반사 세기
  floorTop?: number // 바닥이 시작하는 y(이 위는 벽·건물)
  mirrors?: [number, number, number, number, number][] // 유리창 반사 영역 x, y, w, h, 세기
  emissive?: number // 간판·전등 발광(그림에서 자동 추출) 세기
}
export type BgKey = 'street' | 'alley' | 'substation' | 'alleyOld'
export const BGS: Record<BgKey, BgLook> = {
  street: {
    file: B.plate, amb: [0.74, 0.7, 0.68], sprAmb: [0.42, 0.4, 0.44], key: [1.25, 0.9, 0.6], keyDir: [0.75, -0.45, 0.45],
    lights: [{ x: 1250, y: 120, z: 160, r: 1100, c: [1, 0.66, 0.38], i: 0.85 }, { x: 230, y: 130, z: 110, r: 420, c: [1, 0.75, 0.45], i: 0.7 }],
    puddles: [[612, 535, 150, 34, 0.7], [890, 650, 120, 26, 0.55], [330, 445, 80, 18, 0.5], [1020, 470, 90, 20, 0.45]],
    wetFrom: 999, wet: 0, ripple: 0.6, grade: 'rgba(255,170,90,.08)',
    persp: [0.9, 1.08], air: ['dust'], // 높은 곳에서 내려다본 그림이라 원근이 약하다
  },
  // 던파식 골목: 옆에서 본 구도 + 깊이 시차 + 앞쪽 소품 + 비 + 간판 발광 + 젖은 바닥 반사
  alley: {
    file: 'ref/ch1/alley2.webp', depth: 'ref/ch1/alley2-depth.webp', far: 0.28,
    fg: [{ file: 'ref/ch1/alley2-fg.webp', par: 1.45, x: -70, w: 1420, y: 40, h: 760 }],
    amb: [0.62, 0.64, 0.75], sprAmb: [0.32, 0.35, 0.46], key: [0.55, 0.68, 1.05], keyDir: [-0.45, -0.6, 0.55],
    lights: [
      { x: 445, y: 172, z: 90, r: 520, c: [0.3, 1, 0.95], i: 1.15, flicker: 0.05 },
      { x: 365, y: 80, z: 80, r: 380, c: [1, 0.35, 0.75], i: 0.9, flicker: 0.12 },
      { x: 918, y: 162, z: 90, r: 560, c: [1, 0.6, 0.3], i: 1.2 },
      { x: 740, y: 188, z: 80, r: 320, c: [0.35, 1, 0.9], i: 0.6 },
      { x: 380, y: 218, z: 60, r: 420, c: [1, 0.75, 0.4], i: 0.55 },
      { x: 1120, y: 210, z: 60, r: 460, c: [1, 0.75, 0.4], i: 0.6 },
    ],
    puddles: [[462, 468, 95, 20, 0.95], [700, 560, 520, 95, 0.55], [1080, 470, 160, 22, 0.7]],
    wetFrom: 400, wet: 0.5, ripple: 1, grade: 'rgba(40,60,140,.12)',
    persp: [0.95, 1.05], floorTop: 393, emissive: 0.75, streaks: 0.9, air: ['rain', 'dust'],
    mirrors: [[236, 226, 110, 74, 0.35], [380, 224, 145, 76, 0.35], [1058, 226, 168, 104, 0.3]],
  },
  substation: {
    file: N.substation, amb: [0.6, 0.66, 0.7], sprAmb: [0.3, 0.36, 0.42], key: [0.5, 0.9, 0.95], keyDir: [0.25, -0.75, 0.5],
    lights: [
      { x: 140, y: 230, z: 70, r: 480, c: [0.7, 0.35, 1], i: 1.3, flicker: 0.08 },
      { x: 600, y: 300, z: 60, r: 400, c: [0.75, 0.4, 1], i: 1.0 },
      { x: 1170, y: 270, z: 80, r: 520, c: [1, 0.45, 0.2], i: 1.1, flicker: 0.25 },
      { x: 420, y: 40, z: 300, r: 700, c: [0.5, 0.95, 1], i: 0.8 },
    ],
    puddles: [[640, 560, 520, 150, 0.75], [300, 640, 220, 60, 0.7], [1000, 620, 220, 70, 0.7]],
    wetFrom: 390, wet: 0.5, ripple: 0.8, grade: 'rgba(30,90,110,.12)',
    air: ['embers', 'dust'], emissive: 0.6,
  },
  alleyOld: {
    file: N.alley, amb: [0.6, 0.62, 0.72], sprAmb: [0.3, 0.33, 0.44], key: [0.55, 0.68, 1.05], keyDir: [-0.55, -0.55, 0.55],
    lights: [
      { x: 440, y: 168, z: 90, r: 520, c: [0.3, 1, 0.95], i: 1.2, flicker: 0.05 },
      { x: 360, y: 75, z: 80, r: 380, c: [1, 0.35, 0.75], i: 1.0, flicker: 0.12 },
      { x: 925, y: 160, z: 90, r: 560, c: [1, 0.6, 0.3], i: 1.2 },
      { x: 805, y: 100, z: 80, r: 300, c: [0.3, 1, 0.8], i: 0.45 },
      { x: 1190, y: 620, z: 40, r: 340, c: [0.75, 0.35, 1], i: 1.0, flicker: 0.2 },
    ],
    puddles: [[655, 525, 270, 72, 0.95], [770, 668, 260, 52, 0.85], [962, 405, 115, 30, 0.8], [600, 362, 125, 20, 0.7], [350, 468, 90, 22, 0.75], [140, 540, 90, 30, 0.5]],
    wetFrom: 330, wet: 0.32, ripple: 1, grade: 'rgba(40,60,140,.12)',
  },
}
export const ACCENT: Record<string, [number, number, number]> = {
  rion: [0.78, 0.96, 0.23], seren: [0.62, 0.72, 1], ian: [0.94, 0.47, 0.18], kanna: [0.94, 0.35, 0.27],
}
/** 원근: 화면 위(먼 곳)는 작게, 아래(가까운 곳)는 크게. 배경마다 그림의 원근에 맞춘 범위를 쓴다(setPersp) */
let PERSP: [number, number] = [0.68, 1.22]
export const setPersp = (p?: [number, number]) => { PERSP = p ?? [0.68, 1.22] }
export const depthScale = (y: number) => PERSP[0] + Math.max(0, Math.min(1, (y - 300) / 390)) * (PERSP[1] - PERSP[0])
