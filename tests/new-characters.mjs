// 대원 11명(정식 포맷·새 이름) 연결 검증. dev 서버 실행 중에: node tests/new-characters.mjs [BASE]
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

// 1) 목록: 11명 모두 정식 대원(새 이름), 획득 불가 표시 없음, 필터·정렬·테마
await page.goto(BASE + '?screen=characters'); await W(2600)
const ROSTER = ['라온', '하랑', '세렌', '이안', '칸나', '센카', 'VX', '백린', '키요미', '보라', '마유']
for (const n of ROSTER) check(await page.locator(`.ccard .nm:text-is("${n}")`).count() === 1, `목록에 ${n}`)
check(await page.locator('.ccard').count() === 11, '목록 11명')
for (const n of ['리온', '샤오랑', '도윤', '채린', '이름 미정', '연', 'P']) check(await page.locator(`.ccard .nm:text-is("${n}")`).count() === 0, `옛 이름 ${n} 없음`)
check(await page.locator('.ccard:has-text("획득 불가")').count() === 0 && await page.locator('.ccard.pending').count() === 0, '설정 미정·획득 불가 표시 없음')
const names = async () => (await page.locator('.ccard .nm').allTextContents()).map((t) => t.trim())
await page.click('.cl-side-item:has-text("미보유")'); await W(700)
check((await names()).length === 9 && !(await names()).includes('라온') && !(await names()).includes('하랑'), '미보유 필터 = 보유 2명(라온·하랑) 제외 9명')
await page.click('.cl-side-item:has-text("Ex")'); await W(600)
check(await page.locator('.cl-empty:has-text("Ex 캐릭터가 아직 없습니다")').count() === 1, 'Ex 필터 = 빈 상태 안내(데이터 없음)')
await page.click('.cl-side-item:has-text("전체")'); await W(900)
await page.hover('.ccard:has-text("라온")'); await page.click('.cl-fav[aria-label^="라온 즐겨찾기"]'); await W(500)
check((await st()).favorites?.includes('rion'), '하트 → 즐겨찾기 저장')
await page.click('.cl-side-item:has-text("즐겨찾기")'); await W(700)
check(JSON.stringify(await names()) === JSON.stringify(['라온']), '즐겨찾기 필터 = 라온')
await page.click('.cl-fav[aria-label^="라온 즐겨찾기"]'); await W(500)
check(await page.locator('.cl-empty').count() === 1 && !(await st()).favorites.includes('rion'), '하트 다시 누르면 해제')
await page.click('.cl-side-item:has-text("전체")'); await W(900)
await page.click('.cl-sort-btn'); await W(300); await page.click('.cl-sort-menu button:has-text("이름순")'); await W(800)
const owned = (await names()).slice(0, 2)
check(JSON.stringify(owned) === JSON.stringify([...owned].sort((a, b) => a.localeCompare(b, 'ko'))), '이름순 정렬(보유 캐릭터)')
await page.click('.cl-theme button:has-text("DARK")'); await W(600)
check((await st()).settings.charListTheme === 'dark' && await page.locator('.ui-clist.cl-dark').count() === 1, '다크 테마 전환·저장')
await page.click('.cl-theme button:has-text("LIGHT")'); await W(400)

// 2) 상세: 11명 모두 정식 포맷(이름·아트·역할·수치·스킬 3개). 센카·마유 포함 튕김 없음
const EN = { rion: 'RAON', doyun: 'HARANG', seren: 'SEREN', ian: 'IAN', chaerin: 'KANNA', senka: 'SENKA', swordswoman: 'VX', baekrin: 'BAEKRIN', kiyomi: 'KIYOMI', kimono: 'BORA', mayu: 'MAYU' }
for (const [id, en] of Object.entries(EN)) {
  const before = errs.length
  await page.goto(BASE + `?screen=characterDetail&id=${id}`); await W(1400)
  const name = (await page.locator('.cd2-name').textContent().catch(() => '')).replace(/\s/g, '')
  const vals = (await page.locator('.cd2-val').allTextContents()).map((t) => t.trim())
  await page.click('.screen-active button[aria-label^="SKILLS"]'); await W(300)
  const rows = await page.locator('.cd2-row:not(.cd2-row-tbd)').count()
  check(errs.length === before && name.startsWith(en) && vals.length > 0 && vals.every((v) => v !== '—') && rows === 3 && await page.locator('.cd2-role:has-text("TBD")').count() === 0, `상세 ${id}: ${en} · 수치 ${vals.length}칸 · 스킬 ${rows}개`)
}
check(await page.locator('.cd2-hero img[src*="detail-art/mayu"]').count() === 1, '마유 상세 아트 = 배경 제거본')
await page.goto(BASE + '?screen=characterDetail&id=senka'); await W(1400)
check(await page.locator('.cd2-hero img[src*="detail-art/senka"]').count() === 1, '센카 상세 아트 = 배경 제거본')

// 3) 영입: NEW FACES 미리보기, 재화 변화 없음
await page.goto(BASE + '?screen=recruit'); await W(2200)
const wallet = JSON.stringify((await st()).wallet)
await page.click('.screen-active button[aria-label^="신규 대원"]'); await W(900)
check(await page.locator('.nf-card').count() === 4, 'NEW FACES 카드 4장')
check(await page.locator('.nf-chip.warn:has-text("신규 대원 소개")').count() === 1, '신규 대원 소개 표시')
await page.click('.nf-card:has-text("키요미")'); await W(700)
check((await page.locator('.nf-name .en').textContent()).replace(/\s/g, '') === 'KIYOMI' && await page.locator('.nf-scene[src*="lobby/kiyomi"]').count() === 1, '카드 선택 → 이름·전용 장면 함께 전환')
await page.keyboard.press('Escape'); await W(500)
check(await page.locator('.nf').count() === 0 && await page.locator('.screen-active .ui-recruit').count() === 1, 'Esc = 미리보기만 닫고 영입 화면 유지')
check(JSON.stringify((await st()).wallet) === wallet, '미리보기로 재화 변화 없음')
await page.click('.screen-active button[aria-label^="신규 대원"]'); await W(700)
await page.click('.nf-card:has-text("백린")'); await W(400)
await page.click('.nf-btn:has-text("상세 보기")'); await W(1200)
check((await page.locator('.cd2-name').textContent()).replace(/\s/g, '') === 'BAEKRIN', '미리보기 → 상세 보기 = 백린 상세')

// 4) 로비: 전용 장면이면 장면 그림을 쓴다(인물 중복 없음). 보유하지 않은 캐릭터는 로비 설정 불가
check((await page.evaluate(() => window.__AK__.setLobbyCharacter('kiyomi'))).ok === false, '미보유 신규 캐릭터는 로비 설정 거부')
for (const [id, theme] of [['kiyomi', 'station'], ['kimono', 'station']]) {
  await page.evaluate(([i, t]) => window.__AK__.commit((s) => { s.lobby.characterId = i; s.lobby.theme = t }), [id, theme])
  await page.goto(BASE + '?screen=lobby'); await W(1500)
  check(await page.locator(`.screen-active img.mv.scene[src*="lobby/${id}"]`).count() === 1 && await page.locator('.screen-active video.mv').count() === 0, `${theme} 로비: ${id} 전용 장면, 기본 영상 없음`)
}
await page.evaluate(() => window.__AK__.commit((s) => { s.lobby.characterId = 'rion'; s.lobby.theme = 'station' }))

console.log('errors:', errs.length ? errs : 'none')
console.log('FAILS', fails + (errs.length ? 1 : 0))
await browser.close()
process.exit(fails || errs.length ? 1 : 0)
