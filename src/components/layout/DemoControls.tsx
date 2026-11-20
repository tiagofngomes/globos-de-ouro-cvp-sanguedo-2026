import { AnimatePresence, motion } from 'framer-motion'
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Phase } from '../../api/types'
import { DEMO_HINT, getDemoPhase, resetDemo, setDemoPhase, subscribeDemo } from '../../demo/demoApi'
import { cn } from '../../lib/cn'
import { PHASE_LABELS } from '../../lib/phases'

const PHASES: Phase[] = ['pre_voting', 'phase1', 'counting', 'phase2', 'awaiting_gala', 'results']

/** Painel flutuante para simular as fases do evento na demonstração. */
export function DemoControls() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState(getDemoPhase())
  useEffect(() => {
    const unsub = subscribeDemo(() => setPhase(getDemoPhase()))
    return () => {
      unsub()
    }
  }, [])

  return (
    <div className="fixed bottom-24 right-3 z-50 sm:bottom-4 sm:right-4">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="card-gala mb-3 w-[min(20rem,calc(100vw-2rem))] p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="eyebrow">Simular fase</span>
              <button onClick={() => setOpen(false)} aria-label="Fechar" className="text-gold-200/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PHASES.map((p) => (
                <button
                  key={p}
                  onClick={() => setDemoPhase(p)}
                  className={cn(
                    'rounded-xl border px-2 py-2 text-[11px] font-medium transition',
                    phase === p ? 'border-gold-300 bg-gold-400/20 text-gold-50' : 'border-gold-400/15 text-gold-100/70 hover:border-gold-400/40',
                  )}
                >
                  {PHASE_LABELS[p].short}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-gold-100/60">{DEMO_HINT}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Link to="/demo/admin" className="text-[11px] text-gold-300 underline underline-offset-4">
                Abrir painel admin (demo)
              </Link>
              <button onClick={resetDemo} className="inline-flex items-center gap-1 text-[11px] text-gold-100/60 hover:text-gold-100">
                <RotateCcw className="h-3 w-3" /> Repor
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen((o) => !o)}
        className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-cvp-500 text-white shadow-red-glow"
        aria-label="Controlos da demonstração"
      >
        <SlidersHorizontal className="h-5 w-5" />
      </button>
    </div>
  )
}
