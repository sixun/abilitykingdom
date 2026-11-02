// 스토리 필드 HUD(시안 배치) 기능 확인: 평타·액티브·회피·춤·탈것·퀘스트 자동 이동(포탈 넘어 이어짐)·지도·퀘스트·채팅·메뉴→로비
// dev 서버 실행 중에: node tests/field-hud.mjs [스크린샷 폴더]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const OUT = process.argv[2] || 'test-results/field-hud'
mkdirSync(OUT, { recursive: true })
let fails = 0
const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++ }
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
p.on('pageerror', (e) => console.log('ERR', e.message))
const W = (ms) => p.waitForTimeout(ms)
const ex = (f, a) => p.evaluate(f, a)
const hud = () => ex(() => window.__EX__.hud())
await p.goto('http://127.0.0.1:5173/?screen=story&zone=academy_gate')
await p.waitForFunction(() => ['intro', 'play'].includes(window.__EX__?.phase?.()), null, { timeout: 90000 })
await ex(() => window.__EX__.setPhase('play')); await W(2000)
const A = '.screen-active'
await p.click(`${A} button[aria-label="평타"]`); await W(150); await p.screenshot({ path: `${OUT}/h-attack.png` })
check((await hud()).gauge > 0, '평타 → 각성 게이지 증가')
await p.click(`${A} button[aria-label="액티브"]`); await W(200); await p.screenshot({ path: `${OUT}/h-active.png` })
check((await hud()).active > 6 && (await hud()).shieldT > 2, '액티브 → 쿨타임 8초·가속 버프')
const x0 = (await ex(() => window.__EX__.me())).x
await ex(() => { window.__EX__.set(window.__EX__.me().x, window.__EX__.me().y, 'E') })
await p.click(`${A} button[aria-label="회피"]`); await W(500)
check((await ex(() => window.__EX__.me())).x - x0 > 60 && (await hud()).dodge > 1, '회피 → 보는 방향으로 이동·쿨타임')
await p.click(`${A} button[aria-label="춤"]`); await W(600); await p.screenshot({ path: `${OUT}/h-dance.png` })
check((await hud()).dance > 1, '춤 → 제자리 춤')
await W(3000)
await p.click(`${A} button[aria-label^="탈것 타기"]`); await W(300)
check((await hud()).mounted === true, '탈것 타기')
// quest auto-move → should go through 도시 쪽 길 portal to shopping and continue
await p.click(`${A} button[aria-label="목표까지 자동 이동"]`); await W(400)
check((await hud()).auto === 'quest', '메인 사건 자동 이동 시작')
await p.waitForFunction(() => window.__EX__?.zone?.() === 'academy_shopping', null, { timeout: 60000 }).catch(() => console.log('no portal'))
await p.waitForFunction(() => window.__EX__?.phase?.() === 'play', null, { timeout: 60000 }); await W(1500)
check(await ex(() => window.__EX__.zone()) === 'academy_shopping', '자동 이동 → 도시 쪽 길 포탈 → 상점가')
check((await hud()).auto === 'quest' && (await hud()).mounted === true, '맵을 넘어도 자동 이동·탈것 유지')
await W(4000)

await p.screenshot({ path: `${OUT}/h-auto.png` })
await p.click(`${A} button[aria-label="지도"]`); await W(500); check(await p.locator(`${A} .fh-map`).count() === 1, '지도 열림'); await p.screenshot({ path: `${OUT}/h-map.png` })
await p.mouse.click(640, 400); await W(300)
await p.click(`${A} button[aria-label="퀘스트"]`); await W(400); check(await p.locator(`${A} .fh-qlist li`).count() === 8, '퀘스트 목록 = 1장 8개'); await p.screenshot({ path: `${OUT}/h-quests.png` })
await p.keyboard.press('Escape'); await p.mouse.click(30, 30); await W(300)
await p.click(`${A} .fh-cicon`); await p.keyboard.type('안녕하세요'); await p.keyboard.press('Enter'); await W(300)
check((await p.locator(`${A} .fh-clines p`).last().textContent()).includes('안녕하세요'), '채팅 입력')
await p.click(`${A} button[aria-label="전체 메뉴"]`); await W(300); await p.screenshot({ path: `${OUT}/h-menu.png` })
await p.click(`${A} .sf-back`); await W(1200)
check(await ex(() => document.querySelector('.stage')?.dataset.screen) === 'lobby', '메뉴 → 로비로 나가기')
console.log('FAILS', fails)
await b.close()
process.exit(fails ? 1 : 0)
