import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1456, height: 819 } })).newPage()
const errs = []
page.on('pageerror', e => errs.push('PAGEERR ' + e.message))
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push('CONSOLE ' + m.text()) })
const st = () => page.evaluate(() => window.__AK__.getState())
const shot = (n) => page.screenshot({ path: `test-results/e2-${n}.png` })
let fails = 0
const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++ }
const W = (ms = 600) => page.waitForTimeout(ms)
const back = async () => { await page.click('.screen-active .back-btn, .screen-active button[aria-label="돌아가기"], .screen-active button[aria-label="뒤로"]'); await W(700) }

await page.goto(BASE + '?screen=lobby'); await W(2500)

// 로비 링크 전부: 하단 10개 + 이벤트 3개 + 프로필 + 더보기 메뉴(원본에 없는 추가 진입점)
const LOBBY = '.screen-active button[aria-label="더보기 메뉴"]'
const targets = [
  ['button[aria-label="스토리"]', '.ct-story'], ['button[aria-label="도시 탐색"]', '.ct-explore'], ['button[aria-label="현상수배"]', '.ct-wanted'],
  ['button[aria-label="훈련"]', '.ct-training'], ['button[aria-label="아레나"]', '.ct-arena'], ['button[aria-label="레이드"]', '.ct-raid'],
  ['button[aria-label="캐릭터"]', '.chars'], ['button[aria-label="상점"]', '.shop'], ['button[aria-label="소환(영입)"]', 'button.hit-pull10'],
  ['button[aria-label="이벤트: 스토리"]', '.ct-story'], ['button[aria-label="이벤트: 도시 탐색"]', '.ct-explore'], ['button[aria-label="이벤트: 현상수배"]', '.ct-wanted'],
  ['button[aria-label="프로필"]', '.profile'],
  ['more:가방', '.bag'], ['more:우편함', '.ops'], ['more:미션', '.ops'], ['more:공지', '.ops'], ['more:이벤트', '.ops'], ['more:출석', '.att'], ['more:설정', '.settings'],
]
for (const [btn, scr] of targets) {
  if (btn.startsWith('more:')) { await page.click(LOBBY); await W(200); await page.click(`.rl-more button:has-text("${btn.slice(5)}")`) }
  else await page.click('.screen-active ' + btn)
  await W(700)
  check(await page.locator(`.screen-active ${scr}`).count() > 0, `로비 → ${btn} → ${scr}`)
  await back()
  check(await page.locator(LOBBY).count() === 1, `  ↩ 로비 복귀`)
}

// 감상 모드
await page.evaluate(() => { window.__v = document.querySelector('.screen-active video.mv') })
await page.click(LOBBY); await W(200); await page.click('.rl-more button:has-text("감상 모드")'); await W(500)
check(await page.locator('.screen-active .mg-wrap.hide').count() === 1 && await page.locator('button[aria-label="UI 다시 표시"]').count() === 1, 'UI 숨김 감상 모드')
check(await page.evaluate(() => !window.__v || window.__v === document.querySelector('.screen-active video.mv')), '감상 모드에서도 같은 장면 영상 유지(재시작 없음)')
await page.mouse.click(700, 300); await W(400)
check(await page.locator(LOBBY).count() === 1, '감상 모드 해제')

// 로비 캐릭터 선택: 원본 장면 그림이 있는 지안만 선택 가능
await page.click('.screen-active button[aria-label="로비 캐릭터 변경"]'); await W(300)
check(await page.locator('.lb-picker-grid button:has-text("세인")').isDisabled(), '로비 그림 없는 캐릭터는 비활성')
await page.click('.modal .btn-dark:has-text("닫기")'); await W(300)
let s = await st()
check(s.lobby.characterId === 'jian' && s.teams[0].leaderId === 'jian', '로비 캐릭터와 팀 리더는 별도 저장')

