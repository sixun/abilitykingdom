// 역 로비 테마 + 캐릭터 상세(원본 재현) 검증. dev 서버 실행 중에: node tests/station-and-detail.mjs [BASE]
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1672, height: 941 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push('CONSOLE ' + m.text()) })
const st = () => page.evaluate(() => window.__AK__.getState())
let fails = 0
const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++ }
const W = (ms = 500) => page.waitForTimeout(ms)
const SOFA = '.screen-active button[aria-label="더보기 메뉴"]'
const STATION = '.screen-active button[aria-label="전체 메뉴"]'
const has = async (sel) => (await page.locator(sel).count()) > 0
const back = async () => {
  if (await has('.modal')) { await page.keyboard.press('Escape'); await W(300); return }
  await page.click('.screen-active .back-btn, .screen-active button[aria-label="돌아가기"], .screen-active button[aria-label="뒤로"]'); await W(700)
}

// 1) 테마 전환·저장
await page.goto(BASE + '?screen=lobby'); await W(2200)
check(await has(SOFA), '기본 테마 = 카페(소파) 로비')
await page.click('.screen-active button[aria-label^="로비 테마 변경"]'); await W(700)
check(await has(STATION) && (await st()).lobby.theme === 'station', '버튼으로 역 로비 전환·저장')
await page.reload(); await W(2200)
check(await has(STATION), '새로고침 후에도 역 로비 유지')

// 2) 25개 버튼 목적지 + 복귀 후 로비 유지
const targets = [
  ['프로필', '.profile'], ['다이아', '.shop'], ['크레딧', '.modal h2:has-text("크레딧")'], ['공지', '.ops'], ['우편', '.ops'],
  ['전체 메뉴', '.rs-menu'], ['픽업 영입', 'button.hit-pull10'], ['메인 목표', '.ct-story'], ['출석 이벤트', '.att'], ['메시지', '.modal h2:has-text("메시지")'],
  ['이벤트', '.ops'], ['쿠폰 이벤트', '.modal input[aria-label="쿠폰 코드"]'], ['코스튬', '.modal h2:has-text("코스튬")'], ['아레나', '.ct-arena'], ['레이드', '.ct-raid'],
  ['현상수배', '.ct-wanted'], ['상점', '.shop'], ['훈련', '.ct-training'], ['도시 탐색', '.ct-explore'], ['스토리', '.ct-story'],
  ['캐릭터', '.chars'], ['편성', 'button.fm-save'], ['홈', STATION], ['가방', '.bag'], ['영입', 'button.hit-pull10'],
]
for (const [label, dest] of targets) {
  await page.click(`.screen-active button[aria-label^="${label}"]`); await W(650)
  const ok = await has(dest)
  if (label === '전체 메뉴') { check(ok, `${label} → 메뉴 열림`); await page.click(STATION); await W(300); continue }
  if (label === '홈') { check(ok, '홈 = 현재 로비 유지'); continue }
  check(ok, `${label} → ${dest}`)
  await back()
  check(await has(STATION), `  ${label}에서 복귀 시 역 로비 유지`)
}

// 3) 겹친 카드 우선순위: 현상수배가 상점보다 앞
await page.mouse.click(300, 625); await W(650)
check(await has('.ct-wanted'), '현상수배·상점 겹친 영역 클릭 = 현상수배')
await back()

// 4) 메인 목표 = 첫 미클리어 스테이지 상세(전투 자동 시작 안 함)
await page.click('.screen-active button[aria-label^="메인 목표"]'); await W(700)
check(await has('.ct-story') && !(await has('.battle')), '메인 목표 → 스토리 스테이지 상세, 전투 자동 시작 없음')
await back()

// 5) 우편 수령 → 우편 알림 사라짐(원본 점 그림 재사용)
check(await has('img[src*="badge-notice-sprite"]'), '받을 우편이 있으면 우편 알림 표시')
await page.click('.screen-active button[aria-label^="우편"]'); await W(700)
await page.click('.screen-active button:has-text("모두 받기")'); await W(900)
const mailLeft = (await st()).mails.filter((m) => !m.claimed).length
await back()
check(mailLeft === 0 && !(await has('img[src*="badge-notice-sprite"]')), '우편 수령 후 알림 사라짐')

// 6) 캐릭터 대사(1.5초 간격)
await page.mouse.click(760, 480); await W(200)
check(await has('.rs-line'), '정면 캐릭터 클릭 → 준비된 대사 표시(음성 없음)')

