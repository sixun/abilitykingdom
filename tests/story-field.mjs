// 스토리 = 2.5D 탐색 필드: 로비 → 필드 바로 진입, 정문 통과, 사건 자리 → 이야기(필드 위) / 전투 화면 → 같은 자리로 복귀, 충돌.
// dev 서버 실행 중에: node tests/story-field.mjs [BASE]
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []; page.on('pageerror', (e) => errs.push(e.message))
let fails = 0
const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++ }
const W = (ms) => page.waitForTimeout(ms)
const until = async (f, ms = 30000) => { for (let i = 0; i < ms / 100; i++) { if (await page.evaluate(f).catch(() => false)) return true; await W(100) } return false }
const pos = () => page.evaluate(() => { const m = window.__EX__.me(); return [Math.round(m.x), Math.round(m.y)] })

await page.goto(BASE + '?screen=lobby'); await W(2500)
await page.click('.screen-active button[aria-label="스토리"]')
check(await until(() => window.__EX__?.phase() === 'intro', 90000), '로비 스토리 → 탐색 필드 진입 연출')
await page.evaluate(() => window.__EX__.setPhase('play')); await W(800)
check(await page.evaluate(() => window.__EX__.next()?.n.id) === 'c1-1', '첫 사건 자리 = 1-1')

// 충돌: 분수대·벽 안으로는 못 들어간다, 광장 바닥은 걷는다
check(await page.evaluate(() => window.__EX__.walkable(1300, 2750)) === true, '정문 광장 바닥 = 걷기')
check(await page.evaluate(() => window.__EX__.walkable(1072, 2880)) === false, '정문 광장 분수대 = 막힘')
check(await page.evaluate(() => window.__EX__.walkable(1475, 1290)) === false, '본관 앞 분수대 = 막힘')
check(await page.evaluate(() => window.__EX__.walkable(1180, 2400)) === false, '닫힌 정문 = 막힘')

// 정문: 걸어서 뚫지 않고 상호작용으로 통과
await page.evaluate(() => window.__EX__.set(1100, 2660, 'N')); await W(500)
await page.evaluate(() => window.__EX__.interact()); await W(1400)
const [gx, gy] = await pos()
check(gy < 2300, `정문 통과 → 안뜰 (${gx},${gy})`)

// 1-1 이야기: 필드 위에서 열리고 끝나면 다음 사건
await page.evaluate(() => window.__EX__.set(1600, 2900, 'N'))
check(await until(() => !!document.querySelector('.ss'), 8000), '1-1 자리 → 이야기 장면(필드 위)')
await page.click('.ss button:has-text("건너뛰기")'); await W(1200)
check(await until(() => window.__EX__.next()?.n.id === 'c1-2', 8000), '1-1 완료 → 다음 사건 1-2')

// 1-2 전투: 조우 연출 → 전투 화면 → 승리 → 같은 자리로 복귀
await page.evaluate(() => window.__EX__.set(4868, 2760, 'N'))
check(await until(() => document.querySelector('[data-screen="caseBattle"]') != null, 20000), '1-2 자리 → 조우 연출 후 전투 화면')
await W(1500); await page.click('.ss button:has-text("건너뛰기")').catch(() => {})
await until(() => window.__CB__?.phase() === 'fight', 60000)
for (let i = 0; i < 8 && !(await page.evaluate(() => window.__CB__.sim().result)); i++) { await page.evaluate(() => { window.__CB__.killAll(); window.__CB__.advance(1.5) }); await W(300) }
await until(() => window.__CB__?.phase() === 'result', 30000); await W(1200)
await page.click('.screen-active button.primary'); await W(1000)
await page.click('.ss button:has-text("건너뛰기")').catch(() => {})
check(await until(() => document.querySelector('[data-screen="story"]') != null && window.__EX__?.phase() === 'play', 60000), '전투 후 필드로 복귀(진입 연출 없이)')
const [bx, by] = await pos()
check(Math.hypot(bx - 4868, by - 2760) < 40, `복귀 위치 = 전투 들어간 자리 (${bx},${by})`)
check(await page.evaluate(() => window.__EX__.next()?.n.id) === 'c1-3', '1-2 승리 → 다음 사건 1-3')

console.log('errors:', errs.length ? errs : 'none')
console.log('FAILS', fails + (errs.length ? 1 : 0))
await browser.close()
process.exit(fails || errs.length ? 1 : 0)
