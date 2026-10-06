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
  useEffect(() => {
    if (value !== lastValue.current) {
      setDraft(String(value))
      lastValue.current = value
    }
  }, [value])
  const allowed = integer ? /^\d*$/ : /^\d*(?:[.,]\d*)?$/
  return (
    <input
      {...props}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      data-min={min}
      data-max={max}
      data-integer={integer}
      pattern={integer ? "[0-9]+" : "[0-9]+([.,][0-9]+)?"}
      aria-invalid={props['aria-invalid'] ?? (value < min || (max != null && value > max) || undefined)}
      value={draft}
      onChange={(event) => {
        const next = event.target.value
        if (!allowed.test(next)) return
        const number = next === "" ? 0 : Number(next.replace(",", "."))
        if (!Number.isFinite(number)) return
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