// 7) 메뉴에서 카페 로비로 되돌리기
await page.click(STATION); await W(250)
await page.click('.rs-menu button:has-text("카페 로비로")'); await W(700)
check(await has(SOFA) && (await st()).lobby.theme === 'sofa', '메뉴에서 카페 로비로 복귀')
await page.click('.screen-active button[aria-label^="로비 테마 변경"]'); await W(700)

// 8) 캐릭터 상세
await page.click('.screen-active button[aria-label^="캐릭터"]'); await W(700)
await page.click('.ccard:has-text("지안")'); await W(800)
check(!(await has('img[src*="textless/stat-"]')) && !(await has('img[src*="textless/level-text"]')), '지안 Lv.40: 능력치·레벨은 원본 조각 그대로')
check(await has('.cd2-lobby-t:has-text("LOBBY ACTIVE")'), '현재 로비 캐릭터 = LOBBY ACTIVE')
check(await page.locator('.screen-active button[aria-label="목록 앞으로"]').isDisabled(), '목록 처음에서 앞으로 버튼 비활성')
const cr0 = (await st()).wallet.credit
await page.click('.screen-active button[aria-label^="UPGRADE"]'); await W(300)
await page.click('.modal button:has-text("CANCEL")'); await W(300)
check((await st()).wallet.credit === cr0 && (await st()).owned.jian.level === 40, 'CANCEL은 아무것도 차감하지 않음')
await page.click('.screen-active button[aria-label^="UPGRADE"]'); await W(300)
await page.keyboard.press('Escape'); await W(300)
check(!(await has('.modal')), 'Esc로 성장 창 닫기')
await page.click('.screen-active button[aria-label^="UPGRADE"]'); await W(300)
await page.click('.modal .btn-primary'); await W(800)
let s = await st()
check(s.owned.jian.level === 41 && s.wallet.credit < cr0, `CONFIRM 후 Lv.40 → ${s.owned.jian.level}`)
check(await has('img[src*="textless/stat-hp"]') && await has('img[src*="textless/level-text"]'), '값이 바뀐 칸만 글자 없는 패치 + 실제 텍스트로 교체')
await page.click('.screen-active button[aria-label="목록 뒤로"]'); await W(200)
await page.click('.screen-active button[aria-label="목록 뒤로"]'); await W(200)
check(await page.locator('.screen-active button[aria-label="목록 뒤로"]').isDisabled(), '목록 끝에서 뒤로 버튼 비활성(무한 순환 없음)')
await page.click('.screen-active button[aria-label^="리온"]'); await W(500)
check(await has('.cd2-lv:has-text("NOT OWNED")') && await page.locator('.screen-active button[aria-label^="UPGRADE"]').isDisabled(), '미보유 캐릭터: NOT OWNED, UPGRADE 비활성')
await page.click('.screen-active button[aria-label^="하린"]'); await W(500)
check(await page.locator('.screen-active button[aria-label^="로비 캐릭터로 설정"]').isDisabled(), '로비 그림 없는 캐릭터는 로비 설정 비활성')
await page.click('.screen-active button[aria-label^="GEAR"]'); await W(400)
check(await page.locator('.cd2-row').count() === 3 && await has('.cd2-name'), 'GEAR: 장비 3칸, 왼쪽·상단 고정')
await page.click('.screen-active button[aria-label="뒤로"]'); await W(700)
check(await has('.chars'), '뒤로 → 캐릭터 목록')

// 9) 키보드·동작 줄이기
await page.keyboard.press('Tab'); await W(100)
check(await page.evaluate(() => document.activeElement?.tagName === 'BUTTON'), '키보드 Tab으로 버튼 포커스')
const p2 = await (await browser.newContext({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce' })).newPage()
await p2.goto(BASE + '?screen=lobby'); await p2.waitForTimeout(1500)
await p2.evaluate(() => window.__AK__.setLobbyTheme('station')); await p2.waitForTimeout(600)
check(await p2.evaluate(() => getComputedStyle(document.querySelector('.mg')).animationName === 'none' && !document.querySelector('video.mv')), '동작 줄이기: 진입 효과 끔·영상 대신 정지 포스터')

console.log('errors:', errs.length ? errs : 'none')
console.log('FAILS', fails)
await browser.close()
process.exit(fails ? 1 : 0)
