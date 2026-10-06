import type { InputHTMLAttributes } from 'react'

/** Native numeric validity plus strict decimal entry (no exponent or partial parsing). */
export default function StrictNumberInput({ onChange, onKeyDown, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type="number" inputMode={props.step == null || Number(props.step) === 1 ? 'numeric' : 'decimal'}
    onKeyDown={event => {
      if (['e', 'E', '+', '-'].includes(event.key) && !event.ctrlKey && !event.metaKey) event.preventDefault()
      onKeyDown?.(event)
    }}
    onChange={event => {
      const raw = event.currentTarget.value
      if (raw !== '' && (!/^\d+(?:\.\d*)?$/.test(raw) || !Number.isFinite(Number(raw)) ||
        ((props.step == null || Number(props.step) === 1) && !Number.isSafeInteger(Number(raw))))) {
        event.currentTarget.value = String(props.value ?? '')
        return
      }
      onChange?.(event)
    }} />
}
