// 테스트용 상태 준비: 초기 보유(라온·하랑) 외 대원을 보유 상태로 만들어 저장하고 새로고침한다.
export async function seedOwned(page, ids, level = 40, extra = (s) => s) {
  await page.evaluate(([ids, level, extraSrc]) => {
    const s = window.__AK__.getState()
    const st = JSON.parse(JSON.stringify(s))
    for (const id of ids) if (!st.owned[id]) st.owned[id] = { id, level, obtainedAt: Date.now(), dupes: 0, equipment: { weapon: null, gear: null, accessory: null } }
    const out = new Function('s', `return (${extraSrc})(s)`)(st)
    localStorage.setItem('ability-kingdom.save.v1', JSON.stringify(out))
  }, [ids, level, extra.toString()])
  await page.reload()
}
