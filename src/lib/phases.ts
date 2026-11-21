import type { Phase } from '../api/types'

export const PHASE_LABELS: Record<Phase, { short: string; title: string }> = {
  pre_voting: { short: 'Antes da votação', title: 'Em breve' },
  phase1: { short: '1ª fase', title: '1ª fase a decorrer' },
  paused: { short: 'Suspensa', title: 'Votação suspensa' },
  counting: { short: 'Apuramento', title: 'Apuramento dos finalistas da 2ª fase' },
  phase2: { short: '2ª fase', title: '2ª fase a decorrer' },
  awaiting_gala: { short: 'Aguardar gala', title: 'Votações encerradas' },
  results: { short: 'Resultados', title: 'Vencedores revelados' },
}

export const isVotingPhase = (p: Phase | undefined): p is 'phase1' | 'phase2' => p === 'phase1' || p === 'phase2'
