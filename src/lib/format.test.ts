import { describe, expect, it } from 'vitest'
import { isGalaDayReached, lisbonDay } from './format'

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
