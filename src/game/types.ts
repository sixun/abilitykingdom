// 데이터 책임 분리 기준(기획서 14항). DB 스키마 확정이 아니라 클라이언트/서비스 경계용 타입이다.

export type RoleId = 'attack' | 'defense' | 'ability' | 'support'
export type AttributeId = 'blade' | 'barrier' | 'sound' | 'gravity' | 'vital' | 'pulse' | 'space' | 'star' | 'mist' | 'spirit' | 'tide'
export type CurrencyId = 'diamond' | 'credit' | 'ticket' | 'scoutPoint' | 'exchangeMedal' | 'stamina'
export type EntranceStyle = 'slash' | 'barrier' | 'burst' | 'heal' | 'warp' | 'spin' | 'wave' | 'slam'

export interface CharacterDefinition {
  id: string
  name: string
  nameEn: string
  role: RoleId
  attribute: AttributeId
  rarity: number // 샘플 희귀도(★). 희귀도 체계는 미정
  accent: string
  tagline: string
  profile: { affiliation: string; ability: string; note: string }
  skills: { name: string; kind: '기본' | '스킬' | '궁극기' | '패시브'; desc: string }[]
  /** Lv.40 기준 수치(장비 제외). 다른 레벨은 rules.statsOf가 비례 계산. 샘플 값 */
  baseStats: { hp: number; atk: number; def: number }
  /** 치명 확률·치명 피해(%)·속도. 샘플 값(밸런스 미정) */
  subStats: { critRate: number; critDmg: number; speed: number }
  /** 캐릭터 상세(영문 표기 화면)용 소속·한 줄 소개. 샘플 */
  en: { unit: string; motto: string }
  assets: {
    portrait: string
    stand: string // 편성·상세(기본/장비/성장)용 전신
    action: string // 로비 등장·스킬 탭·영입용 동작 포즈
  }
  /** 편성 슬롯 배치 보정. 슬롯 기준 위치에 더해진다. */
  formation: { scale: number; offsetX: number; offsetY: number; faceY: number }
  lobby: { entrance: EntranceStyle; idle: 'sway' | 'breath' | 'bob' }
  idleSeed: number
  /** 설정 미확정 캐릭터(신규 추가 패키지). 이름·역할·희귀도·수치·스킬·획득 경로가 정해지지 않아 화면에 표시하지 않는다.
   *  role/attribute/rarity/baseStats 등은 형식을 맞추기 위한 자리값이며 게임 데이터로 쓰지 않는다. 영입 풀·교환소에 넣지 않는다 */
  pending?: true
  /** Ex(강화 버전) 여부. Ex 체계는 아직 정해지지 않아 현재 데이터에는 없다(목록의 Ex 필터·배지만 준비) */
  ex?: true
}

export interface EquipmentSlots {
  weapon: string | null
  gear: string | null
  accessory: string | null
}

export interface OwnedCharacter {
  id: string
  level: number
  obtainedAt: number
  dupes: number // 중복 획득 기록. 전환 규칙은 미정이므로 기록만 한다
  equipment: EquipmentSlots
}

export interface TeamPreset {
  id: string
  name: string
  slots: (string | null)[]
  leaderId: string | null
  version: number
  savedAt: number
}

export type LobbyTheme = 'sofa' | 'station'

export interface LobbyPreference {
  characterId: string
  /** 로비 테마(소파 카페 / 역 승강장). 없으면 sofa */
  theme?: LobbyTheme
  background: 'lobby'
  entrancePolicy: 'first-and-change' | 'always' | 'never'
  lastEntranceFor: string | null
}

export type ItemCategory = 'equipment' | 'consumable' | 'material'

export interface ItemDefinition {
  id: string
  name: string
  category: ItemCategory
  desc: string
  icon: string // 이모지 대신 아이콘 키
  rarity: number
  equipSlot?: keyof EquipmentSlots
  bonus?: { hp?: number; atk?: number; def?: number }
  use?: { grant: Partial<Record<CurrencyId, number>> }
  expValue?: number
}

export interface InventoryEntry { itemId: string; qty: number; locked?: boolean }

export interface RecruitmentBanner {
  id: string
  kind: 'limited' | 'standard'
  title: string
  subtitle: string
  featuredId: string
  pool: string[]
  start: string
  end: string | null
  costPerPull: { currency: CurrencyId; amount: number }
  rates: { rarity: number; rate: number }[] // 프로토타입 샘플 값
  pickupShare: number
  skin: 'broadcast' | 'platform' | 'scene'
  quote: string
}

export interface RecruitResultEntry { characterId: string; rarity: number; isNew: boolean; isPickup: boolean }

