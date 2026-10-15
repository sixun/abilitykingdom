// 사건 파일 1장(스토리 → 전투 → 조사 → 방어 → 보스 → 결말) 흐름 검증. dev 서버 실행 중에: node tests/case-file.mjs [BASE]
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push('CONSOLE ' + m.text()) })
let fails = 0
const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++ }
const W = (ms = 400) => page.waitForTimeout(ms)
const st = () => page.evaluate(() => window.__AK__.getState())
const skipTalk = async () => { if (await page.locator('.ss').count()) { await page.click('.ss-tools button:has-text("건너뛰기")'); await W(500) } }
const fight = () => page.waitForFunction(() => window.__CB__?.phase() === 'fight', null, { timeout: 90000 })
const winNow = async () => { for (let i = 0; i < 8 && !(await page.evaluate(() => window.__CB__.sim().result)); i++) { await page.evaluate(() => { window.__CB__.killAll(); window.__CB__.advance(1.5) }); await W(300) } }
const result = () => page.waitForSelector('.cb-overlay.result', { timeout: 30000 })

// 1) 스토리 → 사건 파일
await page.goto(BASE + '?screen=story'); await W(1500)
await page.click('.screen-active button.story-case'); await W(1200)
check(await page.locator('.screen-active .cf-cover h1:has-text("끊어진 신호")').count() === 1, '스토리 1장 → 사건 파일 열림')
check(await page.locator('.screen-active .cf-node').count() === 8, '노드 8개')
check(await page.locator('.screen-active .cf-node.locked').count() === 7, '처음엔 1-1만 열림')
const credit0 = (await st()).wallet.credit

// 2) 1-1 스토리
await page.click('.screen-active .cf-go'); await W(800)
check(await page.locator('.ss .ss-hq').count() === 1 || await page.locator('.ss-box').count() === 1, '1-1 대화 장면 시작')
for (let i = 0; i < 3; i++) { await page.click('.ss'); await W(150) }
await skipTalk(); await W(800)
let s = await st()
check(s.content.caseFile?.stars['c1-1'] === 1 && s.wallet.credit === credit0 + 1000, '1-1 완료 · 첫 보상 크레딧 1000')
check(await page.locator('.screen-active .cf-node.on .lbl:has-text("차단된 교차로")').count() === 1, '다음 노드(1-2) 자동 선택')

// 3) 1-2 전투: 대화 → 전투 → 조작(적 탭·액티브·버프) → 승리 → 보상 → 후속 대화
await page.click('.screen-active .cf-go'); await W(1500)
check(await page.locator('.screen-active .case-battle').count() === 1, '1-2 출동 → 전투 화면')
await skipTalk()
await fight()
check(await page.evaluate(() => !!window.__CB__.renderer()?.ready), 'WebGL 렌더러 준비(조명·반사)')
await page.evaluate(() => window.__CB__.advance(4)); await W(400)
const foe = page.locator('.screen-active .cb-mark.enemy .hit').first()
await foe.click({ force: true }); await W(200)
check(await page.evaluate(() => !!window.__CB__.sim().focus), '적 탭 → 집중 공격 지정')
await page.evaluate(() => { const s = window.__CB__.sim(); s.abil.rion.a.left = 0 })
await page.click('.screen-active .cb-card .act >> nth=0'); await W(200)
check(await page.evaluate(() => window.__CB__.sim().abil.rion.a.left > 0), '카드 탭 → 액티브(라온 주파수 폭발)')
await page.evaluate(() => { const s = window.__CB__.sim(); s.abil.seren.b.left = 0 })
await page.keyboard.press('w'); await W(200)
check(await page.evaluate(() => window.__CB__.sim().abil.seren.b.on > 0), '버프(W) → 세렌 고요한 밤 지속')
await winNow(); await result()
check(await page.locator('.cb-overlay.win h2:has-text("VICTORY")').count() === 1, '1-2 승리 화면')
check(await page.locator('.cb-reward:has-text("첫 클리어 보상")').count() === 1, '첫 클리어 보상 표시')
await page.click('.cb-overlay button:has-text("계속")'); await W(600)
check(await page.locator('.ss').count() === 1, '승리 후 후속 대화')
await skipTalk(); await W(1200)
s = await st()
check(s.content.caseFile?.stars['c1-2'] >= 1 && await page.locator('.screen-active .cf-cover').count() === 1, '사건 파일로 복귀 · 1-2 기록')

