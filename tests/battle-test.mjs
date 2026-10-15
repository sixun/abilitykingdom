// 전투 테스트 화면 검증. dev 서버 실행 중에: node tests/battle-test.mjs [BASE]
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push('CONSOLE ' + m.text()) })
let fails = 0
const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++ }
const W = (ms = 500) => page.waitForTimeout(ms)
const sim = () => page.evaluate(() => { const s = window.__BT__.sim(); return { t: s.t, wave: s.wave, result: s.result, skills: s.skills, ents: s.ents.map((e) => ({ id: e.id, side: e.side, hp: e.hp, max: e.max, shield: e.shield, dead: e.dead })) } })
const wallet0 = async () => JSON.stringify(await page.evaluate(() => window.__AK__.getState().wallet))

// 1) 로비 메뉴 → 전투 테스트
await page.goto(BASE + '?screen=lobby'); await W(800)
await page.evaluate(() => window.__AK__.setLobbyTheme('station')); await W(1500)
const w0 = await wallet0()
await page.click('.screen-active button[aria-label="전체 메뉴"]'); await W(300)
await page.click('.rs-menu button:has-text("전투 테스트")'); await W(1200)
check(await page.locator('.screen-active .bt').count() === 1, '역 로비 전체 메뉴 → 전투 테스트')
await W(1500)
let s = await sim()
check(s.ents.filter((e) => e.side === 'ally').length === 4 && s.ents.filter((e) => e.side === 'enemy').length === 5, '아군 4명(리온·세렌·이안·칸나) vs 적 5마리')
check(await page.locator('.bt-card').count() === 4 && (await page.locator('.bt-card .name').allTextContents()).join() === 'RAON,SEREN,IAN,KANNA', '아래 카드 4장')
const t1 = s.t; await W(1200); s = await sim()
check(s.t > t1 + 0.8, '시간이 흐르고 전투 진행')
await page.waitForFunction(() => window.__BT__.sim().ents.some((e) => e.side === 'enemy' && e.hp < e.max), null, { timeout: 8000 })
check(true, '기본 공격 자동(적 체력 감소)')

// 2) 스킬: 카드 누르기 / 숫자 키
await page.waitForFunction(() => window.__BT__.sim().skills.rion.left === 0, null, { timeout: 10000 })
await page.click('.bt-card button[aria-label^="주파수 폭발"]'); await W(120)
s = await sim()
check(s.skills.rion.left > 5, '리온 스킬 카드 → 사용, 재사용 대기 시작')
check(await page.locator('.bt-cutin:has-text("주파수 폭발")').count() === 1, '스킬 컷인')
check(await page.locator('.bt-card button[aria-label^="주파수 폭발"]').isDisabled(), '대기 중엔 버튼 비활성')
await page.waitForFunction(() => window.__BT__.sim().skills.ian.left === 0, null, { timeout: 12000 })
await page.keyboard.press('3'); await W(200); s = await sim()
check(s.skills.ian.left > 7 && s.ents.filter((e) => e.side === 'ally' && !e.dead).every((e) => e.shield > 0), '숫자 3 = 이안 방벽(아군 전원 보호막)')

// 3) 일시정지·배속·AUTO
await page.click('button[aria-label="일시정지"]'); await W(300)
const tp = (await sim()).t; await W(800)
check(await page.locator('.bt-overlay:has-text("일시정지")').count() === 1 && (await sim()).t === tp, '일시정지 = 시간 멈춤')
await page.click('.bt-panel button:has-text("계속하기")'); await W(300)
await page.click('button.bt-btn.spd'); await page.click('button.bt-btn.auto')
check(await page.locator('button.bt-btn.spd.on:has-text("2x")').count() === 1 && await page.locator('button.bt-btn.auto.on').count() === 1, '2배속 · AUTO 켜짐')

// 4) 웨이브 2 → 승리 결과
await page.evaluate(() => window.__BT__.killAll()); await W(1800)
s = await sim()
check(s.wave === 2 && await page.locator('.bt-stage em:has-text("WAVE 2/2")').count() === 1, '1웨이브 정리 → WAVE 2/2')
await page.evaluate(() => window.__BT__.killAll()); await W(2000)
check(await page.locator('.bt-overlay.result.win h2:has-text("VICTORY")').count() === 1 && await page.locator('.bt-stats .row').count() === 4, '승리 → VICTORY + 대원별 피해량')
check(await wallet0() === w0, '테스트 전투는 재화·기록 변화 없음')
await page.click('.bt-panel button:has-text("다시 하기")'); await W(1500)
s = await sim()
check(!s.result && s.wave === 1 && s.t < 2, '다시 하기 → 처음부터')

// 5) 시간 초과 → 패배, 나가기
await page.evaluate(() => window.__BT__.setT(89.9)); await W(800)
check(await page.locator('.bt-overlay.result.lose h2:has-text("TIME OVER")').count() === 1, '시간 초과 → TIME OVER')
await page.click('.bt-panel button:has-text("나가기")'); await W(1200)
check(await page.locator('.screen-active .bt').count() === 0, '나가기 → 이전 화면')

console.log('errors:', errs.length ? errs : 'none')
console.log('FAILS', fails + (errs.length ? 1 : 0))
await browser.close()
process.exit(fails || errs.length ? 1 : 0)
