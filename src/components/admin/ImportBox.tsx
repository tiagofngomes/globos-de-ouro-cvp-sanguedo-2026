import { FileUp, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ImportResult } from '../../api/types'
import { parseList } from '../../lib/csv'
import { Modal, Spinner, useToast } from '../ui/Feedback'

/** Importação por colagem ou ficheiro CSV/TXT, com pré-visualização. */
export function ImportBox({
  open,
  onClose,
  title,
  mode,
  hint,
  onImport,
}: {
  open: boolean
  onClose: () => void
  title: string
  mode: 'numbers' | 'names'
  hint: string
  onImport: (items: string[]) => Promise<ImportResult>
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const items = parseList(text, mode)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setText(await f.text())
  }

  const run = async () => {
    setBusy(true)
    try {
      const r = await onImport(items)
      toast(`${r.inserted} adicionado(s)${r.skipped ? ` · ${r.skipped} ignorado(s) (duplicados ou inválidos)` : ''}.`)
      setText('')
      onClose()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="mb-3 text-sm text-gold-100/60">{hint}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={mode === 'numbers' ? '12345\n12346\n12347' : 'Ana Sofia Martins\nBruno Ferreira'}
        className="input-gala resize-y font-mono text-sm"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-xs text-gold-300 hover:text-gold-100">
          <FileUp className="h-4 w-4" /> Carregar ficheiro CSV/TXT
        </button>
        <span className="text-xs text-gold-100/50">{items.length} entrada(s)</span>
        <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <button onClick={run} disabled={!items.length || busy} className="btn-gold mt-5 w-full">
        {busy ? (
          <Spinner />
        ) : (
          <>
            <Upload className="h-4 w-4" /> Importar {items.length || ''}
          </>
        )}
      </button>
    </Modal>
  )
}
