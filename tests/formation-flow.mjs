// 오프닝 → 로비 → 편성(원본 재현 화면) 흐름 검증. dev 서버 실행 중에: node tests/formation-flow.mjs [BASE]
import { chromium } from 'playwright'
import { seedOwned } from './_seed.mjs'
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1456, height: 819 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('PAGEERR ' + e.message))
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL')) errs.push('CONSOLE ' + m.text()) })
const log = (...a) => console.log(...a)
const st = () => page.evaluate(() => window.__AK__.getState())
let fails = 0
const check = (cond, msg) => { log(cond ? 'PASS' : 'FAIL', msg); if (!cond) fails++ }
const W = (ms = 400) => page.waitForTimeout(ms)
const LOBBY = '.screen-active button[aria-label="더보기 메뉴"]'
const isLobby = async () => (await page.locator(LOBBY).count()) === 1
const slotNames = () => page.$$eval('.screen-active button.fm-fig', (e) => e.map((x) => x.getAttribute('aria-label').replace(/^\d번 슬롯 /, '').replace(/ 선택$/, '')))

// 0) 편성 교체를 확인하려고 보유 대원 4명(세렌·이안·칸나·센카)을 더 준비(초기 보유는 라온·하랑)
await page.goto(BASE + '?screen=lobby'); await W(1500)
await seedOwned(page, ['seren', 'ian', 'chaerin', 'senka']); await W(800)

// 1) 부트 → 오프닝 → 타이틀 → 입력 → 로비
await page.goto(BASE)
await page.waitForSelector('.boot-cta.on', { timeout: 20000 })
await page.mouse.click(700, 400)
await W(250)
check(await page.locator('.op').count() === 1, '오프닝 시작')
check(await page.evaluate(() => { const a = document.querySelector('.op .op-song'); const v = document.querySelector('.op video'); return !!a && !a.paused && !!v && v.paused }), '노래가 먼저 시작, 영상은 아직 대기')
await W(900)
const sync = await page.evaluate(() => { const a = document.querySelector('.op .op-song'); const v = document.querySelector('.op video'); return { playing: !v.paused, muted: v.muted, gap: a.currentTime - v.currentTime } })
check(sync.playing && !sync.muted, '0.6초 뒤 영상 시작(영상 원래 소리 + 노래 함께)')
check(Math.abs(sync.gap - 0.6) < 0.2, `노래와 영상 간격 0.6초 유지 (${sync.gap.toFixed(2)}초)`)
const t0 = Date.now()
await page.waitForFunction(() => document.querySelector('.op .sr-only')?.textContent === 'PRESS ANY BUTTON', null, { timeout: 20000 })
const tPress = (Date.now() - t0) / 1000
check(tPress > 12.4 && tPress < 16, `영상 속 타이틀(13초) 이후 입력 대기 시작 (${tPress.toFixed(1)}s)`)
check(!(await page.evaluate(() => /[가-힣]/.test(document.querySelector('.op').innerText))), '오프닝/타이틀에 한글 없음')
await W(2500)
check(!(await isLobby()), '입력 없이 로비로 자동 진입하지 않음')
await page.keyboard.press('Enter')
await W(1500)
check(await isLobby(), '입력 후 로비 진입')
check(!(await page.evaluate(() => window.__AK_SONG__())), '로비 진입 시 오프닝 노래 정지')

// 2) 로비 → 편성 → 교체 → 저장 → 로비 → 편성 재진입
await page.click('.screen-active button[aria-label="편성"]'); await W(900)
check(await page.locator('.screen-active button.fm-save').count() === 1, '편성 진입')
check((await slotNames()).join() === '라온,하랑,빈 슬롯,빈 슬롯', `기본 편성 = 라온·하랑 (${(await slotNames()).join()})`)
await page.click('.screen-active button[aria-label^="3번 슬롯"]')
await page.click('.screen-active button.fm-thumb[aria-label^="세렌"]'); await W(500)
check(await page.locator('.rf-dirty').count() === 1, '저장 전 변경 표시')
check(await page.locator('.screen-active img.rf-dyn:not(.ghost)[src*="seren"]').count() === 1, '바뀐 슬롯에 동적 인물 표시')
await page.click('.screen-active button.fm-thumb[aria-label^="라온"]'); await W(500)
check((await slotNames()).join() === '세렌,하랑,라온,빈 슬롯', `팀 내 캐릭터 선택 시 위치 교환 (${(await slotNames()).join()})`)
await page.click('.screen-active button[aria-label="돌아가기"]'); await W(400)
check(await page.locator('.modal h2:has-text("저장하지 않은 변경")').count() === 1, '저장 전 뒤로가기 확인 팝업')
await page.click('.modal button:has-text("계속 편집")'); await W(300)
await page.click('.screen-active button.fm-save'); await W(700)
let s = await st()
check(JSON.stringify(s.teams[0].slots) === JSON.stringify(['seren', 'doyun', 'rion', null]), `저장 반영 ${s.teams[0].slots}`)
check(s.teams[0].leaderId === 'rion', '리더 유지(라온)')
await page.click('.screen-active button[aria-label="돌아가기"]'); await W(800)
check(await isLobby(), '로비 복귀')
await page.click('.screen-active button[aria-label="편성"]'); await W(900)
check((await slotNames()).join() === '세렌,하랑,라온,빈 슬롯', '편성 재진입 시 저장 상태 표시')

