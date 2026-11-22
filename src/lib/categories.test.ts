import { describe, expect, it } from 'vitest'
import type { Category, CategoryKind } from '../api/types'
import { byCategoryOrder, kindOf, votedInPhase } from './categories'

const cat = (name: string, sort_order: number, kind?: CategoryKind): Category => ({ id: name, slug: name, name, description: '', icon: 'trophy', sort_order, kind })

describe('tipos de categoria', () => {
  it('sem tipo é "Todas as fases" (as categorias que já existiam)', () => {
    expect(kindOf(cat('A', 1))).toBe('all')
  })

  it('ordena sempre por grupos: Todas as fases, Apenas 2ª fase, Prémios secretos', () => {
    const list = [cat('S1', 1, 'secret'), cat('P1', 2, 'phase2'), cat('A2', 9), cat('A1', 3, 'all'), cat('P0', 1, 'phase2'), cat('S0', 0, 'secret')]
    expect([...list].sort(byCategoryOrder).map((c) => c.name)).toEqual(['A1', 'A2', 'P0', 'P1', 'S0', 'S1'])
  })

  it('cada categoria é votada só nas fases certas', () => {
    expect([votedInPhase(cat('A', 1), 1), votedInPhase(cat('A', 1), 2)]).toEqual([true, true])
    expect([votedInPhase(cat('P', 1, 'phase2'), 1), votedInPhase(cat('P', 1, 'phase2'), 2)]).toEqual([false, true])
    expect([votedInPhase(cat('S', 1, 'secret'), 1), votedInPhase(cat('S', 1, 'secret'), 2)]).toEqual([false, false])
  })
})
