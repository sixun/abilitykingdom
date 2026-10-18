import { useState, type CSSProperties } from 'react'
import { audio, LOBBY_TRACKS, DEFAULT_LOBBY_TRACK } from '../app/audio'
import { game, useGame } from '../game/store'
import { CHARACTERS } from '../game/data/characters'
import { LOBBY_SCENES } from '../game/data/lobbyScenes'
import { Modal, Btn } from './components'
import { RoleGlyph } from './icons'
import { Hit } from './ref'

// 로비 빠른 버튼: 배경음악 고르기(LP) · 로비 캐릭터 고르기(카드). 버튼 그림은 GPT Image 2.5 시안 4종 중 사용자가 고른 D안
// (원본 시트 tools/ui_src/lobby_btn_sheet1.png → public/ui/lobby-*.webp)
type R = { x: number; y: number; w: number; h: number }

export function QuickBtn({ kind, r, label, onClick, z = 40 }: { kind: 'bgm' | 'char'; r: R; label: string; onClick: () => void; z?: number }) {
  const s = useGame()
  // 음악이 켜져 있으면 LP가 천천히 돈다
  const spin = kind === 'bgm' && (s.settings.lobbyBgm ?? DEFAULT_LOBBY_TRACK) !== 'off' && s.settings.bgm > 0
  return (
    <>
      <img className={`lq-btn lq-${kind}${spin ? ' spin' : ''}`} src={`ui/lobby-${kind}.webp`} alt="" draggable={false} style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: z - 1 }} />
      <Hit r={r} z={z} label={label} sfx="none" onClick={() => { audio.sfx('open'); onClick() }} className="lq-hit" />
    </>
  )
}

export function LobbyBgmPicker({ onClose }: { onClose: () => void }) {
  const s = useGame()
  const cur = s.settings.lobbyBgm ?? DEFAULT_LOBBY_TRACK
  const pick = (id: string) => { audio.sfx('select'); game.updateSettings({ lobbyBgm: id }) }
  const vol = Math.round(s.settings.bgm * 100)
  return (
    <Modal className="lq-bgm-modal" onClose={onClose} labelledBy="lq-bgm-title">
      <h2 id="lq-bgm-title">로비 배경음악</h2>
      <p className="lq-note">로비에서 흐를 곡을 고릅니다. 고르면 바로 바뀌고, 다른 화면은 각자 정해진 곡을 씁니다.</p>
      <div className="lq-tracks" role="radiogroup" aria-label="로비 곡">
        {LOBBY_TRACKS.map((t, i) => (
          <button key={t.id} type="button" role="radio" aria-checked={cur === t.id} className={cur === t.id ? 'on' : ''} onClick={() => pick(t.id)} style={{ '--i': i } as CSSProperties}>
            <i className="lq-eq" aria-hidden><b /><b /><b /></i>
            <span><strong>{t.title}</strong><small>{t.sub}</small></span>
          </button>
        ))}
        <button type="button" role="radio" aria-checked={cur === 'off'} className={`off ${cur === 'off' ? 'on' : ''}`} onClick={() => pick('off')}>
          <i className="lq-eq" aria-hidden><b /><b /><b /></i>
          <span><strong>음악 끄기</strong><small>로비에서는 조용히</small></span>
        </button>
      </div>
      <label className="lq-vol">
        <span>배경음악 음량</span>
        <input type="range" min={0} max={100} step={5} value={vol} onChange={(e) => game.updateSettings({ bgm: Number(e.target.value) / 100 })} />
        <em className="num-tab">{vol}</em>
      </label>
      <div className="confirm-actions"><Btn variant="dark" onClick={onClose}>닫기</Btn></div>
    </Modal>
  )
}

export function LobbyCharPicker({ onClose }: { onClose: () => void }) {
  const s = useGame()
  return (
    <Modal className="lb-picker" onClose={onClose} labelledBy="pick-title">
      <h2 id="pick-title">로비 캐릭터</h2>
      <p className="lb-picker-note">로비에 전시할 캐릭터입니다. 팀 리더와는 따로 저장됩니다. 전용 로비 장면이 없는 대원은 거리 배경 위 전신 그림으로 보여 줍니다.</p>
      <div className="lb-picker-grid">
        {CHARACTERS.filter((x) => s.owned[x.id]).map((x) => (
          <button key={x.id} className={x.id === s.lobby.characterId ? 'on' : ''} onClick={async () => { audio.sfx('select'); await game.setLobbyCharacter(x.id); onClose() }}>
            <img src={x.assets.portrait} alt="" />
            <span><RoleGlyph role={x.role} size="1.4rem" /> {x.name}{LOBBY_SCENES[x.id] ? ' · 전용 장면' : ''}</span>
          </button>
        ))}
      </div>
      <div className="confirm-actions"><Btn variant="dark" onClick={onClose}>닫기</Btn></div>
    </Modal>
  )
}

/** 두 창의 열림 상태를 한 번에 */
export function useLobbyQuick() {
  const [open, setOpen] = useState<null | 'bgm' | 'char'>(null)
  const close = () => setOpen(null)
  const modal = open === 'bgm' ? <LobbyBgmPicker onClose={close} /> : open === 'char' ? <LobbyCharPicker onClose={close} /> : null
  return { open: setOpen, modal }
}
