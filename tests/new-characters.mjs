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

// 1) 목록: 4명 표시, 획득 불가 표시, 필터(미보유·Ex·즐겨찾기)·정렬·테마
await page.goto(BASE + '?screen=characters'); await W(2600)
for (const n of ['백린', '키요미', '이름 미정 (장검)', '이름 미정 (기모노)']) check(await page.locator(`.ccard:has-text("${n}")`).count() === 1, `목록에 ${n}`)
for (const n of ['세렌', '이안', '칸나']) check(await page.locator(`.ccard:has-text("${n}")`).count() === 1, `목록에 배너 픽업 ${n}`)
check(await page.locator('.ccard:has-text("신규 · 획득 불가")').count() === 7, '신규 4명 + 배너 픽업 3명 = 획득 불가 표시')
const names = async () => (await page.locator('.ccard .nm').allTextContents()).map((t) => t.trim())
check((await names()).slice(-4).every((n) => ['백린', '키요미', '이름 미정 (장검)', '이름 미정 (기모노)'].includes(n)), '등급순: 설정 미정 4명은 맨 뒤')
await page.click('.cl-side-item:has-text("미보유")'); await W(700)
check((await names()).length === 9 && (await names()).includes('리온') && (await names()).includes('백린') && (await names()).includes('칸나'), '미보유 필터 = 리온·서하 + 신규 4명 + 배너 픽업 3명')
await page.click('.cl-side-item:has-text("Ex")'); await W(600)
check(await page.locator('.cl-empty:has-text("Ex 캐릭터가 아직 없습니다")').count() === 1, 'Ex 필터 = 빈 상태 안내(데이터 없음)')
await page.click('.cl-side-item:has-text("전체")'); await W(900)
await page.hover('.ccard:has-text("지안")'); await page.click('.cl-fav[aria-label^="지안 즐겨찾기"]'); await W(500)
check((await st()).favorites?.includes('jian'), '하트 → 즐겨찾기 저장')
await page.click('.cl-side-item:has-text("즐겨찾기")'); await W(700)
check(JSON.stringify(await names()) === JSON.stringify(['지안']), '즐겨찾기 필터 = 지안')
await page.click('.cl-fav[aria-label^="지안 즐겨찾기"]'); await W(500)
check(await page.locator('.cl-empty').count() === 1 && !(await st()).favorites.includes('jian'), '하트 다시 누르면 해제')
await page.click('.cl-side-item:has-text("전체")'); await W(900)
await page.click('.cl-sort-btn'); await W(300); await page.click('.cl-sort-menu button:has-text("이름순")'); await W(800)
const owned = (await names()).slice(0, 6)
check(JSON.stringify(owned) === JSON.stringify([...owned].sort((a, b) => a.localeCompare(b, 'ko'))), '이름순 정렬(보유 캐릭터)')
await page.click('.cl-theme button:has-text("DARK")'); await W(600)
check((await st()).settings.charListTheme === 'dark' && await page.locator('.ui-clist.cl-dark').count() === 1, '다크 테마 전환·저장')
await page.click('.cl-theme button:has-text("LIGHT")'); await W(400)

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