// 3) 연타
await page.click('.screen-active button[aria-label^="2번 슬롯"]')
for (const n of ['이안', '칸나', '이안', '칸나', '이안']) await page.click(`.screen-active button.fm-thumb[aria-label^="${n}"]`)
await W(700)
check((await slotNames())[1] === '이안' && await page.locator('.screen-active img.rf-dyn:not(.ghost)[src*="/ian_"]').count() === 1, '연타 후 최종 선택과 화면 인물 일치')
check(await page.locator('.rf-dyn.ghost').count() === 0, '퇴장 연출 잔상 정리됨')
await page.click('.screen-active button.fm-save'); await W(700)
check((await st()).teams[0].slots[1] === 'ian', '연타 후 저장 결과 일치')

// 4) 팀 이름·리더·팀 전환
await page.click('.screen-active button.fm-team-edit')
await page.fill('input[aria-label="팀 이름"]', '출근조'); await page.keyboard.press('Enter')
await page.click('.screen-active button[aria-label^="1번 슬롯"]'); await W(200) // 다른 슬롯 선택 후
await page.click('.screen-active button[aria-label^="2번 슬롯"]'); await W(200)
if (!(await page.locator('.rf-pop').count())) { await page.click('.screen-active button[aria-label^="2번 슬롯"]'); await W(200) } // 선택된 슬롯을 다시 누르면 메뉴
await page.click('.rf-pop button:has-text("리더 지정")'); await W(200)
await page.click('.screen-active button.fm-team-btn[aria-label^="팀 02"]'); await W(300)
check(await page.locator('.modal').count() === 1, '저장 전 팀 전환 확인 팝업')
await page.click('.modal button:has-text("저장")'); await W(800)
s = await st()
check(s.teams[0].name === '출근조' && s.teams[0].leaderId === 'ian', `팀 이름·리더 저장 (${s.teams[0].name}, ${s.teams[0].leaderId})`)
check(s.teams[1].name === '팀 02' && s.activeTeamId === 'team2', '팀 02로 전환, 이름 변경은 해당 팀에만')
await page.click('.screen-active button.fm-team-btn[aria-label^="팀 03"]'); await W(500)
check(await page.locator('.rf-empty').count() === 4, '빈 슬롯 4개 표시')
await page.click('.screen-active button[aria-label="1번 바닥 슬롯 선택"]'); await page.click('.screen-active button.fm-thumb[aria-label^="센카"]'); await W(300)
await page.click('.screen-active button.fm-reset'); await W(400)
check(await page.locator('.rf-empty').count() === 4, '초기화 = 마지막 저장 상태로 되돌림')
await page.click('.screen-active button.fm-auto'); await W(500)
check((await slotNames()).every((n) => n !== '빈 슬롯'), '자동 편성(임시 규칙) 4명 배치')
await page.click('.screen-active button.fm-save'); await W(700)

// 5) 재시작 복원
await page.reload(); await W(800)
s = await st()
check(s.teams[0].name === '출근조' && s.teams[0].slots[1] === 'ian' && s.teams[2].slots.filter(Boolean).length === 4, '새로고침 후 저장 상태 복원')

// 6) 영상 재생 실패 → 정적 타이틀 대체
const p2 = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
await p2.route('**/assets/video/*.{mp4,webm}', (r) => r.abort())
await p2.goto(BASE)
await p2.waitForSelector('.boot-cta.on', { timeout: 20000 })
await p2.mouse.click(640, 360); await p2.waitForTimeout(1500)
check(await p2.locator('.op-title.static').count() === 1, '영상 실패 시 정적 타이틀로 대체')
await p2.keyboard.press('Space'); await p2.waitForTimeout(1500)
check(await p2.locator(LOBBY).count() === 1, '정적 타이틀에서도 입력 후 로비 진입')
log('errors:', errs.length ? errs : 'none')
log('FAILS', fails)
await browser.close()
process.exit(fails ? 1 : 0)
