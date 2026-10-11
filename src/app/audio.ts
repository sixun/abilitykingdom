// 합성 사운드(임시). 실제 BGM·효과음·음성 에셋이 들어오면 같은 인터페이스로 교체한다.
// 기존 게임 음악을 복제하지 않기 위해 모든 소리는 코드로 생성한다.

type Sfx = 'tap' | 'select' | 'swap' | 'save' | 'error' | 'coin' | 'reveal' | 'reveal5' | 'whoosh' | 'slash' | 'hit' | 'title' | 'open'
type Bgm = 'none' | 'opening' | 'lobby' | 'menu' | 'battle'

class AudioEngine {
  ctx: AudioContext | null = null
  private master!: GainNode
  private bgmBus!: GainNode
  private sfxBus!: GainNode
  private noise!: AudioBuffer
  private bgmTimer: number | null = null
  private current: Bgm = 'none'
  private vol = { bgm: 0.6, sfx: 0.8 }
  private step = 0
  private nextTime = 0

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination)
      this.bgmBus = this.ctx.createGain(); this.bgmBus.connect(this.master)
      this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master)
      const len = this.ctx.sampleRate
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      this.applyVolumes()
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return
        if (document.hidden) this.ctx.suspend()
        else this.ctx.resume()
      })
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  setVolumes(bgm: number, sfx: number) {
    this.vol = { bgm, sfx }
    this.applyVolumes()
  }
  private applyVolumes() {
    if (!this.ctx) return
    this.bgmBus.gain.setTargetAtTime(this.vol.bgm * 0.5, this.ctx.currentTime, 0.05)
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.6, this.ctx.currentTime, 0.02)
  }

  private tone(t: number, freq: number, dur: number, type: OscillatorType, gain: number, bus: GainNode, slideTo?: number) {
    const c = this.ctx!
    const o = c.createOscillator(); const g = c.createGain()
    o.type = type; o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g); g.connect(bus)
    o.start(t); o.stop(t + dur + 0.02)
  }
  private noiseHit(t: number, dur: number, gain: number, bus: GainNode, hp = 3000, bp?: number) {
    const c = this.ctx!
    const s = c.createBufferSource(); s.buffer = this.noise
    const f = c.createBiquadFilter(); f.type = bp ? 'bandpass' : 'highpass'; f.frequency.value = bp ?? hp
    const g = c.createGain()
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(f); f.connect(g); g.connect(bus)
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02)
  }

  sfx(name: Sfx) {
    if (!this.ctx || this.vol.sfx <= 0) return
    const t = this.ctx.currentTime + 0.005, b = this.sfxBus
    switch (name) {
      case 'tap': this.tone(t, 880, 0.06, 'triangle', 0.25, b, 1320); break
      case 'select': this.tone(t, 660, 0.07, 'square', 0.12, b); this.tone(t + 0.05, 990, 0.09, 'square', 0.1, b); break
      case 'swap': this.noiseHit(t, 0.18, 0.25, b, 0, 1800); this.tone(t, 300, 0.15, 'sawtooth', 0.08, b, 900); break
      case 'save': [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.05, f, 0.25, 'triangle', 0.18, b)); break
      case 'error': this.tone(t, 220, 0.12, 'square', 0.15, b); this.tone(t + 0.12, 165, 0.18, 'square', 0.15, b); break
      case 'coin': this.tone(t, 1318, 0.06, 'square', 0.12, b); this.tone(t + 0.06, 1760, 0.18, 'square', 0.12, b); break
      case 'open': this.tone(t, 200, 0.2, 'sine', 0.2, b, 600); break
      case 'reveal': this.noiseHit(t, 0.4, 0.3, b, 2000); [784, 988, 1175].forEach((f, i) => this.tone(t + i * 0.06, f, 0.35, 'triangle', 0.15, b)); break
      case 'reveal5': this.noiseHit(t, 0.8, 0.35, b, 1200); [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(t + i * 0.07, f, 0.6, 'sawtooth', 0.08, b)); break
      case 'whoosh': this.noiseHit(t, 0.35, 0.35, b, 0, 900); break
      case 'slash': this.noiseHit(t, 0.22, 0.45, b, 4000); this.tone(t, 1800, 0.18, 'sawtooth', 0.06, b, 300); break
      case 'hit': this.noiseHit(t, 0.12, 0.4, b, 0, 400); this.tone(t, 120, 0.12, 'sine', 0.4, b, 50); break
      case 'title': this.tone(t, 110, 1.2, 'sawtooth', 0.15, b, 55); this.noiseHit(t, 1.0, 0.3, b, 600); break
    }
  }

  bgm(kind: Bgm) {
    if (kind === this.current) return
    this.current = kind
    if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null }
    if (!this.ctx || kind === 'none') return
    this.step = 0
    this.nextTime = this.ctx.currentTime + 0.05
    const bpm = kind === 'opening' ? 152 : kind === 'battle' ? 140 : kind === 'lobby' ? 86 : 96
    const stepDur = 60 / bpm / 4
    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx) return
      while (this.nextTime < this.ctx.currentTime + 0.15) {
        this.playStep(kind, this.step, this.nextTime, stepDur)
        this.nextTime += stepDur
        this.step++
      }
    }, 40)
  }

  private playStep(kind: Bgm, i: number, t: number, sd: number) {
    const b = this.bgmBus
    const s16 = i % 16, bar = Math.floor(i / 16)
    if (kind === 'opening' || kind === 'battle') {
      const prog = [[110, 220], [87.3, 174.6], [130.8, 261.6], [98, 196]][bar % 4]
      if (s16 % 4 === 0) { this.tone(t, 150, 0.18, 'sine', 0.9, b, 40) }
      if (s16 === 4 || s16 === 12) this.noiseHit(t, 0.16, 0.5, b, 1500)
      if (s16 % 2 === 1) this.noiseHit(t, 0.04, 0.18, b, 8000)
      if (s16 % 2 === 0) this.tone(t, prog[0], sd * 1.6, 'sawtooth', 0.22, b)
      if (kind === 'opening' && [0, 3, 6, 10, 12].includes(s16)) this.tone(t, prog[1] * 2, sd * 1.4, 'square', 0.07, b)
      if (kind === 'opening' && bar % 2 === 1 && s16 === 14) this.noiseHit(t, 0.3, 0.3, b, 0, 1200)
    } else {
      const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]][bar % 4]
      if (s16 === 0) chords.forEach((f) => this.tone(t, f, sd * 14, 'triangle', 0.05, b))
      if (s16 === 0 || s16 === 10) this.tone(t, 90, 0.25, 'sine', 0.45, b, 45)
      if (s16 === 4 || s16 === 12) this.noiseHit(t, 0.08, 0.12, b, 2500)
      if (s16 % 4 === 2) this.noiseHit(t, 0.03, 0.06, b, 9000)
      if (kind === 'lobby' && [6, 14].includes(s16) && bar % 2 === 0) this.tone(t, chords[2] * 2, 0.3, 'sine', 0.05, b)
    }
  }
}

export const audio = new AudioEngine()
