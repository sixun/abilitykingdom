// 신규 추가 캐릭터 4명(설정 미정) 연결 검증. dev 서버 실행 중에: node tests/new-characters.mjs [BASE]
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1456, height: 819 } })).newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push('CONSOLE ' + m.text()) })
let fails = 0
const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++ }
const W = (ms = 500) => page.waitForTimeout(ms)
const st = () => page.evaluate(() => window.__AK__.getState())

// 1) 목록: 4명 표시, 역할 필터에는 없음, 획득 불가 표시
await page.goto(BASE + '?screen=characters'); await W(1500)
for (const n of ['백린', '키요미', '이름 미정 (장검)', '이름 미정 (기모노)']) check(await page.locator(`.ccard:has-text("${n}")`).count() === 1, `목록에 ${n}`)
check(await page.locator('.ccard:has-text("신규 · 획득 불가")').count() === 4, '신규 4명 = 획득 불가 표시')
await page.click('.chars-filters button:has-text("공격")'); await W(300)
check(await page.locator('.ccard:has-text("백린")').count() === 0, '역할 미정 → 역할 필터에서 제외')

// 2) 상세: 이름·아트 전환, 수치·스킬·역할 미정 표시, 성장 불가
await page.goto(BASE + '?screen=characterDetail&id=kiyomi'); await W(2600)
check((await page.locator('.cd2-name').textContent()).replace(/\s/g, '') === 'KIYOMI', '상세 이름 = KIYOMI')
check(await page.locator('.cd2-hero img[src*="detail-art/kiyomi"]').count() === 1, '상세 아트 = 키요미 배경 제거본')
check(await page.locator('.cd2-role:has-text("ROLE TBD")').count() === 1 && await page.locator('.cd2-lv:has-text("PENDING")').count() === 1, '역할 TBD · 레벨 PENDING')
check((await page.locator('.cd2-val').allTextContents()).every((t) => t.trim() === '—'), '능력치 = — (임의 수치 없음)')
check(await page.locator('.screen-active button[aria-label^="UPGRADE"]').isDisabled(), 'UPGRADE 비활성')
await page.click('.screen-active button[aria-label^="SKILLS"]'); await W(400)
check(await page.locator('.cd2-row-tbd:has-text("스킬 미정")').count() === 1, 'SKILLS = 스킬 미정')
for (let i = 0; i < 4 && !(await page.locator('.screen-active button[aria-label="목록 뒤로"]').isDisabled()); i++) { await page.click('.screen-active button[aria-label="목록 뒤로"]'); await W(200) }
await page.click('.screen-active button[aria-label^="이름 미정 (장검)"]'); await W(900)
check(await page.locator('.cd2-hero img[src*="detail-art/swordswoman"]').count() === 1 && (await page.locator('.cd2-name').textContent()).replace(/\s/g, '') === 'UNNAMEDA', '목록에서 장검 캐릭터로 전환(이름·아트 함께)')

// 3) 영입: 미리보기만, 풀·재화 변화 없음
await page.goto(BASE + '?screen=recruit'); await W(2200)
const wallet = JSON.stringify((await st()).wallet)
await page.click('.screen-active button[aria-label^="신규 대원"]'); await W(900)
check(await page.locator('.nf-card').count() === 4, 'NEW FACES 카드 4장')
check(await page.locator('.nf-chip.warn:has-text("영입 대상 아님")').count() === 1, '영입 대상 아님 표시')
await page.click('.nf-card:has-text("키요미")'); await W(700)
check((await page.locator('.nf-name .en').textContent()).replace(/\s/g, '') === 'KIYOMI' && await page.locator('.nf-scene[src*="lobby/kiyomi"]').count() === 1, '카드 선택 → 이름·전용 장면 함께 전환')
await page.keyboard.press('Escape'); await W(500)
check(await page.locator('.nf').count() === 0 && await page.locator('.screen-active .ui-recruit').count() === 1, 'Esc = 미리보기만 닫고 영입 화면 유지')
check(JSON.stringify((await st()).wallet) === wallet, '미리보기로 재화 변화 없음')
await page.click('.screen-active button[aria-label^="신규 대원"]'); await W(700)
await page.click('.nf-card:has-text("백린")'); await W(400)
await page.click('.nf-btn:has-text("상세 보기")'); await W(1200)
check((await page.locator('.cd2-name').textContent()).replace(/\s/g, '') === 'BAEKRIN', '미리보기 → 상세 보기 = 백린 상세')

// 4) 로비: 전용 장면이면 지안 영상을 쓰지 않는다(인물 중복 없음). 보유하지 않은 캐릭터는 로비 설정 불가
check((await page.evaluate(() => window.__AK__.setLobbyCharacter('kiyomi'))).ok === false, '미보유 신규 캐릭터는 로비 설정 거부')
for (const [id, theme] of [['kiyomi', 'station'], ['kimono', 'sofa']]) {
  await page.evaluate(([i, t]) => window.__AK__.commit((s) => { s.lobby.characterId = i; s.lobby.theme = t }), [id, theme])
  await page.goto(BASE + '?screen=lobby'); await W(1500)
  check(await page.locator(`.screen-active img.mv.scene[src*="lobby/${id}"]`).count() === 1 && await page.locator('.screen-active video.mv').count() === 0, `${theme} 로비: ${id} 전용 장면, 지안 영상 없음`)
}
await page.evaluate(() => window.__AK__.commit((s) => { s.lobby.characterId = 'jian'; s.lobby.theme = 'sofa' }))

console.log('errors:', errs.length ? errs : 'none')
console.log('FAILS', fails + (errs.length ? 1 : 0))
await browser.close()
process.exit(fails || errs.length ? 1 : 0)
