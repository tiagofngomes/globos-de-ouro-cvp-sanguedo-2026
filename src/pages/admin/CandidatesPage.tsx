import { Check, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { Candidate } from '../../api/types'
import { AdminPageTitle, Panel, useAdmin } from '../../components/admin/AdminLayout'
import { ImportBox } from '../../components/admin/ImportBox'
import { Avatar } from '../../components/vote/CandidateAutocomplete'
import { FullPageLoader, useToast } from '../../components/ui/Feedback'
import { cn } from '../../lib/cn'
import { normalizeText } from '../../lib/normalize'

export function CandidatesPage() {
  const { api } = useApi()
  const { reload } = useAdmin()
  const toast = useToast()
  const [list, setList] = useState<Candidate[] | null>(null)
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(async () => {
    setList(await api.admin.listCandidates())
    reload()
  }, [api, reload])
  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const n = normalizeText(q)
    return (list ?? []).filter((c) => normalizeText(c.name).includes(n))
  }, [list, q])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newName.trim().length < 2) return
    const r = await api.admin.saveCandidate({ name: newName })
    toast(r.ok ? 'Nome adicionado.' : (r.error ?? 'Erro'), r.ok ? 'success' : 'error')
    if (r.ok) setNewName('')
    load()
  }

  const saveEdit = async () => {
    if (!editing) return
    const current = list?.find((c) => c.id === editing.id)
    const r = await api.admin.saveCandidate({ id: editing.id, name: editing.name, active: current?.active })
    if (!r.ok) toast(r.error ?? 'Erro', 'error')
    setEditing(null)
    load()
  }

  const toggle = async (c: Candidate) => {
    await api.admin.saveCandidate({ id: c.id, name: c.name, active: !c.active })
    load()
  }

  const remove = async (c: Candidate) => {
    if (!window.confirm(`Apagar "${c.name}"?`)) return
    const r = await api.admin.deleteCandidate(c.id)
    if (!r.ok) toast(r.error ?? 'Erro', 'error')
    load()
  }

  if (!list) return <FullPageLoader />

  return (
    <div>
      <AdminPageTitle
        title="Nomeados"
        subtitle={`Todos os membros que podem ser nomeados. São estes os nomes que aparecem na votação. (${list.filter((c) => c.active).length} ativos)`}
        actions={
          <button onClick={() => setImportOpen(true)} className="btn-gold btn-sm">
            <Upload className="h-4 w-4" /> Importar nomes
          </button>
        }
      />
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-300/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar…" className="input-gala py-3 pl-11" />
          </div>
          <form onSubmit={add} className="flex gap-2 sm:w-96">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" className="input-gala py-3" />
            <button type="submit" className="btn-ghost shrink-0 px-4" aria-label="Adicionar">
              <Plus className="h-4 w-4" />
            </button>
          </form>
        </div>

        <ul className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
          {filtered.map((c) => (
            <li key={c.id} className={cn('flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.02] px-3 py-2', !c.active && 'opacity-50')}>
              <Avatar name={c.name} small />
              {editing?.id === c.id ? (
                <>
                  <input
                    autoFocus
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    className="input-gala flex-1 px-3 py-1.5"
                  />
                  <button onClick={saveEdit} className="p-2 text-gold-300" aria-label="Guardar">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditing(null)} className="p-2 text-gold-100/50" aria-label="Cancelar">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm text-gold-50">{c.name}</span>
                  <button onClick={() => setEditing({ id: c.id, name: c.name })} className="p-2 text-gold-100/40 hover:text-gold-100" aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggle(c)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
                      c.active ? 'bg-gold-400/15 text-gold-200' : 'bg-white/5 text-gold-100/50',
                    )}
                  >
                    {c.active ? 'Ativo' : 'Inativo'}
                  </button>
                  <button onClick={() => remove(c)} className="p-2 text-gold-100/30 hover:text-cvp-400" aria-label="Apagar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-gold-100/40">Nenhum nome encontrado.</p>}
      </Panel>

      <ImportBox
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          load()
        }}
        title="Importar nomeados"
        mode="names"
        hint="Um nome por linha (de um ficheiro CSV é usada a primeira coluna). Nomes repetidos (mesmo com acentos ou maiúsculas diferentes) são ignorados."
        onImport={(items) => api.admin.importCandidates(items)}
      />
    </div>
  )
}
