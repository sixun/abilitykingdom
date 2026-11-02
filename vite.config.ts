import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 필드 HUD 그림(src/assets/hud/*.webp)을 묶음 안에 data URL 로 넣는 가상 모듈.
// 아티팩트 한 판에 파일이 512개까지라서 작은 그림 26장을 따로 올리지 않는다.
const HUD_DIR = resolve(__dirname, 'src/assets/hud')
const hudSprites = (): Plugin => ({
  name: 'hud-sprites',
  resolveId: (id) => (id === 'virtual:hud-sprites' ? '\0virtual:hud-sprites' : null),
  load(id) {
    if (id !== '\0virtual:hud-sprites') return null
    const out: Record<string, string> = {}
    for (const f of readdirSync(HUD_DIR).filter((f) => f.endsWith('.webp')).sort()) {
      this.addWatchFile(resolve(HUD_DIR, f))
      out[f.replace(/\.webp$/, '')] = 'data:image/webp;base64,' + readFileSync(resolve(HUD_DIR, f)).toString('base64')
    }
    return `export default ${JSON.stringify(out)}`
  },
})

export default defineConfig({
  base: './',
  plugins: [react(), hudSprites()],
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 1200 },
})
