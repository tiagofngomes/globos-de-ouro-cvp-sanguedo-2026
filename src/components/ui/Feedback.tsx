import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent', className)} aria-label="A carregar" />
  )
}

export function FullPageLoader({ label = 'A preparar a passadeira vermelha…' }: { label?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex flex-col items-center gap-4 text-gold-200/70">
        <Spinner className="h-8 w-8 text-gold-400" />
        <p className="text-sm tracking-wide">{label}</p>
      </div>
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn('card-gala safe-bottom max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-6 sm:max-w-lg sm:rounded-3xl', className)}
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              {title && <h2 className="font-display text-xl text-gold-100">{title}</h2>}
              <button onClick={onClose} className="-mr-2 -mt-1 rounded-full p-2 text-gold-200/60 hover:bg-white/5 hover:text-gold-100" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ------------------------------------------------------------ confirmação --

interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmText?: string
  cancelText?: string
  /** ação perigosa ou irreversível: botão vermelho */
  danger?: boolean
}
const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false)

/**
 * Janela de confirmação com o estilo do site (em vez das caixas do browser).
 * Uso: `if (!(await confirm({ title: 'Apagar?' }))) return`
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const [open, setOpen] = useState(false)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setRequest({ ...options, resolve })
        setOpen(true)
      }),
    [],
  )
  const answer = useCallback(
    (ok: boolean) => {
      request?.resolve(ok)
      setOpen(false)
    },
    [request],
  )
  const cancel = useCallback(() => answer(false), [answer])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={open} onClose={cancel} title={request?.title}>
        {request?.message && <div className="text-sm leading-relaxed text-gold-100/75">{request.message}</div>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button onClick={cancel} className="btn-ghost btn-sm">
            {request?.cancelText ?? 'Cancelar'}
          </button>
          <button autoFocus onClick={() => answer(true)} className={cn('btn-sm', request?.danger ? 'btn-red' : 'btn-gold')}>
            {request?.confirmText ?? 'Confirmar'}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)

// ----------------------------------------------------------------- toasts --

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}
const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className={cn(
                'glass pointer-events-auto max-w-md rounded-2xl border px-4 py-3 text-sm shadow-xl',
                t.kind === 'success' && 'border-gold-400/40 text-gold-100',
                t.kind === 'error' && 'border-cvp-500/60 text-red-100',
                t.kind === 'info' && 'border-white/20 text-white/90',
              )}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
