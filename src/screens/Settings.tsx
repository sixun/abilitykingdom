import { useState } from 'react'
import '../styles/screens.css'
import { useNav } from '../app/nav'
import { audio } from '../app/audio'
import { game, useGame } from '../game/store'
import { TopBar, Btn, ConfirmDialog } from '../ui/components'

// 설정: 실제로 동작하는 항목만 둔다
export default function Settings(_: { params: Record<string, unknown> }) {
  const s = useGame()
  const nav = useNav()
  const st = s.settings
  const [confirmReset, setConfirmReset] = useState(false)
  const [fail, setFail] = useState(game.getFailureRate())

  const vol = (key: 'bgm' | 'sfx' | 'voice', label: string, note?: string) => (
    <label className="set-row">
      <span>{label}{note && <small>{note}</small>}</span>
      <input type="range" min={0} max={1} step={0.05} value={st[key]} onChange={(e) => game.updateSettings({ [key]: +e.target.value })} onPointerUp={() => audio.sfx('tap')} aria-label={label} />
      <b className="num">{Math.round(st[key] * 100)}</b>
    </label>
  )

  return (
    <div className="scr ops settings">
      <TopBar title="설정" sub="SETTINGS" />
      <div className="ops-wide scroll-y">
        <h3 className="set-h">사운드</h3>
        {vol('bgm', '배경음')}
        {vol('sfx', '효과음')}
        {vol('voice', '음성', '음성 에셋 미적용')}
        <h3 className="set-h">화면</h3>
        <div className="set-row">
          <span>그래픽 품질<small>낮음: 그림자·필터 효과 끔</small></span>
          <div className="seg">
            {(['high', 'low'] as const).map((q) => <button key={q} className={st.quality === q ? 'on' : ''} onClick={() => { audio.sfx('select'); game.updateSettings({ quality: q }) }}>{q === 'high' ? '높음' : '낮음'}</button>)}
          </div>
        </div>
        <div className="set-row">
          <span>연출 감소<small>화면 전환·흔들림·반복 애니메이션 최소화</small></span>
          <div className="seg">
            {[false, true].map((v) => <button key={String(v)} className={st.reduceMotion === v ? 'on' : ''} onClick={() => { audio.sfx('select'); game.updateSettings({ reduceMotion: v }) }}>{v ? '켜기' : '끄기'}</button>)}
          </div>
        </div>
        <div className="set-row">
          <span>오프닝 다시 보기</span>
          <Btn size="sm" variant="dark" onClick={() => nav.reset('boot')}>재생</Btn>
        </div>
        <h3 className="set-h">계정 · 데이터</h3>
        <div className="set-row">
          <span>저장 위치<small>이 브라우저(로컬). 서버·계정 연동 전 임시 저장</small></span>
          <Btn size="sm" variant="danger" onClick={() => setConfirmReset(true)}>로컬 데이터 초기화</Btn>
        </div>
        <h3 className="set-h">개발 · 검증</h3>
        <div className="set-row">
          <span>요청 실패 시뮬레이션<small>켜면 일부 요청이 실패하거나 응답이 유실됩니다. 재시도 시 중복 지급되지 않는지 확인용</small></span>
          <div className="seg">
            {[0, 0.3, 0.6].map((v) => <button key={v} className={fail === v ? 'on' : ''} onClick={() => { audio.sfx('select'); game.setFailureRate(v); setFail(v) }}>{v === 0 ? '끔' : `${v * 100}%`}</button>)}
          </div>
        </div>
      </div>
      {confirmReset && (
        <ConfirmDialog title="로컬 데이터를 초기화할까요?" body="보유 캐릭터, 편성, 재화, 기록이 모두 처음 상태로 돌아갑니다. 되돌릴 수 없습니다." actions={[
          { label: '취소', variant: 'ghost', onClick: () => setConfirmReset(false) },
          { label: '초기화', variant: 'danger', onClick: () => { game.resetAll(); setConfirmReset(false); nav.toast('데이터를 초기화했습니다.', 'warn'); nav.home() } },
        ]} />
      )}
    </div>
  )
}
