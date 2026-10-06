import { useEffect, useRef, useState, type InputHTMLAttributes } from "react"

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> & {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  integer?: boolean
}

export default function NumericInput({
  value,
  onValueChange,
  min = 0,
  max,
  integer = false,
  onBlur,
  ...props
}: Props) {
  const [draft, setDraft] = useState(String(value))
  const lastValue = useRef(value)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.setCustomValidity(!Number.isFinite(value) || value < min || (max != null && value > max)
      ? `Ingresa un número entre ${min} y ${max ?? 'el máximo permitido'}.` : '')
  }, [value, min, max])
  useEffect(() => {
    if (value !== lastValue.current) {
      setDraft(String(value))
      lastValue.current = value
    }
  }, [value])
  const allowed = integer ? /^\d*$/ : /^\d*(?:[.,]\d*)?$/
  return (
    <input maxLength={150}
      {...props}
      ref={inputRef}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      pattern={integer ? "[0-9]+" : "[0-9]+([.,][0-9]+)?"}
      aria-invalid={!Number.isFinite(value) || value < min || (max != null && value > max) || undefined}
      value={draft}
      onChange={(event) => {
        const next = event.target.value
        if (!allowed.test(next)) return
        const number = next === "" ? 0 : Number(next.replace(",", "."))
        if (!Number.isFinite(number)) return
        event.currentTarget.setCustomValidity(number < min || (max != null && number > max)
          ? `Ingresa un número entre ${min} y ${max ?? 'el máximo permitido'}.` : '')
        setDraft(next)
        lastValue.current = number
        onValueChange(number)
      }}
      onBlur={(event) => {
        setDraft(String(value))
        onBlur?.(event)
      }}
    />
  )
}
