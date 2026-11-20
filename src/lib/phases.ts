import type { Phase } from '../api/types'

export const PHASE_LABELS: Record<Phase, { short: string; title: string }> = {
  pre_voting: { short: 'Antes da votação', title: 'Em breve' },
  phase1: { short: 'Fase 1 · Nomeações', title: 'Nomeações abertas' },
  paused: { short: 'Suspensa', title: 'Votação suspensa' },
  counting: { short: 'Apuramento', title: 'Apuramento dos finalistas' },
  phase2: { short: 'Fase 2 · Final', title: 'Grande Final' },
  awaiting_gala: { short: 'Aguardar gala', title: 'Votações encerradas' },
  results: { short: 'Resultados', title: 'Vencedores revelados' },
}

export const isVotingPhase = (p: Phase | undefined): p is 'phase1' | 'phase2' => p === 'phase1' || p === 'phase2'
