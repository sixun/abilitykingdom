import type { CSSProperties } from 'react'
import { iconArt } from '../game/data/profile'

/** 프로필 아이콘(로비 원형 사진 · 대원증 사진 · 아이콘 고르기가 모두 이것을 쓴다) */
export function ProfileIcon({ id, className = '', style }: { id: string; className?: string; style?: CSSProperties }) {
  const a = iconArt(id)
  return (
    <span className={`pi ${className}`} aria-hidden
      style={{ backgroundImage: `url(${a.src})`, backgroundSize: a.half ? '200% 100%' : 'cover', backgroundPosition: a.half ? (a.half === 'm' ? '0% 0%' : '100% 0%') : '50% 18%', ...style }} />
  )
}
