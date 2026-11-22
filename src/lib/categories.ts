import type { Category, CategoryKind } from '../api/types'

/** Tipo de uma categoria (sem valor = "Todas as fases", como todas as que já existiam). */
export const kindOf = (c: Pick<Category, 'kind'>): CategoryKind => c.kind ?? 'all'

export const KIND_LABELS: Record<CategoryKind, string> = {
  all: 'Todas as fases',
  phase2: 'Apenas 2ª fase',
  secret: 'Prémio secreto',
}

/** Nome do grupo no plural (títulos das secções em Categorias). */
export const KIND_GROUP_TITLES: Record<CategoryKind, string> = {
  all: 'Todas as fases',
  phase2: 'Apenas 2ª fase',
  secret: 'Prémios secretos',
}

export const KIND_ORDER: CategoryKind[] = ['all', 'phase2', 'secret']

/** Pessoas numa categoria "Apenas 2ª fase" (também garantido pelo servidor). */
export const ELIGIBLE_MIN = 2
export const ELIGIBLE_MAX = 8

/**
 * Ordem das categorias, sempre por grupos: primeiro "Todas as fases", depois
 * "Apenas 2ª fase", depois os prémios secretos. Dentro de cada grupo, a ordem escolhida.
 */
export function byCategoryOrder(a: Category, b: Category) {
  return KIND_ORDER.indexOf(kindOf(a)) - KIND_ORDER.indexOf(kindOf(b)) || a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt')
}

/** A categoria é votada nesta fase? (1ª: só "Todas as fases"; 2ª: também "Apenas 2ª fase"; secretos nunca) */
export function votedInPhase(c: Pick<Category, 'kind'>, phase: 1 | 2) {
  const k = kindOf(c)
  return k === 'all' || (k === 'phase2' && phase === 2)
}