// 4) 1-3 조사: 세 곳을 모두 조사해야 마무리
await page.click('.screen-active .cf-go'); await W(800)
for (let i = 0; i < 6 && !(await page.locator('.ss-spot').count()); i++) { await page.click('.ss'); await W(200); if (await page.locator('.ss-box').count()) { await page.keyboard.press('Enter'); await W(100) } }
check(await page.locator('.ss-spot').count() === 3, '조사 지점 3곳 표시')
for (const n of ['중계기 화면', '결정 자국', '전신주 전선']) {
  await page.click(`.ss-spot[aria-label*="${n}"]`); await W(200)
  for (let i = 0; i < 8 && !(await page.locator('.ss-spot').count()); i++) { await page.keyboard.press('Enter'); await W(80); await page.keyboard.press('Enter'); await W(80) }
}
for (let i = 0; i < 12 && await page.locator('.ss').count(); i++) { await page.keyboard.press('Enter'); await W(80); await page.keyboard.press('Enter'); await W(80) }
await W(800)
check((await st()).content.caseFile?.stars['c1-3'] === 1, '1-3 조사 완료(세 곳 + 마무리)')

// 5) 1-4 방어: 중계기 · 시간 채우면 승리
await page.click('.screen-active .cf-go'); await W(1500); await skipTalk(); await fight()
check(await page.locator('.screen-active .cb-dev.relay').count() === 1 && await page.locator('.screen-active .cb-goal.defend').count() === 1, '1-4 중계기 · 재가동 게이지')
await page.evaluate(() => { const s = window.__CB__.sim(); window.__CB__.setT(74); window.__CB__.advance(2) }); await result()
check(await page.locator('.cb-overlay.win').count() === 1, '1-4 75초 버티면 승리')
await page.click('.cb-overlay button:has-text("계속")'); await W(500); await skipTalk(); await W(1000)

// 6) 1-5 일반 전투
await page.click('.screen-active .cf-go'); await W(1500); await skipTalk(); await fight()
await winNow(); await result()
check(await page.locator('.cb-overlay.win').count() === 1, '1-5 승리')
await page.click('.cb-overlay button:has-text("계속")'); await W(500); await skipTalk(); await W(1000)

// 7) 1-6 봉쇄: 셔터 장치 → 대원이 달려가 길을 막는다
await page.click('.screen-active .cf-go'); await W(1500); await skipTalk(); await fight()
check(await page.locator('.screen-active .cb-dev.shutter').count() === 2, '셔터 장치 2개')
await page.click('.screen-active .cb-dev.shutter >> nth=0', { force: true }); await W(200)
check(await page.evaluate(() => window.__CB__.sim().units.some((u) => u.task)), '셔터 탭 → 대원 이동')
await page.evaluate(() => window.__CB__.advance(4)); await W(300)
check(await page.evaluate(() => window.__CB__.sim().devices.some((d) => d.closed > 0)), '셔터 작동 → 길 봉쇄')
await winNow(); await result()
check(await page.locator('.cb-overlay.win').count() === 1, '1-6 호출 결정체 제압')
await page.click('.cb-overlay button:has-text("계속")'); await W(500); await skipTalk(); await W(1000)

// 8) 1-7 보스: 페이즈 2 기둥 → 토벌 → 코어 슬롯
await page.click('.screen-active .cf-go'); await W(1500); await skipTalk(); await fight()
await page.evaluate(() => { const s = window.__CB__.sim(); const b = s.units.find((u) => u.kind === 'boss'); b.hp = b.st.maxHp * 0.65; window.__CB__.advance(3) }); await W(300)
check(await page.evaluate(() => window.__CB__.sim().units.filter((u) => u.kind === 'pylon' && !u.dead).length === 2), '보스 70% → 중계 기둥 2개')
check(await page.waitForSelector('.screen-active .cb-boss:has-text("기둥 보호 중")', { timeout: 15000 }).then(() => true, () => false), '보스 체력바에 기둥 보호 표시')
await winNow(); await result()
check(await page.locator('.cb-overlay.win h2:has-text("CASE CLEAR")').count() === 1 && await page.locator('.cb-reward .core').count() === 1, '1-7 토벌 → 코어 슬롯 1 해금 표시')
check((await st()).coreSlots === 1, '저장: 코어 슬롯 1')
await page.click('.cb-overlay button:has-text("계속")'); await W(1200)

// 9) 1-8 결말
await page.click('.screen-active .cf-go'); await W(800); await skipTalk(); await W(800)
s = await st()
check(Object.keys(s.content.caseFile?.stars ?? {}).length === 8, '1장 노드 8개 모두 완료')
check(await page.locator('.screen-active .cf-core.on').count() === 1, '사건 파일 표지: 코어 슬롯 01 해금')

// 10) 다시 하기: 보상은 한 번만
await page.click('.screen-active .cf-node[aria-label^="1-2"] .dot'); await W(300)
const c1 = (await st()).wallet.credit
await page.click('.screen-active .cf-go'); await W(1500); await skipTalk(); await fight(); await winNow(); await result()
check(await page.locator('.cb-reward:has-text("이미 받은 보상")').count() === 1 && (await st()).wallet.credit === c1, '재도전 승리: 보상 중복 없음')

console.log('errors:', errs.length ? errs : 'none')
console.log('FAILS', fails + (errs.length ? 1 : 0))
await browser.close()
process.exit(fails || errs.length ? 1 : 0)
