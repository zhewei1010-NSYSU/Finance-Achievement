import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import PinkPig from './PinkPig'
import { X, ArrowUpRight, Sprout } from 'lucide-react'

export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string
  children: ReactNode
  close: () => void
  wide?: boolean
}) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const el = ref.current
    el?.querySelector<HTMLElement>('input,button,select,textarea')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'Tab' && el) {
        const items = [
          ...el.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
          ),
        ]
        const first = items[0],
          last = items.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      before?.focus()
    }
  }, [close])
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" aria-label="關閉視窗" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}
export function MoneyInput({
  name,
  defaultValue = 0,
  min = 0,
}: {
  name: string
  defaultValue?: number
  min?: number
}) {
  return (
    <input
      name={name}
      type="number"
      min={min}
      max={1e12}
      step="1"
      defaultValue={defaultValue}
      required
      inputMode="numeric"
    />
  )
}
export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Sprout size={28} />
      <p>{children}</p>
    </div>
  )
}
export function Ring({
  value,
  large = false,
  animationKey = 0,
  celebrating = false,
}: {
  value: number
  large?: boolean
  animationKey?: number
  celebrating?: boolean
}) {
  const target = Math.min(100, Math.max(0, value))
  const [displayed, setDisplayed] = useState(target)
  const current = useRef(target)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const finish = () => {
      cancelAnimationFrame(frame)
      current.current = target
      setDisplayed(target)
    }
    if (media.matches || Math.abs(current.current - target) < 0.001) {
      finish()
      return
    }
    const start = current.current,
      startedAt = performance.now()
    const tick = (now: number) => {
      const time = Math.min(1, Math.max(0, (now - startedAt) / 800))
      const next = start + (target - start) * (1 - Math.pow(1 - time, 3))
      current.current = next
      setDisplayed(next)
      if (time < 1) frame = requestAnimationFrame(tick)
    }
    const onPreference = () => {
      if (media.matches) finish()
    }
    media.addEventListener('change', onPreference)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      media.removeEventListener('change', onPreference)
    }
  }, [target])
  const r = 96,
    circumference = 2 * Math.PI * r
  const tone = target <= 30 ? 'gentle' : target <= 80 ? 'steady' : 'success'
  return (
    <div
      className={`goal-ring ${large ? 'large' : ''} ${tone}`}
      role="img"
      aria-label={`完成 ${Math.floor(target)}%`}
    >
      <svg className="progress-svg" viewBox="0 0 224 224" aria-hidden="true">
        <circle className="ring-track" cx="112" cy="112" r={r} />
        <circle
          className="ring-value"
          strokeOpacity={displayed === 0 ? 0 : 1}
          cx="112"
          cy="112"
          r={r}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - displayed / 100)}
          transform="rotate(-90 112 112)"
        />
      </svg>
      <div className="ring-center" aria-hidden="true">
        <span
          key={animationKey}
          className={`pig-scene ${animationKey ? 'deposit-active' : ''} ${celebrating ? 'celebrate-pig' : ''}`}
        >
          <PinkPig />
          {animationKey > 0 && (
            <span className="falling-coins">
              {[0].map((i) => (
                <svg key={i} viewBox="0 0 32 32" style={{ animationDelay: `${i * 0.16}s` }}>
                  <circle cx="16" cy="16" r="13" fill="#EBC873" stroke="#D6AE50" strokeWidth="2" />
                  <path
                    d="M16 8v16m5-13c-7-5-14 4-5 6 9 3 0 10-6 5"
                    stroke="#B58D35"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              ))}
            </span>
          )}
        </span>
        <strong data-testid="animated-percent">
          {Math.floor(displayed + 0.000001)}
          <small>%</small>
        </strong>
        <span className="ring-label">目標完成度</span>
      </div>
    </div>
  )
}
export function ActionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowUpRight size={16} />
    </button>
  )
}
