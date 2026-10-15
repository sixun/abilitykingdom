// 1장 「끊어진 신호」 사건 파일: 노드 8개(스토리 2 · 조사 1 · 전투 5).
// 출연진: 라온·세렌·이안·칸나(1장 지정 편성 · 체험 대원), 본부 관제(목소리만). 플레이어는 현장팀장.
import type { Reward } from '../types'

export type Speaker = 'rion' | 'seren' | 'ian' | 'kanna' | 'hq'
export interface Line { who?: Speaker; text: string; fx?: 'shake' | 'flash' | 'static' | 'core'; sys?: boolean }
export interface Hotspot { id: string; x: number; y: number; r: number; label: string; lines: Line[] }
export interface CaseNode {
  id: string; no: string; kind: 'story' | 'investigate' | 'battle' | 'objective' | 'boss'
  title: string; place: string; summary: string
  bg: 'street' | 'alley' | 'substation'
  script?: Line[] // 스토리·조사 도입
  hotspots?: Hotspot[]; outro?: Line[] // 조사
  pre?: Line[]; post?: Line[] // 전투 전후
  rewards: Reward[]
  cast: Speaker[] // 이 노드에 나오는 인물
}

export const SPEAKER: Record<Speaker, { name: string; img: string | null; color: string }> = {
  rion: { name: '라온', img: 'assets/chars/rion_stand.webp', color: '#c8f53b' },
  seren: { name: '세렌', img: 'assets/chars/seren_stand.webp', color: '#9fb3e6' },
  ian: { name: '이안', img: 'assets/chars/ian_stand.webp', color: '#f0782f' },
  kanna: { name: '칸나', img: 'assets/chars/chaerin_stand.webp', color: '#ef5a45' },
  hq: { name: '본부 관제', img: null, color: '#7fd6ff' },
}
export const BG_IMG = { street: 'ref/battle/plate.webp', alley: 'ref/ch1/alley.webp', substation: 'ref/ch1/substation.webp' }

