import { chromium } from 'playwright'
const out = '/tmp/claude-0/ew'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
p.on('pageerror', (e) => console.log('ERR', e.message))
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()) })
await p.goto('http://127.0.0.1:5173/?screen=storyField')
await p.waitForFunction(() => window.__EX__?.phase() === 'play', null, { timeout: 180000, polling: 500 })
await p.waitForTimeout(1500); await p.screenshot({ path: `${out}-plaza.png` })
const shots = [['fountain', 1350, 2180, 'W'], ['stairs', 4100, 2700, 'S'], ['lower', 2500, 3800, 'W'], ['stream', 5000, 3900, 'E'], ['pondview', 6500, 2000, 'NW'], ['bridge', 6100, 1760, 'W'], ['gazebo', 1250, 3720, 'W']]
for (const [n, x, y, d] of shots) { await p.evaluate(([x, y, d]) => window.__EX__.set(x, y, d), [x, y, d]); await p.waitForTimeout(3500); await p.screenshot({ path: `${out}-${n}.png` }) }
await p.screenshot({ path: `${out}-gazebo2.png` })
await b.close()
