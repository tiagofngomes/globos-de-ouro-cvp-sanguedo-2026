import { EyeOff } from 'lucide-react'
import { cn } from '../../lib/cn'
import { formatDateTime } from '../../lib/format'

/**
 * Mostrado enquanto uma fase está aberta: por anonimato, os resultados só ficam
 * visíveis depois de a fase fechar (o servidor também não os devolve).
 */
export function ResultsHidden({ phase, closesAt, compact, className }: { phase: 1 | 2; closesAt: string | null; compact?: boolean; className?: string }) {
  const when = closesAt ? `Ficam visíveis a partir de ${formatDateTime(closesAt)}.` : 'Ficam visíveis quando a fase for encerrada.'
  return (
    <div className={cn('flex flex-col items-center gap-2 text-center', compact ? 'py-4' : 'card-gala gap-3 p-8', className)}>
      <EyeOff className={cn('text-gold-300/70', compact ? 'h-5 w-5' : 'h-8 w-8')} />
      <div className={cn('font-display text-gold-50', compact ? 'text-base' : 'text-xl')}>Resultados escondidos até ao fim da {phase}ª fase</div>
      <p className="max-w-md text-sm text-gold-100/60">
        Para proteger o anonimato, ninguém vê os resultados enquanto a votação decorre. {when} Até lá, acompanhe a participação no Painel.
      </p>
    </div>
  )
}
