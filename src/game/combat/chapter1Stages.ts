// 1장 「끊어진 신호」 전투 스테이지 5종. 같은 전투 규칙 위에서 목표·적·장치만 바꿔 판단을 다르게 만든다.
import type { StageDef, Sim } from './sim'

const alive = (s: Sim, k: string) => s.units.some((u) => u.kind === k && u.dead === 0 && !u.entering)
const casting = (s: Sim) => s.units.some((u) => u.side === 'enemy' && u.dead === 0 && u.tele && (u.tele.k === 'cast' || u.tele.k === 'call' || u.tele.k === 'noise'))
const anyTele = (s: Sim) => s.units.some((u) => u.side === 'enemy' && u.dead === 0 && u.tele)
const noDowns = { label: '쓰러진 대원 없음', ok: (s: Sim) => s.cnt.downs === 0 }

export const STAGES: Record<string, StageDef> = {
  // 1-2 일반 전투: 기본 조작(액티브 카드)과 예고 읽기
  'c1-2': {
    id: 'c1-2', title: '차단된 교차로', bg: 'street', goal: 'eliminate', goalText: '교차로의 괴이 제압', limit: 120, lv: 0.85,
    waves: [
      [{ k: 'hound', lane: 0 }, { k: 'hound', lane: 1 }, { k: 'hound', lane: 2 }],
      [{ k: 'hound', lane: 0 }, { k: 'golem', lane: 1, x: 1000 }, { k: 'hound', lane: 2 }],
    ],
    tips: [
      { id: 'card', when: (s) => s.t > 2.5, text: '아래 카드를 누르면 대원의 액티브 스킬. 기본 공격은 저절로 나갑니다', at: 'card', ref: 'rion', slow: true },
      { id: 'tele', when: anyTele, text: '바닥의 빨간 표시 = 곧 공격. 집중 공격으로 피해를 쌓거나 세렌의 기절로 끊을 수 있어요', at: 'enemy', slow: true },
      { id: 'golem', when: (s) => alive(s, 'golem'), text: '결정 거인의 강타는 아프다. 이안의 방벽 전개로 미리 막아 두세요', at: 'card', ref: 'ian' },
    ],
    stars: [{ label: '교차로 확보', ok: () => true }, noDowns, { label: '90초 안에 클리어', ok: (s) => s.t <= 90 }],
  },
  // 1-4 목표 전투(방어): 중계기를 지키며 75초 버티기 — 적 탭(집중 공격)·이안 버프
  'c1-4': {
    id: 'c1-4', title: '끊긴 신호', bg: 'alley', goal: 'defend', goalText: '중계기 재가동까지 75초 지키기', limit: 75, defendT: 75, lv: 0.95,
    homes: { ian: [560, 440], seren: [500, 320], rion: [470, 600], kanna: [215, 395] },
    devices: [{ id: 'relay', k: 'relay', x: 330, y: 480, max: 3000, lane: 1, label: '중계기' }],
    timeline: [
      { t: 1, spawn: [{ k: 'hound', lane: 0 }, { k: 'hound', lane: 2 }] },
      { t: 12, spawn: [{ k: 'mite', lane: 0 }, { k: 'mite', lane: 1 }, { k: 'mite', lane: 2 }] },
      { t: 24, spawn: [{ k: 'hound', lane: 1 }, { k: 'mite', lane: 0 }, { k: 'mite', lane: 2 }] },
      { t: 36, spawn: [{ k: 'golem', lane: 1, x: 980 }, { k: 'mite', lane: 0 }, { k: 'mite', lane: 2 }, { k: 'mite', lane: 1 }] },
      { t: 50, spawn: [{ k: 'orb', lane: 0, x: 1120 }, { k: 'hound', lane: 2 }, { k: 'mite', lane: 1 }, { k: 'mite', lane: 2 }] },
      { t: 61, spawn: [{ k: 'mite', lane: 0 }, { k: 'mite', lane: 1 }, { k: 'mite', lane: 2 }, { k: 'mite', lane: 1 }] },
    ],
    tips: [
      { id: 'mite', when: (s) => alive(s, 'mite'), text: '노란 표시 = 중계기를 노리는 잠식충. 그 적을 눌러 팀 전체가 집중 공격하게 하세요', at: 'enemy', ref: 'mite', slow: true },
      { id: 'buff', when: (s) => s.t > 26, text: '카드를 위로 밀면 버프. 이안의 「보호 구역」은 중계기를 방벽으로 감쌉니다', at: 'card', ref: 'ian', slow: true },
    ],
    stars: [{ label: '중계기 지키기', ok: () => true }, { label: '중계기 체력 50% 이상', ok: (s) => s.cnt.relayMin >= 0.5 }, noDowns],
  },
  // 1-5 일반 전투: 시전(머리 위 게이지) 끊기 — 라온의 음파는 두 배로 흔든다
  'c1-5': {
    id: 'c1-5', title: '신호를 따라서', bg: 'alley', goal: 'eliminate', goalText: '골목의 괴이 제압', limit: 120, lv: 1,
    waves: [
      [{ k: 'orb', lane: 0, x: 1100 }, { k: 'hound', lane: 1 }, { k: 'orb', lane: 2, x: 1140 }],
      [{ k: 'golem', lane: 1, x: 1000 }, { k: 'orb', lane: 0, x: 1150 }, { k: 'hound', lane: 2 }, { k: 'hound', lane: 0 }],
      [{ k: 'orb', lane: 0, x: 1120 }, { k: 'orb', lane: 1, x: 1180 }, { k: 'orb', lane: 2, x: 1120 }, { k: 'golem', lane: 1, x: 960 }],
    ],
    tips: [
      { id: 'cast', when: casting, text: '머리 위 보라 게이지 = 시전. 다 차기 전에 피해를 쌓으면 끊깁니다. 라온의 음파는 두 배로 흔들어요', at: 'enemy', ref: 'orb', slow: true },
      { id: 'buff', when: (s) => s.wave >= 2, text: '카드를 위로 밀어 버프: 라온 「볼륨 업」, 세렌 「고요한 밤」으로 화력을 몰아 주세요', at: 'card', ref: 'rion' },
    ],
    stars: [{ label: '골목 확보', ok: () => true }, { label: '시전 끊기 3회 이상', ok: (s) => s.cnt.breaks >= 3 }, noDowns],
  },
  // 1-6 목표 전투(제압): 호출 결정체를 노리면서 셔터 장치로 증원 길을 막기
  'c1-6': {
    id: 'c1-6', title: '봉쇄', bg: 'substation', goal: 'target', goalText: '호출 결정체 제압', limit: 150, lv: 1.05,
    devices: [
      { id: 'sh0', k: 'shutter', x: 1010, y: 300, max: 1, lane: 0, label: '윗길 셔터' },
      { id: 'sh2', k: 'shutter', x: 1010, y: 668, max: 1, lane: 2, label: '아랫길 셔터' },
    ],
    waves: [[{ k: 'caller', lane: 1, x: 1160, y: 470 }, { k: 'hound', lane: 0 }, { k: 'hound', lane: 2 }, { k: 'orb', lane: 1, x: 1060 }]],
    tips: [
      { id: 'caller', when: (s) => alive(s, 'caller'), text: '호출 결정체가 증원을 부릅니다. 눌러서 집중 공격하세요 — AUTO는 대신 골라 주지 않아요', at: 'enemy', ref: 'caller', slow: true },
      { id: 'shutter', when: (s) => s.units.some((u) => u.kind === 'caller' && u.tele?.k === 'call'), text: '셔터 장치를 누르면 가까운 대원이 달려가 그 길을 20초 막습니다', at: 'device', ref: 'sh0', slow: true },
    ],
    stars: [{ label: '호출 결정체 제압', ok: () => true }, { label: '셔터 1회 이상 사용', ok: (s) => s.cnt.shutter >= 1 }, { label: '100초 안에 클리어', ok: (s) => s.t <= 100 }],
  },
  // 1-7 보스: 스태틱 — 3페이즈(강타·돌진 → 중계 기둥 → 전역 노이즈)
  'c1-7': {
    id: 'c1-7', title: '스태틱', bg: 'substation', goal: 'boss', goalText: '위험 등급 6 · 스태틱 토벌', limit: 180, lv: 1,
    waves: [[{ k: 'boss', lane: 1, x: 1000, y: 480 }]],
    tips: [
      { id: 'boss', when: (s) => alive(s, 'boss'), text: '스태틱의 강타·돌진은 끊을 수 없습니다. 이안의 방벽과 칸나의 회복으로 버티세요', at: 'card', ref: 'ian' },
      { id: 'pylon', when: (s) => alive(s, 'pylon'), text: '중계 결정 기둥이 서 있는 동안 스태틱은 피해를 70% 덜 받습니다. 기둥을 눌러 먼저 부수세요', at: 'enemy', ref: 'pylon', slow: true },
      { id: 'noise', when: (s) => s.units.some((u) => u.tele?.k === 'noise'), text: '전역 노이즈! 게이지가 차기 전에 끊으면 스태틱이 6초간 무력화됩니다. 세렌의 기절, 라온의 음파!', at: 'enemy', ref: 'boss', slow: true },
    ],
    stars: [{ label: '스태틱 토벌', ok: () => true }, { label: '전역 노이즈 끊기 1회 이상', ok: (s) => s.cnt.noiseBreaks >= 1 }, noDowns],
  },
}