// 캐릭터 상세(원본 재현): 탭 3개, 성장 확인 창, 장비
await page.click('.screen-active button[aria-label="캐릭터"]'); await W(700)
await page.click('.ccard:has-text("하린")'); await W(700)
check((await page.locator('.cd2-name').first().textContent()).replace(/\s/g, '').startsWith('HARIN'), '상세: 선택 캐릭터 이름 표시')
for (const t of ['SKILLS', 'GEAR', 'STATS']) { await page.click(`.screen-active button[aria-label^="${t}"]`); await W(400); await shot('cd-' + t) }
await page.click('.screen-active button[aria-label^="SKILLS"]'); await W(300)
check(await page.locator('.cd2-row').count() === 3, 'SKILLS: 스킬 3개')
await page.click('.screen-active button[aria-label^="STATS"]'); await W(300)
const lv0 = (await st()).owned.harin.level
const cr0 = (await st()).wallet.credit
await page.click('.screen-active button[aria-label^="UPGRADE"]'); await W(400)
check((await st()).wallet.credit === cr0, '성장 창을 열어도 차감 없음')
await page.click('.cd-lv-step button:has-text("+5")'); await W(200)
await page.click('.modal .btn-primary'); await W(700)
s = await st()
check(s.owned.harin.level === lv0 + 5 && s.wallet.credit < cr0, `CONFIRM 후 성장 +5 (${lv0}→${s.owned.harin.level}), 크레딧 차감`)
await page.click('.screen-active button[aria-label^="GEAR"]'); await W(400)
await page.click('.cd2-row >> nth=2'); await W(300)
await page.click('.eq-row:has-text("노이즈캔슬")'); await W(500)
s = await st()
check(s.owned.harin.equipment.accessory === 'eq_phones', '장비 장착')
await back(); await back()

// 영입 10회 → 결과 → 스킵 → 요약 → 기록 재열람 동일
s = await st()
const t0 = s.wallet.ticket
await page.click('.screen-active button[aria-label="소환(영입)"]'); await W(800)
await page.click('.screen-active button.hit-pull10'); await W(900)
await shot('rr-reveal')
s = await st()
const tx = s.recruitTx[0]
check(s.wallet.ticket === t0 - 10 && tx.results.length === 10, `10회 영입: 티켓 ${t0}→${s.wallet.ticket}`)
await page.click('.rr-skip'); await W(800)
await shot('rr-summary')
const names1 = await page.$$eval('.rr-cell strong', (e) => e.map((x) => x.textContent).join())
check((await st()).recruitTx.length === 1 && (await st()).wallet.ticket === t0 - 10, '스킵해도 결과 재실행 없음')
await page.click('.rr-actions button:has-text("확인")'); await W(700)
await page.click('.screen-active button[aria-label="상세 정보"]'); await W(300); await page.click('.modal button:has-text("영입 기록")'); await W(700)
await page.click('.rh-row >> nth=0'); await W(800)
const names2 = await page.$$eval('.rr-cell strong', (e) => e.map((x) => x.textContent).join())
check(names1 === names2, '기록에서 다시 열어도 같은 거래 결과')
await page.click('.rr-actions button:has-text("확인")'); await W(700)
await back()
// 1회 영입 연타
s = await st(); const t1 = s.wallet.ticket, n1 = s.recruitTx.length
await page.click('.screen-active button.hit-pull1'); await page.click('.screen-active button.hit-pull1', { force: true }).catch(() => {}); await page.click('.screen-active button.hit-pull1', { force: true }).catch(() => {})
await W(1000)
s = await st()
check(s.wallet.ticket === t1 - 1 && s.recruitTx.length === n1 + 1, `1회 영입 연타 → 1회만 차감 (${t1}→${s.wallet.ticket})`)
await page.click('.rr-skip').catch(() => {}); await W(500)
await page.click('.rr-actions button:has-text("확인")'); await W(600)
await back()

// 상점: 응답 유실 시뮬레이션 + 재시도 → 1회만 차감·지급
await page.evaluate(() => window.__AK__.setFailureRate(1.0)) // 절반 처리 전 실패, 절반 처리 후 유실
s = await st(); const d0 = s.wallet.diamond, tk0 = s.wallet.ticket
await page.click('.screen-active button[aria-label="상점"]'); await W(700)
await page.click('.pcard:has-text("영입 티켓") >> nth=0'); await W(300)
for (let i = 0; i < 4; i++) {
  if (await page.locator('.modal .error-banner button:has-text("재시도")').count()) await page.click('.modal .error-banner button:has-text("재시도")')
  else if (await page.locator('.modal .btn-primary:has-text("구매")').count()) await page.click('.modal .btn-primary:has-text("구매")')
  await W(450)
}
await page.evaluate(() => window.__AK__.setFailureRate(0))
if (await page.locator('.modal .error-banner button:has-text("재시도")').count()) { await page.click('.modal .error-banner button:has-text("재시도")'); await W(500) }
s = await st()
check(s.wallet.diamond === d0 - 160 && s.wallet.ticket === tk0 + 1, `실패·재시도 후에도 1회만 차감/지급 (다이아 ${d0}→${s.wallet.diamond}, 티켓 ${tk0}→${s.wallet.ticket})`)
if (await page.locator('.modal').count()) { await page.keyboard.press('Escape'); await page.mouse.click(5, 700); await W(300) }
// 실결제 상품은 비활성
await page.click('.tabs button:has-text("패키지")'); await W(400)
await page.click('.pcard >> nth=0'); await W(300)
check(await page.locator('.modal .btn-primary:has-text("결제 미연동")').isDisabled(), '실결제 상품은 결제 미연동으로 비활성')
await page.click('.modal .btn-ghost'); await W(300)
await back()

