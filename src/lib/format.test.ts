import { describe, expect, it } from 'vitest'
import { formatDateRange, isGalaDayReached, lisbonDay } from './format'

describe('Modo Gala disponível a partir do dia da gala', () => {
  // gala marcada para 30/12/2026 às 22h00 (Lisboa, inverno = UTC+0)
  const gala = '2026-12-30T22:00:00Z'
  const at = (iso: string) => new Date(iso).getTime()

  it('ainda fechado na véspera', () => {
    expect(isGalaDayReached(gala, at('2026-12-29T23:59:00Z'))).toBe(false)
  })
  it('abre às 00h00 do dia da gala', () => {
    expect(isGalaDayReached(gala, at('2026-12-30T00:00:00Z'))).toBe(true)
  })
  it('continua aberto pela madrugada seguinte (31/12 às 02h00)', () => {
    expect(isGalaDayReached(gala, at('2026-12-31T02:00:00Z'))).toBe(true)
  })
  it('e daí em diante', () => {
    expect(isGalaDayReached(gala, at('2027-01-05T12:00:00Z'))).toBe(true)
  })
  it('sem data definida, fica fechado', () => {
    expect(isGalaDayReached(null, at('2027-01-05T12:00:00Z'))).toBe(false)
  })
  it('usa o dia de Lisboa, também na hora de verão (UTC+1)', () => {
    // gala a 10/07 às 00h30 de Lisboa = 09/07 às 23h30 UTC
    const summer = '2026-07-09T23:30:00Z'
    expect(lisbonDay(summer)).toBe('2026-07-10')
    expect(isGalaDayReached(summer, at('2026-07-09T22:59:00Z'))).toBe(false) // 23h59 de 09/07 em Lisboa
    expect(isGalaDayReached(summer, at('2026-07-09T23:05:00Z'))).toBe(true) // 00h05 de 10/07 em Lisboa
  })
})

describe('período das fases', () => {
  it('mesmo mês', () => expect(formatDateRange('2026-11-10T00:00:00Z', '2026-11-19T23:59:59Z')).toBe('De 10 a 19 de novembro de 2026'))
  it('meses diferentes', () => expect(formatDateRange('2026-11-25T00:00:00Z', '2026-12-03T23:59:59Z')).toBe('De 25 de novembro a 3 de dezembro de 2026'))
  it('anos diferentes', () => expect(formatDateRange('2026-12-28T00:00:00Z', '2027-01-04T23:59:59Z')).toBe('De 28 de dezembro de 2026 a 4 de janeiro de 2027'))
  it('sem data de fecho', () => expect(formatDateRange('2026-11-11T00:00:00Z', null)).toBe('A partir de 11 de novembro de 2026'))
  it('usa o dia de Lisboa (23h59 não passa para o dia seguinte)', () =>
    expect(formatDateRange('2026-07-01T00:00:00+01:00', '2026-07-10T23:59:59+01:00')).toBe('De 1 a 10 de julho de 2026'))
})
