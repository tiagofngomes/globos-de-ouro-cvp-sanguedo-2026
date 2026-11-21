import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

/**
 * Campo de data e hora escrito à mão, em português: dia "DD/MM/AAAA" e hora
 * "HH:MM" (24 horas). As barras e os dois pontos aparecem sozinhos.
 * Com `dateOnly`, pede só o dia (a hora fica 00:00).
 * O valor trocado com quem usa o campo é "AAAA-MM-DDTHH:MM" (hora de Lisboa),
 * ou "" quando está vazio. `onChange` indica também se o que está escrito é válido.
 */
interface Props {
  label: string
  help?: string
  value: string
  onChange: (value: string, valid: boolean) => void
  optional?: boolean
  /** só o dia, sem hora */
  dateOnly?: boolean
  /** erro vindo de fora (por exemplo, datas fora de ordem) */
  error?: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')

function maskDate(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/')
}
function maskTime(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d
}
function parseDate(text: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!m) return null
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (y < 2000 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return { y, m: mo, d }
}
function parseTime(text: string): { h: number; mi: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text)
  return m ? { h: Number(m[1]), mi: Number(m[2]) } : null
}
function split(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  return m ? { date: `${m[3]}/${m[2]}/${m[1]}`, time: `${m[4]}:${m[5]}` } : { date: '', time: '' }
}

export function DateTimeField({ label, help, value, onChange, optional, dateOnly, error }: Props) {
  const id = useId()
  const initial = split(value)
  const [dateText, setDateText] = useState(initial.date)
  const [timeText, setTimeText] = useState(dateOnly ? '' : initial.time)
  const [touched, setTouched] = useState(false)
  const lastEmitted = useRef(value)

  // valor mudado de fora (por exemplo, depois de "Encerrar a fase atual agora")
  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    const s = split(value)
    setDateText(s.date)
    setTimeText(dateOnly ? '' : s.time)
  }, [value, dateOnly])

  const emit = (dText: string, tText: string) => {
    const d = parseDate(dText)
    const t = dateOnly ? { h: 0, mi: 0 } : parseTime(tText)
    let next = ''
    let valid = false
    if (!dText && (dateOnly || !tText)) valid = Boolean(optional)
    else if (d && t) {
      next = `${d.y}-${pad(d.m)}-${pad(d.d)}T${pad(t.h)}:${pad(t.mi)}`
      valid = true
    }
    lastEmitted.current = next
    onChange(next, valid)
  }

  const dateBad = dateText !== '' && (dateText.length === 10 || touched) && !parseDate(dateText)
  const timeBad = timeText !== '' && (timeText.length === 5 || touched) && !parseTime(timeText)
  const missing = touched && !optional && (!dateText || (!dateOnly && !timeText))
  const message = dateBad
    ? 'Data inválida. Use DD/MM/AAAA.'
    : timeBad
      ? 'Hora inválida. Use HH:MM, de 00:00 a 23:59.'
      : missing
        ? 'Preencha o dia e a hora.'
        : touched && optional && !dateOnly && Boolean(dateText) !== Boolean(timeText)
          ? 'Preencha o dia e a hora, ou deixe os dois vazios.'
          : error

  const clear = () => {
    setDateText('')
    setTimeText('')
    emit('', '')
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`${id}-d`} className="label-gala">
          {label}
        </label>
        {optional && (dateText || timeText) && (
          <button type="button" onClick={clear} className="flex items-center gap-1 text-[11px] text-gold-100/45 hover:text-gold-100">
            <X className="h-3 w-3" /> Limpar
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <input
          id={`${id}-d`}
          value={dateText}
          onChange={(e) => {
            const v = maskDate(e.target.value)
            setDateText(v)
            emit(v, timeText)
          }}
          onBlur={() => setTouched(true)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/AAAA"
          aria-invalid={Boolean(dateBad)}
          className={cn('input-gala min-w-0 flex-1 px-4 py-3 tabular-nums', dateBad && 'border-cvp-500/70')}
        />
        {!dateOnly && (
          <input
            value={timeText}
            onChange={(e) => {
              const v = maskTime(e.target.value)
              setTimeText(v)
              emit(dateText, v)
            }}
            onBlur={() => setTouched(true)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="HH:MM"
            aria-label={`${label}: hora`}
            aria-invalid={Boolean(timeBad)}
            className={cn('input-gala w-[5.25rem] shrink-0 px-2 py-3 text-center tabular-nums', timeBad && 'border-cvp-500/70')}
          />
        )}
      </div>

      {message ? (
        <p className="mt-1.5 text-[11px] font-medium text-red-300" role="alert">
          {message}
        </p>
      ) : (
        help && <p className="mt-1.5 text-[11px] text-gold-100/40">{help}</p>
      )}
    </div>
  )
}
