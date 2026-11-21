import { CheckCircle2, Lock, Plus, Search, ShieldAlert, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { Member } from '../../api/types'
import { AdminPageTitle, Panel, useAdmin } from '../../components/admin/AdminLayout'
import { ImportBox } from '../../components/admin/ImportBox'
import { FullPageLoader, Modal, useConfirm, useToast } from '../../components/ui/Feedback'
import { cn } from '../../lib/cn'

/**
 * Eleitores: os códigos de voto (números e/ou letras, por exemplo 1, 2, 3 ou
 * K7P2QX). Cada código vota uma vez por fase; depois de usado
 * aparece como "Utilizado" (nunca se sabe em quem votou).
 */
export function MembersPage() {
  const { api } = useApi()
  const { overview, reload } = useAdmin()
  const toast = useToast()
  const ask = useConfirm()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [q, setQ] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newCode, setNewCode] = useState('')

  // fase a que se refere o estado "Utilizado": a 2ª a partir do momento em que abre
  const currentPhase: 1 | 2 = overview && ['phase2', 'awaiting_gala', 'results'].includes(overview.phase) ? 2 : 1
  const usedNow = (m: Member) => (currentPhase === 1 ? m.voted_phase1 : m.voted_phase2)
  const everUsed = (m: Member) => m.voted_phase1 || m.voted_phase2

  const load = useCallback(async () => {
    setMembers(await api.admin.listMembers())
    reload()
  }, [api, reload])
  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => (members ?? []).filter((m) => m.member_number.includes(q.trim().replace(/\s+/g, '').toUpperCase())), [members, q])

  const addCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = newCode.trim()
    if (!code) return
    const r = await api.admin.importMembers([code])
    if (r.inserted) {
      toast(`Código ${code.replace(/\s+/g, '').toUpperCase()} adicionado.`)
      setNewCode('')
      setAddOpen(false)
      load()
    } else toast('Esse código já existe.', 'error')
  }

  const toggle = async (m: Member) => {
    const r = await api.admin.setMemberActive(m.id, !m.active)
    if (!r.ok) toast(r.error ?? 'Erro', 'error')
    load()
  }

  const remove = async (m: Member) => {
    if (
      !(await ask({
        title: 'Remover código',
        message: `Remover o código ${m.member_number}? Deixa de poder ser usado para votar.`,
        confirmText: 'Remover',
        danger: true,
      }))
    )
      return
    const r = await api.admin.deleteMember(m.id)
    if (!r.ok) toast(r.error ?? 'Erro', 'error')
    load()
  }

  if (!members) return <FullPageLoader />
  const active = members.filter((m) => m.active).length
  const used = members.filter(usedNow).length

  return (
    <div>
      <AdminPageTitle
        title="Eleitores"
        subtitle={
          <>
            Os códigos de voto dos eleitores. Cada código vota uma vez por fase.
            <span className="block">
              ({active} ativos de {members.length} · {used} utilizados na {currentPhase}ª fase)
            </span>
          </>
        }
        actions={
          <>
            <button onClick={() => setAddOpen(true)} className="btn-ghost btn-sm">
              <Plus className="h-4 w-4" /> Adicionar código
            </button>
            <button onClick={() => setImportOpen(true)} className="btn-gold btn-sm">
              <Upload className="h-4 w-4" /> Importar lista
            </button>
          </>
        }
      />

      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-gold-400/20 bg-gold-400/5 p-4 text-xs leading-relaxed text-gold-100/70">
        <ShieldAlert className="h-4 w-4 shrink-0 text-gold-400" />
        <p>
          Cada código é único e pode ter números e letras (por exemplo 1, 2, 3 ou K7P2QX). Depois de usado numa fase aparece como{' '}
          <strong className="text-gold-100">Utilizado</strong> e fica fechado até à fase seguinte. Nunca é possível saber em quem um código votou, e os
          resultados só ficam visíveis quando a fase fecha. Um código já utilizado não pode ser apagado, apenas desativado.
        </p>
      </div>

      <Panel>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-300/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar código…" className="input-gala py-3 pl-11" />
        </div>

        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, 300).map((m) => {
            const isUsed = usedNow(m)
            return (
              <li
                key={m.id}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2',
                  !m.active ? 'border-white/5 opacity-50' : isUsed ? 'border-gold-400/25 bg-gold-400/[.06]' : 'border-white/10 bg-white/[.02]',
                )}
              >
                <span className="min-w-0 flex-1 truncate font-display tracking-[0.15em] text-gold-50">{m.member_number}</span>
                {isUsed && (
                  <span
                    className="flex items-center gap-1 rounded-full bg-gold-300/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold-100"
                    title={`Já votou na ${currentPhase}ª fase`}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Utilizado
                  </span>
                )}
                <button
                  onClick={() => toggle(m)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
                    m.active ? 'bg-gold-400/15 text-gold-200' : 'bg-white/5 text-gold-100/50',
                  )}
                  title={m.active ? 'Desativar código' : 'Ativar código'}
                >
                  {m.active ? 'Ativo' : 'Inativo'}
                </button>
                {everUsed(m) ? (
                  <span className="p-2 text-gold-100/20" title="Já utilizado: não pode ser apagado, apenas desativado">
                    <Lock className="h-4 w-4" />
                  </span>
                ) : (
                  <button onClick={() => remove(m)} className="rounded-lg p-2 text-gold-100/30 hover:text-cvp-400" aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {filtered.length > 300 && <p className="mt-3 text-xs text-gold-100/40">A mostrar 300 de {filtered.length}. Use a pesquisa.</p>}
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-gold-100/40">Nenhum código encontrado.</p>}
      </Panel>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Adicionar código de voto">
        <form onSubmit={addCode}>
          <label htmlFor="new-code" className="label-gala">
            Código
          </label>
          <input
            id="new-code"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="ex.: 12345 ou K7P2QX"
            maxLength={32}
            className="input-gala text-center font-display text-xl tracking-[0.2em]"
          />
          <p className="mt-2 text-xs text-gold-100/50">
            Cada código é único: não é possível adicionar um código que já existe. Maiúsculas e espaços não contam (k7p 2qx é o mesmo que K7P2QX).
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="btn-ghost btn-sm">
              Cancelar
            </button>
            <button type="submit" disabled={!newCode.trim()} className="btn-gold btn-sm">
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
        title="Importar códigos de voto"
        mode="numbers"
        hint="Cole os códigos (um por linha, ou separados por vírgulas ou ponto e vírgula) ou carregue um ficheiro. Códigos repetidos (mesmo com maiúsculas ou espaços diferentes) são ignorados. Nunca guarde estes ficheiros no repositório."
        onImport={(items) => api.admin.importMembers(items)}
      />
    </div>
  )
}
