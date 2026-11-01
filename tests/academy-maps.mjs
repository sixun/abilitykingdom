// 아카데미 맵 2개(정문 진입로 · 수업동 복도) 확인: 진입 · 걷기 · 막힘 · 계단 · 출입구 전환(되돌아가는 반복 없음)
// dev 서버 실행 중에: node tests/academy-maps.mjs [BASE] [스크린샷 폴더]
// 소프트웨어 WebGL이라 프레임이 느려서 이동 확인은 오래 누른다.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.argv[2] || 'http://127.0.0.1:5173/'
const OUT = process.argv[3] || 'test-results/academy-maps'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message))
let fails = 0
const check = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++ }
const W = (ms) => page.waitForTimeout(ms)
const ex = (f, a) => page.evaluate(f, a)
const me = () => ex(() => { const m = window.__EX__.me(); return { x: Math.round(m.x), y: Math.round(m.y) } })
const zoneId = () => ex(() => window.__EX__.zone())
const ready = () => page.waitForFunction(() => ['intro', 'play'].includes(window.__EX__?.phase?.()), null, { timeout: 90000 })
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await W(ms); for (const k of keys) await page.keyboard.up(k) }
const open = async (zone) => { await page.goto(`${BASE}?screen=story&zone=${zone}`); await ready(); await W(800) }

// 1) 정문 진입로: 진입 연출 → 시작 자리
await open('academy_gate')
check(await zoneId() === 'academy_gate', '정문 진입로 열림')
await page.screenshot({ path: `${OUT}/gate-intro.png` })
await ex(() => window.__EX__.setPhase('play')); await W(1500)
const s0 = await me()
check(await ex(([x, y]) => window.__EX__.walkable(x, y), [s0.x, s0.y]), `시작 자리(${s0.x}, ${s0.y})가 걷는 곳`)
await page.screenshot({ path: `${OUT}/gate-start.png` })
await hold(['d'], 4000)
check((await me()).x > s0.x + 40, '오른쪽으로 걷기')
// 막힘: 가운데 화단 북쪽에서 아래로 → 화단 가장자리에서 멈춤
await ex(() => window.__EX__.set(1800, 890, 'S')); await W(400)
await hold(['s'], 5000)
const b1 = await me()
check(b1.y < 960, `화단에 막힘(멈춘 y ${b1.y})`)
await page.screenshot({ path: `${OUT}/gate-planter.png` })
// 차도: 보도에서 아래로 → 차도에 못 들어감
await ex(() => window.__EX__.set(500, 1180, 'S')); await W(400)
await hold(['s'], 5000)
const r1 = await me()
check(!(await ex(() => window.__EX__.walkable(500, 1520))) && r1.y < 1500, `차도로 못 들어감(멈춘 y ${r1.y})`)

// 2) 정문 → 수업동 복도(테스트 연결)
await ex(() => window.__EX__.set(772, 470, 'N')); await W(500)
await hold(['w'], 6000); await W(2500); await ready()
check(await zoneId() === 'academy_hall', '정문 안쪽 길 → 수업동 복도')
const a1 = await me()
check(Math.abs(a1.x - 1800) < 40 && Math.abs(a1.y - 768) < 40, `복도 도착 자리(${a1.x}, ${a1.y})`)
await W(2500)
check(await zoneId() === 'academy_hall', '도착 직후 되돌아가지 않음')
await page.screenshot({ path: `${OUT}/hall-arrive.png` })

// 3) 복도: 아래층에서 계단으로 위층까지
await ex(() => window.__EX__.set(920, 1720, 'NE')); await W(400)
check(await ex(() => window.__EX__.walkable(920, 1720)), '계단 아래가 걷는 곳')
await hold(['w', 'd'], 9000)
const c1 = await me()
check(c1.y < 1620 && c1.x > 960, `계단을 따라 올라감(y 1720 → ${c1.y})`)
await page.screenshot({ path: `${OUT}/hall-stairs.png` })

// 4) 복도 → 정문
await ex(() => window.__EX__.set(1810, 760, 'N')); await W(500)
await hold(['w'], 6000); await W(2500); await ready()
check(await zoneId() === 'academy_gate', '복도 유리문 → 정문 진입로')
await W(2500)
check(await zoneId() === 'academy_gate', '도착 직후 되돌아가지 않음(정문)')
await page.screenshot({ path: `${OUT}/gate-arrive.png` })

// 5) 기존 스토리 탐색(큰 지도)은 그대로
await page.goto(`${BASE}?screen=story`); await ready()
check(await zoneId() === 'academy', '기존 스토리 탐색은 아카데미 큰 지도 그대로')

console.log('errors:', errs.length ? errs : 'none')
console.log('FAILS', fails + (errs.length ? 1 : 0))
await browser.close()
process.exit(fails || errs.length ? 1 : 0)
