import { KeyRound, Plus, Search, ShieldAlert, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { Member } from '../../api/types'
import { AdminPageTitle, Panel, useAdmin } from '../../components/admin/AdminLayout'
import { ImportBox } from '../../components/admin/ImportBox'
import { FullPageLoader, useToast } from '../../components/ui/Feedback'
import { cn } from '../../lib/cn'

export function MembersPage() {
  const { api } = useApi()
  const { reload } = useAdmin()
  const toast = useToast()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [q, setQ] = useState('')
  const [single, setSingle] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(async () => {
    setMembers(await api.admin.listMembers())
    reload()
  }, [api, reload])
  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => (members ?? []).filter((m) => m.member_number.includes(q.trim().toUpperCase())), [members, q])

  const addSingle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!single.trim()) return
    const r = await api.admin.importMembers([single])
    toast(r.inserted ? `Número ${single.trim()} adicionado.` : 'Esse número já existe.', r.inserted ? 'success' : 'error')
    setSingle('')
    load()
  }

  const toggle = async (m: Member) => {
    const r = await api.admin.setMemberActive(m.id, !m.active)
    if (!r.ok) toast(r.error ?? 'Erro', 'error')
    load()
  }

  const remove = async (m: Member) => {
    if (!window.confirm(`Remover o número ${m.member_number}?`)) return
    const r = await api.admin.deleteMember(m.id)
    if (!r.ok) toast(r.error ?? 'Erro', 'error')
    load()
  }

  const setPin = async (m: Member) => {
    const pin = window.prompt(
      m.has_pin
        ? `O membro ${m.member_number} já tem PIN. Introduza um novo PIN ou deixe vazio para remover.`
        : `Definir PIN para o membro ${m.member_number} (opcional, aumenta a segurança):`,
    )
    if (pin === null) return
    const r = await api.admin.setMemberPin(m.id, pin.trim() || null)
    toast(r.ok ? (pin.trim() ? 'PIN definido.' : 'PIN removido.') : (r.error ?? 'Erro'), r.ok ? 'success' : 'error')
    load()
  }

  if (!members) return <FullPageLoader />
  const active = members.filter((m) => m.active).length

  return (
    <div>
      <AdminPageTitle
        title="Votantes"
        subtitle={`Os números de membro que podem votar. Cada número vota uma vez por fase. (${active} ativos de ${members.length})`}
        actions={
          <button onClick={() => setImportOpen(true)} className="btn-gold btn-sm">
            <Upload className="h-4 w-4" /> Importar lista
          </button>
        }
      />

      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-gold-400/20 bg-gold-400/5 p-4 text-xs leading-relaxed text-gold-100/70">
        <ShieldAlert className="h-4 w-4 shrink-0 text-gold-400" />
        <p>
          Por respeito ao anonimato, esta lista não mostra quem já votou, apenas os totais no painel. Um membro que já votou não pode ser apagado (apenas
          desativado). O PIN é opcional: se definido, passa a ser pedido ao votar.
        </p>
      </div>

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-300/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar número…" className="input-gala py-3 pl-11" />
          </div>
          <form onSubmit={addSingle} className="flex gap-2">
            <input
              value={single}
              onChange={(e) => setSingle(e.target.value)}
              placeholder="Novo número"
              inputMode="numeric"
              className="input-gala w-full py-3 sm:w-40"
            />
            <button type="submit" className="btn-ghost shrink-0 px-4" aria-label="Adicionar">
              <Plus className="h-4 w-4" />
            </button>
          </form>
        </div>

        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, 300).map((m) => (
            <li
              key={m.id}
              className={cn('flex items-center gap-2 rounded-xl border px-3 py-2', m.active ? 'border-white/10 bg-white/[.02]' : 'border-white/5 opacity-50')}
            >
              <span className="flex-1 font-display tracking-[0.15em] text-gold-50">{m.member_number}</span>
              <button
                onClick={() => setPin(m)}
                className={cn('rounded-lg p-2', m.has_pin ? 'text-gold-300' : 'text-gold-100/30 hover:text-gold-100')}
                title="PIN"
              >
                <KeyRound className="h-4 w-4" />
              </button>
              <button
                onClick={() => toggle(m)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
                  m.active ? 'bg-gold-400/15 text-gold-200' : 'bg-white/5 text-gold-100/50',
                )}
              >
                {m.active ? 'Ativo' : 'Inativo'}
              </button>
              <button onClick={() => remove(m)} className="rounded-lg p-2 text-gold-100/30 hover:text-cvp-400" aria-label="Remover">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {filtered.length > 300 && <p className="mt-3 text-xs text-gold-100/40">A mostrar 300 de {filtered.length}. Use a pesquisa.</p>}
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-gold-100/40">Nenhum número encontrado.</p>}
      </Panel>

      <ImportBox
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          load()
        }}
        title="Importar números de membro"
        mode="numbers"
        hint="Cole os números (um por linha, ou separados por vírgulas/ponto e vírgula) ou carregue um ficheiro. Duplicados são ignorados. Nunca guarde estes ficheiros no repositório."
        onImport={(items) => api.admin.importMembers(items)}
      />
    </div>
  )
}
