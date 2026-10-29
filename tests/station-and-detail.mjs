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

// 1) 로비 = 역 로비 하나(카페(소파) 로비는 2026-10-29 폐기). 예전에 'sofa'로 저장된 기기도 역 로비로 열린다
await page.goto(BASE + '?screen=lobby'); await W(2200)
check(await has(STATION) && !(await has(SOFA)), '로비 = 역 로비(카페 로비 없음)')
check(!(await has('.screen-active button[aria-label^="로비 테마 변경"]')), '로비 테마 전환 버튼 없음')
await page.evaluate(() => window.__AK__.setLobbyTheme('sofa')); await page.reload(); await W(2200)
check(await has(STATION), "'sofa'로 저장돼 있어도 역 로비")

// 2) 25개 버튼 목적지 + 복귀 후 로비 유지
const targets = [
  ['프로필', '.profile'], ['다이아', '.shop'], ['크레딧', '.modal h2:has-text("크레딧")'], ['공지', '.ops'], ['우편', '.ops'],
  ['전체 메뉴', '.rs-menu'], ['픽업 영입', 'button.hit-pull10'], ['메인 목표', '.story-field'], ['출석 이벤트', '.att'], ['메시지', '.modal h2:has-text("메시지")'],
  ['이벤트', '.ops'], ['쿠폰 이벤트', '.modal input[aria-label="쿠폰 코드"]'], ['코스튬', '.modal h2:has-text("코스튬")'], ['아레나', '.ct-arena'], ['레이드', '.ct-raid'],
  ['현상수배', '.ct-wanted'], ['상점', '.shop'], ['훈련', '.ct-training'], ['도시 탐색', '.ct-explore'], ['스토리', '.story-field'],
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

// 4) 메인 목표 = 스토리 탐색 필드(전투 자동 시작 안 함)
await page.click('.screen-active button[aria-label^="메인 목표"]'); await W(900)
check(await has('.story-field') && !(await has('.battle')), '메인 목표 → 스토리 탐색 필드, 전투 자동 시작 없음')
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

// 7) 전체 메뉴에 카페 로비 항목 없음(폐기)
await page.click(STATION); await W(250)
check(!(await has('.rs-menu button:has-text("카페 로비로")')), '전체 메뉴에 카페 로비 항목 없음')
await page.click(STATION); await W(250)

// 8) 캐릭터 상세(라온: 현재 로비 캐릭터, 보유 Lv.40)
await page.click('.screen-active button[aria-label^="캐릭터"]'); await W(700)
await page.click('.ccard:has-text("라온")'); await W(800)
check((await page.locator('.cd2-name').first().textContent()).replace(/\s/g, '').startsWith('RAON'), '상세: 라온(RAON) 표시')
check(await has('.cd2-lobby.on:has-text("LOBBY ACTIVE")'), '현재 로비 캐릭터 = LOBBY ACTIVE')
for (let i = 0; i < 20 && !(await page.locator('.screen-active button[aria-label="목록 앞으로"]').isDisabled()); i++) { await page.click('.screen-active button[aria-label="목록 앞으로"]'); await W(150) }
check(await page.locator('.screen-active button[aria-label="목록 앞으로"]').isDisabled(), '목록 처음에서 앞으로 버튼 비활성')
for (let i = 0; i < 20 && (await page.locator('.screen-active button[aria-label^="라온"]').count()) === 0; i++) { await page.click('.screen-active button[aria-label="목록 뒤로"]'); await W(150) }
await page.click('.screen-active button[aria-label^="라온"]'); await W(500)
const cr0 = (await st()).wallet.credit
await page.click('.screen-active button[aria-label^="UPGRADE"]'); await W(300)
await page.click('.modal button:has-text("CANCEL")'); await W(300)
check((await st()).wallet.credit === cr0 && (await st()).owned.rion.level === 40, 'CANCEL은 아무것도 차감하지 않음')
await page.click('.screen-active button[aria-label^="UPGRADE"]'); await W(300)
await page.keyboard.press('Escape'); await W(300)
check(!(await has('.modal')), 'Esc로 성장 창 닫기')
await page.click('.screen-active button[aria-label^="UPGRADE"]'); await W(300)
await page.click('.modal .btn-primary'); await W(800)
let s = await st()
check(s.owned.rion.level === 41 && s.wallet.credit < cr0, `CONFIRM 후 Lv.40 → ${s.owned.rion.level}`)
for (let i = 0; i < 20 && !(await page.locator('.screen-active button[aria-label="목록 뒤로"]').isDisabled()); i++) { await page.click('.screen-active button[aria-label="목록 뒤로"]'); await W(150) }
check(await page.locator('.screen-active button[aria-label="목록 뒤로"]').isDisabled(), '목록 끝에서 뒤로 버튼 비활성(무한 순환 없음)')
for (let i = 0; i < 20 && (await page.locator('.screen-active button[aria-label^="세렌"]').count()) === 0; i++) { await page.click('.screen-active button[aria-label="목록 앞으로"]'); await W(150) }
await page.click('.screen-active button[aria-label^="세렌"]'); await W(500)
check(await has('.cd2-lv:has-text("NOT OWNED")') && await page.locator('.screen-active button[aria-label^="UPGRADE"]').isDisabled(), '미보유 캐릭터: NOT OWNED, UPGRADE 비활성')
check(await page.locator('.screen-active button[aria-label^="로비 캐릭터로 설정"]').isDisabled(), '미보유 캐릭터는 로비 설정 비활성')
for (let i = 0; i < 20 && (await page.locator('.screen-active button[aria-label^="하랑"]').count()) === 0; i++) { await page.click('.screen-active button[aria-label="목록 앞으로"]'); await W(150) }
await page.click('.screen-active button[aria-label^="하랑"]'); await W(500)
check(!(await page.locator('.screen-active button[aria-label^="로비 캐릭터로 설정"]').isDisabled()), '보유 대원(하랑)은 전용 장면이 없어도 로비 설정 가능')
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
