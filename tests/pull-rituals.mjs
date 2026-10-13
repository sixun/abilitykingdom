// 직접 조작 영입 연출 4종을 실제 손동작(끌기·돌리기·누르기)으로 끝까지 진행. dev 서버 실행 중에: node tests/pull-rituals.mjs [BASE]
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1672, height: 941 } })).newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push('CONSOLE ' + m.text()) })
let fails = 0
const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++ }
const W = (ms = 500) => page.waitForTimeout(ms)
const st = () => page.evaluate(() => window.__AK__.getState())
const A = '.screen-active '
const box = (label) => page.locator(`.pr-zone[aria-label="${label}"]`).boundingBox()
const step = async () => (await page.locator('.pr-head b').textContent()).trim()
async function drag(x0, y0, x1, y1, n = 16) { await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= n; i++) { await page.mouse.move(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n); await W(20) } await page.mouse.up() }
async function circle(cx, cy, r, turns, n = 60) { await page.mouse.move(cx + r, cy); await page.mouse.down(); for (let i = 1; i <= n; i++) { const a = (i / n) * Math.PI * 2 * turns; await page.mouse.move(cx + r * Math.cos(a), cy + r * Math.sin(a)); await W(14) } await page.mouse.up() }
async function start(id) {
  await page.goto(BASE + '?screen=recruit' + (id ? '&id=' + id : '')); await W(2600)
  const s0 = await st(); await page.click(A + '.hit-pull1'); await W(1300)
  const s1 = await st(); return { s0, s1 }
}
async function finish(name, s1) {
  await page.waitForSelector('.pr-result .pr-ok', { timeout: 6000 })
  const best = s1.recruitTx[0].results[0]
  const nm = await page.evaluate((id) => document.querySelector('.pr-result h2').textContent, best.characterId)
  check(nm.length > 0, `${name}: 결과 카드 = ${nm}`)
  await W(700); await page.click('.pr-ok'); await W(700)
  check(await page.locator('.pr-overlay').count() === 0 && JSON.stringify((await st()).wallet) === JSON.stringify(s1.wallet), `${name}: 확인 → 닫힘, 연출 중 재화 변화 없음`)
}

// 1) 카드팩: 절취선 당기기(오른쪽→왼쪽) → 카드 위로 꺼내기 → 옆으로 넘겨 뒤집기
{
  const { s1 } = await start()
  check((await step()) === '절취선 당기기', '카드팩: 2단계 절취선 당기기')
  let z = await box('절취선 당기기'); await drag(z.x + z.width - 60, z.y + 70, z.x + 20, z.y + 70); await W(1000)
  check((await step()) === '카드 꺼내기' && await page.locator('.pk-strip.fly').count() === 1, '카드팩: 절취선을 끝까지 당기면 띠가 날아가고 카드 꺼내기')
  z = await box('카드 꺼내기'); await drag(z.x + z.width / 2, z.y + z.height * 0.8, z.x + z.width / 2, z.y + z.height * 0.8 - 40, 4); await W(500)
  check((await step()) === '카드 꺼내기', '카드팩: 조금만 끌면 카드가 다시 들어감')
  await drag(z.x + z.width / 2, z.y + z.height * 0.8, z.x + z.width / 2, z.y + z.height * 0.8 - 260); await W(900)
  check((await step()) === '카드 뒤집기', '카드팩: 위로 끌어 꺼내면 뒤집기 단계')
  z = await box('카드 뒤집기'); await drag(z.x + z.width * 0.3, z.y + z.height / 2, z.x + z.width * 0.3 + 230, z.y + z.height / 2)
  await finish('카드팩', s1)
}
// 2) 캡슐: 손잡이 한 바퀴 → 윗부분 밀어 열기 → 위로 펼치기
{
  const { s1 } = await start('b_serenity')
  let z = await box('손잡이 돌리기'); await circle(z.x + z.width / 2, z.y + z.height / 2, z.width * 0.3, 0.5); await W(300)
  check((await step()) === '손잡이 회전', '캡슐: 반 바퀴로는 안 나옴')
  await circle(z.x + z.width / 2, z.y + z.height / 2, z.width * 0.3, 0.7); await W(1900)
  check((await step()) === '캡슐 개봉', '캡슐: 합쳐 한 바퀴 돌리면 캡슐 배출 → 개봉 단계')
  z = await box('캡슐 열기'); await drag(z.x + z.width / 2, z.y + z.height * 0.45, z.x + z.width / 2, z.y + z.height * 0.45 - 140); await W(1200)
  check((await step()) === '결과 펼치기', '캡슐: 윗부분을 밀어 올리면 접힌 카드')
  z = await box('카드 펼치기'); await drag(z.x + z.width / 2, z.y + z.height * 0.75, z.x + z.width / 2, z.y + z.height * 0.75 - 140)
  await finish('캡슐', s1)
}
// 3) 회전추첨기: 핸들 두 바퀴 → 관성으로 돌다 감속 → 공 배출 → 공 누르기
{
  const { s1 } = await start('b_nightshift')
  const z = await box('핸들 돌리기'); await circle(z.x + z.width / 2, z.y + z.height / 2, z.width * 0.36, 2.1, 80); await W(300)
  check(['회전 후 감속', '공 배출'].includes(await step()), '추첨기: 두 바퀴 돌리면 회전 후 감속')
  await page.waitForSelector('.pr-zone[aria-label="공 확인하기"]', { timeout: 8000 })
  check(await page.locator('.lt-ball').count() === 1, '추첨기: 공 배출')
  await page.click('.pr-zone[aria-label="공 확인하기"]')
  await finish('추첨기', s1)
}
// 4) 쿠지: 상자에서 한 장 고르기 → 모서리 잡고 벗기기 → 눌러 공개
{
  const { s1 } = await start('b_omp')
  const z = await box('쿠지 한 장 고르기'); await page.mouse.click(z.x + z.width * 0.4, z.y + z.height * 0.5); await W(1400)
  check((await step()) === '종이 벗기기', '쿠지: 한 장 고르면 벗기기 단계')
  const t = await box('종이 벗기기'); const sx = t.x + t.width - 90, sy = t.y + t.height - 90
  await drag(sx, sy, sx - 60, sy - 40, 5); await W(500)
  check((await step()) === '종이 벗기기' && await page.locator('.kj-ticket .cover').count() === 1, '쿠지: 살짝 벗기면 다시 덮임')
  await drag(sx, sy, sx - 420, sy - 270); await W(900)
  check((await step()) === '결과 확인' && await page.locator('.kj-ticket .cover').count() === 0, '쿠지: 충분히 벗기면 등급 공개')
  await page.click('.pr-zone[aria-label="결과 공개"]')
  await finish('쿠지', s1)
}

console.log('errors:', errs.length ? errs : 'none')
console.log('FAILS', fails + (errs.length ? 1 : 0))
await browser.close()
process.exit(fails || errs.length ? 1 : 0)