export interface RecruitmentTransaction {
  requestId: string
  bannerId: string
  count: number
  cost: { currency: CurrencyId; amount: number }
  results: RecruitResultEntry[]
  pointsGained: number
  status: 'granted'
  createdAt: number
}

export interface ShopProduct {
  id: string
  tab: 'recommend' | 'package' | 'currency' | 'exchange'
  name: string
  desc: string
  contents: { kind: 'currency'; id: CurrencyId; qty: number }[] | { kind: 'item'; id: string; qty: number }[] | ({ kind: 'currency'; id: CurrencyId; qty: number } | { kind: 'item'; id: string; qty: number })[]
  price: { type: 'currency'; currency: CurrencyId; amount: number } | { type: 'real'; krw: number }
  limit: number | null
  endsAt: string | null
  badge?: string
}

export interface PurchaseRecord { requestId: string; productId: string; createdAt: number }

export interface ContentProgress {
  storyCleared: string[]
  wins: number
  battles: { requestId: string; contentId: string; stageId: string; won: boolean; rewards: Reward[]; createdAt: number }[]
  arenaPoints: number
  arenaRecord: { win: number; lose: number }
  arenaDefenseTeam: string
  wantedCleared: string[]
  raidBest: Record<string, number>
  /** 사건 파일(인게임 스토리) 진행: 노드별 최고 별 수(스토리·조사 노드는 1), 이전 저장 데이터에는 없을 수 있다 */
  caseFile?: { stars: Record<string, number> }
}

export interface Reward { kind: 'currency' | 'item'; id: string; qty: number }

export interface MailEntry { id: string; title: string; body: string; from: string; rewards: Reward[]; claimed: boolean; receivedAt: number; expiresAt: string }

export type MissionMetric = 'saveTeam' | 'recruit' | 'battleWin' | 'purchase' | 'levelUp' | 'login'
export interface MissionDefinition { id: string; title: string; metric: MissionMetric; target: number; rewards: Reward[]; period: 'daily' | 'achievement' }
export interface MissionState { progress: Partial<Record<MissionMetric, number>>; claimed: string[]; day: string }

export interface Settings {
  bgm: number
  /** 로비 배경음악(LOBBY_TRACKS의 id, 'off' = 끔). 없으면 기본 곡 */
  lobbyBgm?: string
  sfx: number
  voice: number
  quality: 'high' | 'low'
  reduceMotion: boolean
  openingSeen: boolean
  /** 캐릭터 목록 화면 테마(목록 화면 안에서만 적용). 없으면 light */
  charListTheme?: 'light' | 'dark'
}

/** 팀장(플레이어) 프로필 — 이 기기에만 저장된다(서버 계정 미연동). 이전 저장 데이터에는 없을 수 있다 */
export interface CommanderProfile {
  /** 팀장 기본 아바타: 남성형 / 여성형 */
  avatar: 'm' | 'f'
  /** 장착한 프로필 아이콘: 'cmd-m' | 'cmd-f' | 'char:<캐릭터 id>'. 로비 원형 사진·대원증 사진이 이 값을 함께 쓴다 */
  iconId: string
  /** 자기소개(최대 40자) */
  bio: string
  /** 대표 칭호 id(없으면 null) */
  titleId: string | null
  /** 개인 프로필 전시 배경 id('none' = 기본) */
  backgroundId: string
  /** 대표 팀원 5칸(전투 편성과 별개) */
  showcase: (string | null)[]
}

export interface GameState {
  schema: number
  playerName: string
  playerLevel: number
  createdAt: number
  wallet: Record<CurrencyId, number>
  owned: Record<string, OwnedCharacter>
  teams: TeamPreset[]
  activeTeamId: string
  lobby: LobbyPreference
  inventory: InventoryEntry[]
  recruitTx: RecruitmentTransaction[]
  purchases: PurchaseRecord[]
  content: ContentProgress
  mails: MailEntry[]
  missions: MissionState
  attendance: { claimedDays: number; lastClaimDay: string | null }
  seenNotices: string[]
  seenEvents: string[]
  settings: Settings
  processed: Record<string, unknown> // requestId → 결과 (중복 요청 방지)
  /** 즐겨찾기한 캐릭터 id(보유 여부와 무관). 이전 저장 데이터에는 없을 수 있다 */
  favorites?: string[]
  /** 해금된 코어 슬롯 수(스토리 챕터 마지막 보스 첫 클리어마다 1). 이전 저장 데이터에는 없을 수 있다 */
  coreSlots?: number
  /** 팀장 프로필(처음 프로필 화면에서 기본 아바타를 고르면 생긴다) */
  commander?: CommanderProfile
}