const n = (text: string): Line => ({ text })
export const CHAPTER1 = {
  id: 'case1', no: 'CASE 01', title: '끊어진 신호', area: '성수 구역',
  summary: '성수 구역의 통신망이 한꺼번에 끊겼다. 노이즈 속에서 같은 박자의 신호가 반복된다.',
  nodes: [
    {
      id: 'c1-1', no: '1-1', kind: 'story', title: '출동 명령', place: '성수역 교차로', bg: 'street', cast: ['hq', 'ian', 'kanna', 'seren', 'rion'],
      summary: '통신이 끊긴 성수 구역으로 현장팀이 출동한다.',
      script: [
        n('— 성수 구역, 해 질 녘. 신호등이 전부 노란 불로 깜빡이고 있다.'),
        { who: 'hq', text: '현장팀장님, 성수 구역 통신망이 3시간째 응답이 없습니다. 기지국 일곱 곳이 한꺼번에 꺼졌어요.', fx: 'static' },
        { who: 'hq', text: '구역 안에 있던 순찰 요원과도 연락이 끊겼습니다. 현장 확인을 부탁드립니다.' },
        { who: 'ian', text: '막차 끊길 시간에 통신까지 끊겼다… 사람들 많이 불안하겠네.' },
        { who: 'kanna', text: '오락실 네트워크도 다 죽었어! 하이스코어 저장도 안 된다고!' },
        { who: 'seren', text: '하늘이 무거워. 곧 비가 올 거야.' },
        { who: 'rion', text: '잠깐. 다들 조용히 해 볼래?' },
        { who: 'rion', text: '끊긴 게 아니야. 노이즈 속에… 박자가 있어. 누가 같은 신호를 계속 보내고 있어.', fx: 'static' },
        { who: 'hq', text: '확인했습니다. 02시 13분부터 같은 주파수가 반복 수신되고 있어요. 발신지는 불명입니다.' },
        { who: 'ian', text: '그럼 할 일은 정해졌네. 팀장, 뒤는 내가 맡을게.' },
        { who: 'hq', text: '성수역 교차로부터 진입해 주세요. 괴이 반응이 있습니다. 위험 등급은 아직 측정 중입니다.' },
      ],
      rewards: [{ kind: 'currency', id: 'credit', qty: 1000 }],
    },
    {
      id: 'c1-2', no: '1-2', kind: 'battle', title: '차단된 교차로', place: '성수역 교차로', bg: 'street', cast: ['seren', 'kanna', 'rion', 'hq'],
      summary: '교차로를 막은 결정 사냥개 무리를 정리한다. 카드로 스킬을 쓰고, 바닥의 빨간 예고를 읽는다.',
      pre: [
        n('교차로 한가운데, 보라색 결정이 아스팔트를 뚫고 자라 있다.'),
        { who: 'seren', text: '결정 사냥개. 무리 지어 다니는 놈들이야.' },
        { who: 'kanna', text: '튜토리얼 스테이지네. 한 판 금방이지!' },
      ],
      post: [
        { who: 'rion', text: '교차로 정리 완료. 노이즈는… 오히려 더 커졌어. 북쪽 골목이야.' },
        { who: 'hq', text: '비구름이 들어옵니다. 시야 확보에 주의하세요.' },
      ],
      rewards: [{ kind: 'currency', id: 'credit', qty: 1500 }, { kind: 'item', id: 'exp_s', qty: 3 }],
    },
    {
      id: 'c1-3', no: '1-3', kind: 'investigate', title: '쓰러진 중계기', place: '연무장길 뒷골목', bg: 'alley', cast: ['ian', 'hq', 'kanna', 'rion', 'seren'],
      summary: '비 갠 골목에서 순찰대의 휴대 중계기를 발견한다. 세 곳을 조사한다.',
      script: [
        n('— 연무장길 뒷골목. 비가 막 그쳤다. 네온 간판이 물웅덩이마다 두 번씩 켜져 있다.'),
        { who: 'ian', text: '저기, 순찰대 휴대 중계기야. 쓰러져 있는데.' },
        { who: 'hq', text: '중계기 주변을 조사해 주세요. 마지막 기록이 남아 있을 수 있습니다.' },
        { text: '화면에서 빛나는 곳 세 군데를 눌러 조사하세요.', sys: true },
      ],
      hotspots: [
        { id: 'panel', x: 560, y: 470, r: 70, label: '중계기 화면', lines: [
          { who: 'kanna', text: '전원은 살아 있는데 회로가 막혔어. 화면에 같은 글자만 반복돼.' },
          n('로그: 02:13 수신 / 02:13 수신 / 02:13 수신 / 02:13 수신 …'),
          { who: 'rion', text: '아까 들은 박자랑 똑같아.', fx: 'static' },
        ] },
        { id: 'trace', x: 1150, y: 600, r: 80, label: '결정 자국', lines: [
          { who: 'seren', text: '물웅덩이에 결정 가루. 무언가 여기서 물을 따라 움직였어.' },
          { who: 'seren', text: '자국은 동쪽으로 이어져. 변전소 방향이야.' },
        ] },
        { id: 'wire', x: 110, y: 170, r: 75, label: '전신주 전선', lines: [
          { who: 'ian', text: '전선 끝이 전부 결정으로 변했어. 신호를 먹고 자란 것처럼.' },
          { who: 'hq', text: '…신호를 먹는 괴이라면 기록이 있어요. 위험 등급 6, 「스태틱」 계열.' },
        ] },
      ],
      outro: [
        { who: 'kanna', text: '중계기는 내가 큐브로 회로를 접어서 우회시킬게. 재가동까지 75초!' },
        { who: 'rion', text: '그동안 내가 주파수를 맞출게. 신호가 어디서 오는지 잡아 낼 거야.' },
        { who: 'ian', text: '75초. 그동안은 아무것도 못 지나가.' },
        { who: 'seren', text: '…온다. 결정 냄새.', fx: 'shake' },
      ],
      rewards: [{ kind: 'currency', id: 'diamond', qty: 30 }, { kind: 'item', id: 'part', qty: 2 }],
    },
    {
      id: 'c1-4', no: '1-4', kind: 'objective', title: '끊긴 신호', place: '연무장길 뒷골목', bg: 'alley', cast: ['hq', 'rion'],
      summary: '중계기가 재가동되는 75초 동안 지킨다. 중계기를 노리는 잠식충은 눌러서 집중 공격.',
      pre: [{ who: 'hq', text: '괴이 접근! 중계기를 노리는 소형 개체가 섞여 있습니다.' }],
      post: [
        n('중계기 화면이 초록색으로 바뀐다. 로그 마지막 줄에 좌표가 찍혀 있다.'),
        { who: 'hq', text: '수신 완료. 좌표는… 성수 제2 변전소. 폐쇄된 시설입니다.' },
        { who: 'rion', text: '신호의 박자, 이제 확실히 들려. 누군가를 「부르는」 소리야.' },
      ],
      rewards: [{ kind: 'currency', id: 'credit', qty: 2000 }, { kind: 'item', id: 'exp_s', qty: 4 }],
    },
    {
      id: 'c1-5', no: '1-5', kind: 'battle', title: '신호를 따라서', place: '변전소 가는 골목', bg: 'alley', cast: ['seren', 'rion', 'kanna', 'ian'],
      summary: '시전하는 결정 구체가 나온다. 머리 위 게이지가 차기 전에 끊는다.',
      pre: [
        { who: 'seren', text: '변전소까지 골목 두 개. 위에 떠 있는 결정… 저건 노래를 하네.' },
        { who: 'rion', text: '노래? 아, 시전이구나. 그럼 내 음파로 박자를 망쳐 주면 되지.' },
      ],
      post: [
        { who: 'kanna', text: '골목 클리어! 다음은 보스 방이겠지?' },
        { who: 'ian', text: '보스 전에 문이 하나 더 있어. 쉽게 열어 줄 것 같진 않네.' },
      ],
      rewards: [{ kind: 'currency', id: 'credit', qty: 2000 }, { kind: 'item', id: 'exp_m', qty: 2 }],
    },
    {
      id: 'c1-6', no: '1-6', kind: 'objective', title: '봉쇄', place: '성수 제2 변전소', bg: 'substation', cast: ['hq', 'ian', 'rion'],
      summary: '증원을 부르는 호출 결정체를 제압한다. 셔터 장치로 증원 길을 막을 수 있다.',
      pre: [
        n('— 성수 제2 변전소. 바닥에 물이 얕게 고여 있고, 벽마다 결정이 자라 있다.'),
        n('들어서자마자 양쪽 통로 너머에서 무언가가 기어 오는 소리가 난다.'),
        { who: 'hq', text: '중앙의 결정체가 주변 괴이를 부르고 있어요. 위아래 통로에 비상 셔터 장치가 있습니다.' },
        { who: 'ian', text: '셔터는 꼭 내가 아니어도 돼. 제일 가까운 사람이 당기면 돼.' },
      ],
      post: [
        n('호출 결정체가 부서지자 변전소 안쪽에서 낮은 진동이 울린다.', ),
        { who: 'rion', text: '…박자가 멈췄어. 이제 저쪽이 우리를 듣고 있어.', fx: 'shake' },
      ],
      rewards: [{ kind: 'currency', id: 'credit', qty: 2500 }, { kind: 'item', id: 'exp_m', qty: 2 }],
    },
    {
      id: 'c1-7', no: '1-7', kind: 'boss', title: '스태틱', place: '변전소 중앙 홀', bg: 'substation', cast: ['hq', 'seren', 'kanna'],
      summary: '위험 등급 6 · 우호도 레드. 통신을 먹고 자란 괴이를 토벌한다. 클리어하면 코어 슬롯 1 해금.',
      pre: [
        n('변압기 사이에서, 등에 안테나 같은 결정 가시를 단 괴이가 몸을 일으킨다.', ),
        { who: 'hq', text: '확인. 위험 등급 6, 우호도 레드. 개체명 「스태틱」. 주변 통신을 먹고 자란 괴이입니다.', fx: 'static' },
        { who: 'seren', text: '비는 그쳤어. 끝내자.' },
        { who: 'kanna', text: '보스전 음악 나와라!' },
      ],
      rewards: [{ kind: 'currency', id: 'diamond', qty: 100 }, { kind: 'item', id: 'exp_m', qty: 4 }],
    },
    {
      id: 'c1-8', no: '1-8', kind: 'story', title: '잔향', place: '변전소 중앙 홀', bg: 'substation', cast: ['ian', 'hq', 'kanna', 'rion', 'seren'],
      summary: '사건의 끝, 그리고 다음 신호.',
      script: [
        n('스태틱이 무너지며 변전소의 결정들이 한꺼번에 빛을 잃는다.'),
        n('잔해 한가운데, 손바닥만 한 결정 핵이 아직 희미하게 뛰고 있다.'),
        { who: 'ian', text: '이건… 심장 같은 건가. 아직 따뜻해.' },
        { who: 'hq', text: '결정 핵 회수를 권장합니다. 연구소에서 팀 장비로 가공할 수 있어요.' },
        { text: '코어 슬롯 1 해금 — 결정 핵이 팀 코어로 가공되었습니다.', sys: true, fx: 'core' },
        { who: 'kanna', text: '레어 드랍이다!' },
        { who: 'rion', text: '근데… 스태틱이 신호를 「보낸」 게 아니었어.' },
        { who: 'rion', text: '그냥 먹고 있었을 뿐이야. 진짜 신호는 아직 어딘가에서 오고 있어.', fx: 'static' },
        { who: 'hq', text: '…반복 신호를 해독했습니다. 내용은 한 줄입니다.' },
        n('「앙코르를 기다립니다. — 부평 구역, 공연장」'),
        { who: 'seren', text: '초대장이네. 받을 사람이 누군지는 모르겠지만.' },
        { who: 'ian', text: '팀장, 막차는 끊겨도 길은 남아 있잖아. 다음 역으로 가자.' },
        n('CASE 01 · 끊어진 신호 — 종결'),
      ],
      rewards: [{ kind: 'currency', id: 'diamond', qty: 50 }],
    },
  ] as CaseNode[],
}
export const CASE_NODE = Object.fromEntries(CHAPTER1.nodes.map((x) => [x.id, x])) as Record<string, CaseNode>
export const CORE_NODE = 'c1-7' // 챕터 마지막 보스: 첫 클리어에 코어 슬롯 1 해금(확정 규칙)
