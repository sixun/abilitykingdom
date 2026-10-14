// Media routing regression; browser emulation does not reproduce iPhone memory limits.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { chromium, webkit, devices } from 'playwright'

const server = await createServer({ server: { host: '127.0.0.1', port: 5191, strictPort: true } })
await server.listen()
const browser = await (process.env.AK_WEBKIT ? webkit : chromium).launch({ headless: true, executablePath: process.env.AK_BROWSER_PATH })
try {
  const context = await browser.newContext({ ...devices['iPhone 13'] })
  const page = await context.newPage()
  const errors = []
  const media = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => { if (/\/motion\/sofa\.(mp4|webm)/.test(r.url())) media.push(r.url()) })
  await page.goto('http://127.0.0.1:5191/?screen=lobby')
  await page.locator('.screen-active .mv').waitFor()
  await page.waitForTimeout(2500)
  assert(media.some((url) => url.endsWith('/motion/sofa.mp4')))
  assert(!media.some((url) => url.endsWith('.webm')))
  if (await page.locator('.screen-active video.mv').count()) {
    assert.equal(await page.locator('.screen-active video.mv').evaluate((v) => getComputedStyle(v).animationName), 'none')
  } else {
    assert((await page.locator('.screen-active img.mv').getAttribute('src')).endsWith('sofa-poster.webp'))
  }
  await page.getByRole('button', { name: '캐릭터', exact: true }).click()
  await page.locator('.screen-active .chars').waitFor()
  await page.goto('http://127.0.0.1:5191/')
  await page.waitForFunction(() => document.querySelector('.boot-cta')?.textContent === 'TAP TO START')
  await page.getByRole('button', { name: 'TAP TO START' }).click()
  await page.locator('.screen-active .op').waitFor()
  assert.equal(await page.evaluate(async () => (await import('/src/app/openingVideo.ts')).pickSource(false)), 'assets/video/opening_720.mp4')
  assert.equal((await page.request.get('http://127.0.0.1:5191/assets/audio/opening_song.mp3')).status(), 200)
  await page.waitForTimeout(1500)
  assert.equal(await page.evaluate(() => window.__AK_SONG__()), true)
  assert.deepEqual(errors, [])
  console.log('PASS: iOS MP4 only, video compositing, lobby navigation, opening 720p and BGM playback')
} finally {
  await browser.close()
  await server.close()
}
