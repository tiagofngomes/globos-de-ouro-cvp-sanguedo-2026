import { Check, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { Candidate } from '../../api/types'
import { AdminPageTitle, Panel, useAdmin } from '../../components/admin/AdminLayout'
import { ImportBox } from '../../components/admin/ImportBox'
import { Avatar } from '../../components/vote/CandidateAutocomplete'
import { FullPageLoader, Modal, useConfirm, useToast } from '../../components/ui/Feedback'
import { cn } from '../../lib/cn'
import { normalizeText } from '../../lib/normalize'

export function CandidatesPage() {
  const { api } = useApi()
  const { reload } = useAdmin()
  const toast = useToast()
  const ask = useConfirm()
  const [list, setList] = useState<Candidate[] | null>(null)
  const [q, setQ] = useState('')
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

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
    toast(r.ok ? `${newName.trim()} adicionado.` : (r.error ?? 'Erro'), r.ok ? 'success' : 'error')
    if (r.ok) {
      setNewName('')
      setAddOpen(false)
    }
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
    if (!(await ask({ title: 'Apagar candidato', message: `Apagar "${c.name}" da lista de candidatos?`, confirmText: 'Apagar', danger: true }))) return
    const r = await api.admin.deleteCandidate(c.id)
    if (!r.ok) toast(r.error ?? 'Erro', 'error')
    load()
  }

  if (!list) return <FullPageLoader />

  return (
    <div>
      <AdminPageTitle
        title="Candidatos"
        subtitle={
          <>
            Todos os membros que podem receber votos. São estes os nomes que aparecem na votação.
            <span className="block">({list.filter((c) => c.active).length} ativos)</span>
          </>
        }
        actions={
          <>
            <button onClick={() => setAddOpen(true)} className="btn-ghost btn-sm">
              <Plus className="h-4 w-4" /> Adicionar candidato
            </button>
            <button onClick={() => setImportOpen(true)} className="btn-gold btn-sm">
              <Upload className="h-4 w-4" /> Importar nomes
            </button>
          </>
        }
      />
      <Panel>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-300/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar candidato…" className="input-gala py-3 pl-11" />
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Adicionar candidato">
        <form onSubmit={add}>
          <label htmlFor="new-name" className="label-gala">
            Nome completo
          </label>
          <input
            id="new-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            autoComplete="off"
            placeholder="ex.: Maria Silva"
            className="input-gala"
          />
          <p className="mt-2 text-xs text-gold-100/50">
            É este o nome que aparece na votação. Nomes repetidos (mesmo com acentos ou maiúsculas diferentes) não são aceites.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="btn-ghost btn-sm">
              Cancelar
            </button>
            <button type="submit" disabled={newName.trim().length < 2} className="btn-gold btn-sm">
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
        </form>
      </Modal>

      <ImportBox
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          load()
        }}
        title="Importar candidatos"
        mode="names"
        hint="Um nome por linha (de um ficheiro CSV é usada a primeira coluna). Nomes repetidos (mesmo com acentos ou maiúsculas diferentes) são ignorados."
        onImport={(items) => api.admin.importCandidates(items)}
      />
    </div>
  )
}
