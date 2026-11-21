const TZ = 'Europe/Lisbon'

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Por definir'
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  const time = new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).replace(':', 'h')
  return `${date}, às ${time}`
}

/** Dia de calendário (AAAA-MM-DD) na hora de Lisboa, para comparar datas. */
export function lisbonDay(value: number | string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

/**
 * O Modo Gala fica disponível a partir das 00h00 (Lisboa) do dia da gala e
 * daí em diante — a festa pode prolongar-se pela madrugada seguinte.
 */
export function isGalaDayReached(galaAt: string | null | undefined, nowMs: number): boolean {
  return Boolean(galaAt) && lisbonDay(nowMs) >= lisbonDay(galaAt as string)
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return 'Por definir'
  return new Intl.DateTimeFormat('pt-PT', { timeZone: TZ, day: 'numeric', month: 'short' }).format(new Date(iso))
}

/** ISO → valor para <input type="datetime-local"> na hora de Lisboa. */
export function isoToLisbonInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** Valor de <input type="datetime-local"> interpretado na hora de Lisboa → ISO. */
export function lisbonInputToIso(value: string, seconds = 0): string | null {
  if (!value) return null
  const [datePart, timePart] = value.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = (timePart ?? '00:00').split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi, seconds)
  const offset = lisbonOffsetMinutes(new Date(guess))
  let ts = guess - offset * 60_000
  const offset2 = lisbonOffsetMinutes(new Date(ts))
  if (offset2 !== offset) ts = guess - offset2 * 60_000
  return new Date(ts).toISOString()
}

function lisbonOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - date.getTime()) / 60_000)
}

export function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0
}

export function formatPct(value: number): string {
  return `${value.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}%`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('pt-PT')} ${n === 1 ? one : many}`
}
