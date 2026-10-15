// 1장 전투 밸런스 확인(화면 없이): AUTO만 / 지휘(집중·장치·버프 포함) 두 방식으로 여러 번 돌려 승률·시간을 본다.
import { newSim, step, castActive, castBuff, setFocus, useDevice, starsOf, isAlive, type Sim, type AllyKind } from '../../src/game/combat/sim'
import { STAGES } from '../../src/game/combat/chapter1Stages'

function commander(s: Sim) {
  const foes = s.units.filter((u) => u.side === 'enemy' && isAlive(u) && !u.entering)
  const pri = foes.find((u) => u.kind === 'pylon') ?? foes.find((u) => u.kind === 'mite') ?? foes.find((u) => u.tele && (u.tele.k === 'cast' || u.tele.k === 'noise' || u.tele.k === 'call')) ?? foes.find((u) => u.kind === 'caller')
  if (pri && s.focus !== pri.id) setFocus(s, pri.id)
  for (const d of s.devices) if (d.k === 'shutter' && d.closed <= 0 && d.cool <= 0 && s.units.some((u) => u.kind === 'caller' && isAlive(u))) useDevice(s, d.id)
  const noise = foes.find((u) => u.tele?.k === 'noise' || u.tele?.k === 'cast')
  if (noise) { castActive(s, 'seren'); castActive(s, 'rion') }
  for (const id of ['rion', 'seren', 'kanna'] as AllyKind[]) castBuff(s, id)
}
for (const [id, def] of Object.entries(STAGES)) {
  for (const mode of ['auto', 'cmd'] as const) {
    let win = 0, tsum = 0, minHp = 0, relay = 0, brk = 0, stars = [0, 0, 0], why: Record<string, number> = {}
    const N = 30
    for (let i = 0; i < N; i++) {
      const s = newSim(def, 1000 + i)
      let mh = 1
      while (!s.result && s.t < 400) { if (mode === 'cmd') commander(s); step(s, 1 / 30, true); for (const u of s.units) if (u.side === 'ally') mh = Math.min(mh, u.hp / u.st.maxHp) }
      minHp += mh; relay += s.cnt.relayMin; brk += s.cnt.breaks
      if (s.result === 'win') { win++; tsum += s.t; starsOf(s).forEach((v, k) => { if (v) stars[k]++ }) } else why[s.why] = (why[s.why] ?? 0) + 1
    }
    console.log(id.padEnd(5), mode.padEnd(4), `win ${win}/${N}`, `avg ${(tsum / Math.max(1, win)).toFixed(0)}s`, 'stars', stars.join('/'), `minHp ${(minHp / N).toFixed(2)} relay ${(relay / N).toFixed(2)} brk ${(brk / N).toFixed(1)}`, JSON.stringify(why))
  }
}
