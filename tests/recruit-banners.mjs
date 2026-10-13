// 영입 배너 3종(SERENITY·NIGHT SHIFT·ONE MORE PLAY?) 검증. dev 서버 실행 중에: node tests/recruit-banners.mjs [BASE]
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

// 1) 주파수 너머 화면 목록: 2~4번째 칸이 새 배너로
await page.goto(BASE + '?screen=recruit'); await W(2400)
const labels = await page.locator(A + '.hit-banner').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
check(labels.length === 4 && labels[1].startsWith('상시 배너 SERENITY') && labels[2].startsWith('한정 배너 NIGHT SHIFT') && labels[3].startsWith('상시 배너 ONE MORE PLAY?'), '목록 4칸 = 주파수 너머·SERENITY·NIGHT SHIFT·ONE MORE PLAY?')
check(await page.locator(A + 'img.rr-thumb').count() === 3, '새 배너 썸네일 3장')

// 2) 목록·탭 전환
await page.click(A + '.hit-banner[aria-label^="상시 배너 SERENITY"]'); await W(1600)
check(await page.locator(A + '.ui-rscene.rs-serenity').count() === 1, 'SERENITY 선택 → 배너 시안 화면')
check((await page.locator(A + '.rs-head').getAttribute('aria-label')).includes('세렌'), '픽업 세렌 5성 표기')
const s0 = await st()
check((await page.locator(A + '.rs-num').nth(1).textContent()) === String(s0.wallet.ticket), '티켓 수 = 실제 값')
check((await page.locator(A + '.rs-pts b').textContent()) === String(s0.wallet.scoutPoint), '영입 포인트 = 실제 값')
check(await page.locator(A + '.rs-faces img').count() === 4, 'NEW FACES 얼굴 = 신규 대원 4명(배너 픽업 3명 제외)')
await page.click(A + '.hit-banner[aria-label^="한정 배너 NIGHT SHIFT"]'); await W(1600)
check(await page.locator(A + '.ui-rscene.rs-nightshift').count() === 1 && await page.locator(A + 'button[aria-label="한정 영입 (선택됨)"]').count() === 1, 'NIGHT SHIFT = 한정 탭 선택')
await page.click(A + 'button[aria-label^="상시 영입"]'); await W(1600)
check(await page.locator(A + '.ui-rscene.rs-serenity').count() === 1, '상시 탭 → 첫 상시 배너(SERENITY)')
await page.click(A + 'button[aria-label^="한정 영입"]'); await W(1600)
check(await page.locator(A + '.ui-recruit').count() === 1 && await page.locator(A + '.ui-rscene').count() === 0, '한정 탭 → 첫 한정 배너(주파수 너머)')
await page.click(A + '.hit-banner[aria-label^="상시 배너 ONE MORE PLAY?"]'); await W(1600)
check(await page.locator(A + '.ui-rscene.rs-omp').count() === 1, 'ONE MORE PLAY? 선택')

// 3) 안내·장치 시연(재화 변화 없음)
const w0 = JSON.stringify((await st()).wallet)
await page.click(A + '.rs-info button:has-text("확률 정보")'); await W(400)
check(await page.locator('.rate-table').count() === 1 && await page.locator('.modal:has-text("채린")').count() === 1, '확률 정보 + 픽업 채린 안내')
await page.keyboard.press('Escape'); await W(300)
await page.click(A + '.rs-info button:has-text("상세 정보")'); await W(400)
check(await page.locator('.modal:has-text("아직 영입 대상에 넣지 않았습니다")').count() === 1, '상세 정보: 픽업 설정 확정 전 안내')
await page.keyboard.press('Escape'); await W(300)
await page.click(A + 'button[aria-label="뽑기 장치(움직여 보기)"]'); await W(400)
check((await page.locator(A + '.rs-tip').textContent()).includes('종이를 벗겨'), '쿠지 장치 누름 = 벗겨 보기 시연 + 안내')
check(JSON.stringify((await st()).wallet) === w0, '시연·안내로 재화 변화 없음')

// 4) 1회 영입: 장치 연출 후 결과 화면
let s1 = await st()
await page.click(A + '.hit-pull1'); await W(500)
check(await page.locator('.rs-play.play-peel').count() === 1, '1회 영입 → 쿠지 벗기기 연출')
await W(1800)
let s2 = await st()
check(s2.wallet.ticket === s1.wallet.ticket - 1 && s2.recruitTx.length === s1.recruitTx.length + 1, '티켓 1장 차감 + 영입 기록 1건')
check(await page.locator('.screen-active.rr, .screen-active .rr').count() >= 1, '연출 뒤 결과 화면')
check(s2.recruitTx[0].results.every((r) => !['seren', 'ian', 'chaerin'].includes(r.characterId)), '설정 미확정 픽업 대원은 결과에 없음')

for (let i = 0; i < 6; i++) { await page.mouse.click(800, 400); await W(450) }
await page.click(A + 'button:has-text("확인")'); await W(1500)
check(await page.locator(A + '.ui-rscene.rs-omp').count() === 1, '결과에서 돌아오면 고르던 배너(ONE MORE PLAY?) 유지')

// 5) NIGHT SHIFT 10회: 추첨기 연출, 한정이라 포인트 적립
await page.goto(BASE + '?screen=recruit&id=b_nightshift'); await W(2600)
s1 = await st()
await page.click(A + '.hit-pull10'); await W(600)
check(await page.locator('.rs-play.play-lottery.multi').count() === 1, '10회 영입 → 추첨기 연출(여러 개)')
await W(2200)
s2 = await st()
check(s2.wallet.ticket === s1.wallet.ticket - 10 && s2.wallet.scoutPoint === s1.wallet.scoutPoint + 100, '티켓 10장 차감 · 한정 배너 포인트 +100')

// 6) SERENITY: 캡슐 기계
await page.goto(BASE + '?screen=recruit&id=b_serenity'); await W(2600)
await page.click(A + '.hit-pull1'); await W(500)
check(await page.locator('.rs-play.play-capsule').count() === 1 && await page.locator('.ui-rscene.rs-playing').count() === 1, '1회 영입 → 캡슐 기계 연출')
await W(1800)

console.log('errors:', errs.length ? errs : 'none')
console.log('FAILS', fails + (errs.length ? 1 : 0))
await browser.close()
process.exit(fails || errs.length ? 1 : 0)