// 우편 모두 받기 → 알림 점 사라짐, 중복 수령 없음
s = await st(); const dm = s.wallet.diamond
await page.click(LOBBY); await W(200); await page.click('.rl-more button:has-text("우편함")'); await W(600)
await page.click('.ops-actions button:has-text("모두 받기")'); await W(600)
s = await st()
check(s.mails.every((m) => m.claimed) && s.wallet.diamond === dm + 500, '우편 모두 받기')
check(await page.locator('.ops-actions button:has-text("모두 받기 (0)")').isDisabled(), '받은 뒤 버튼 비활성')
await back()
await page.click(LOBBY); await W(200)
check(await page.locator('.rl-more button:has-text("우편함") .dot').count() === 0, '우편 알림 점 해제')
await page.click(LOBBY); await W(200)

// 미션 보상(편성 저장·영입·레벨업 진행분)
await page.click(LOBBY); await W(200); await page.click('.rl-more button:has-text("미션")'); await W(600)
const ready = await page.locator('.mission.ready').count()
for (let i = 0; i < ready; i++) { await page.click('.mission.ready .btn-primary >> nth=0'); await W(400) }
check(await page.locator('.mission.ready').count() === 0, `완료 미션 ${ready}개 수령`)
await back()

// 출석
await page.click(LOBBY); await W(200); await page.click('.rl-more button:has-text("출석")'); await W(600)
await page.click('.att-actions .btn-primary'); await W(500)
check(await page.locator('.att-actions .btn-primary').isDisabled(), '출석 1일 1회')
await back()

// 콘텐츠 → 출전 준비 → 테스트 전투 → 결과
s = await st(); const stam = s.wallet.stamina
await page.click('.screen-active button[aria-label="스토리"]'); await W(700)
await page.click('.stage-panel .btn-primary'); await W(800)
check(await page.locator('.screen-active .prep').count() === 1, '스토리 → 출전 준비')
await shot('prep')
await page.click('.prep-enemy .btn-primary'); await W(900)
check(await page.locator('.screen-active .battle').count() === 1, '출전 → 테스트 전투')
s = await st(); check(s.wallet.stamina === stam - 6, '행동력 차감')
await page.click('.bt-ctrl button[aria-label="배속"]')
for (let i = 0; i < 4; i++) { await page.click('.bt-skill >> nth=' + i).catch(() => {}); await W(150) }
await shot('battle')
await page.waitForSelector('.bt-result', { timeout: 30000 })
await shot('battle-result')
s = await st()
const won = await page.locator('.bt-result.win').count() === 1
check(s.content.battles.length === 1, `전투 결과 기록 (${won ? '승리' : '패배'})`)
if (won) check(s.content.storyCleared.includes('1-1'), '스토리 1-1 클리어 기록')
await page.click('.bt-result-actions button:has-text("로비 복귀")'); await W(900)
check(await page.locator(LOBBY).count() === 1, '결과 → 로비 복귀')

// 아레나·레이드·현상수배·탐색·훈련 출전 준비 진입
for (const [ct, sel] of [['arena', '.opp .btn-primary >> nth=0'], ['raid', '.stage-panel .btn-primary'], ['training', '.stage-panel .btn-primary'], ['wanted', '.poster >> nth=0'], ['explore', '.map-pin >> nth=0']]) {
  await page.click(`.screen-active button[aria-label="${{ arena: '아레나', raid: '레이드', training: '훈련', wanted: '현상수배', explore: '도시 탐색' }[ct]}"]`); await W(800)
  await page.click(sel); await W(800)
  if (ct === 'wanted' || ct === 'explore') { await page.click('.stage-panel .btn-primary'); await W(800) }
  check(await page.locator('.screen-active .prep').count() === 1, `${ct} → 출전 준비`)
  await page.click('.back-btn'); await W(700)
  await page.click('.back-btn'); await W(700)
}
check(await page.locator(LOBBY).count() === 1, '모든 콘텐츠에서 로비 복귀')
console.log('errors:', errs.length ? errs : 'none')
console.log('FAILS', fails)
await browser.close()
