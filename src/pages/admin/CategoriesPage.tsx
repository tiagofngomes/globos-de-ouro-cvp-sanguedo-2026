import { Plus, Save, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { Category } from '../../api/types'
import { AdminPageTitle, Panel, useAdmin } from '../../components/admin/AdminLayout'
import { CATEGORY_ICONS, CategoryIcon, CategoryMedallion } from '../../components/ui/CategoryIcon'
import { FullPageLoader, Modal, useConfirm, useToast } from '../../components/ui/Feedback'
import { cn } from '../../lib/cn'

type Draft = Partial<Category> & { name: string }

export function CategoriesPage() {
  const { api } = useApi()
  const { overview, reload } = useAdmin()
  const toast = useToast()
  const ask = useConfirm()
  const [list, setList] = useState<Category[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const votingStarted = overview ? overview.phase1_voters > 0 : false

  const load = useCallback(async () => {
    setList(await api.admin.listCategories())
    reload()
  }, [api, reload])
  useEffect(() => {
    load()
  }, [load])

  const byOrder = (a: Category, b: Category) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt')

  /**
   * Numeração sempre seguida (1, 2, 3…): a categoria `movedId` fica na posição
   * pedida e as outras chegam-se para trás ou para a frente.
   */
  const renumber = async (movedId?: string, position?: number) => {
    const current = (await api.admin.listCategories()).sort(byOrder)
    const moved = current.find((c) => c.id === movedId)
    const others = current.filter((c) => c.id !== movedId)
    if (moved) others.splice(Math.min(Math.max((position ?? others.length + 1) - 1, 0), others.length), 0, moved)
    const ids = others.map((c) => c.id)
    if (ids.some((id, i) => current.find((c) => c.id === id)!.sort_order !== i + 1)) await api.admin.reorderCategories(ids)
  }

  const save = async () => {
    if (!draft || draft.name.trim().length < 3) return
    const before = new Set((list ?? []).map((c) => c.id))
    const position = draft.sort_order ?? (list?.length ?? 0) + 1
    const r = await api.admin.saveCategory(draft)
    toast(r.ok ? 'Categoria guardada.' : (r.error ?? 'Erro'), r.ok ? 'success' : 'error')
    if (r.ok) {
      // a categoria guardada (nova ou editada) fica na posição escolhida
      const savedId = draft.id ?? (await api.admin.listCategories()).find((c) => !before.has(c.id))?.id
      await renumber(savedId, position)
      setDraft(null)
    }
    load()
  }

  const toggleActive = async (c: Category) => {
    const activating = c.active === false
    if (
      votingStarted &&
      !(await ask({
        title: activating ? 'Ativar categoria?' : 'Desativar categoria?',
        message: activating
          ? `"${c.name}" passa a aparecer na votação. Quem estiver a meio da votação neste momento terá de entrar outra vez e votar também nesta categoria.`
          : `"${c.name}" deixa de aparecer na votação e nos resultados. Quem estiver a meio da votação neste momento terá de entrar outra vez.`,
        confirmText: activating ? 'Ativar' : 'Desativar',
        danger: true,
      }))
    )
      return
    const r = await api.admin.saveCategory({ ...c, active: activating })
    toast(r.ok ? (activating ? 'Categoria ativada.' : 'Categoria desativada.') : (r.error ?? 'Erro'), r.ok ? 'success' : 'error')
    load()
  }

  const remove = async (c: Category) => {
    if (!(await ask({ title: 'Apagar categoria', message: `Apagar a categoria "${c.name}"?`, confirmText: 'Apagar', danger: true }))) return
    const r = await api.admin.deleteCategory(c.id)
    if (!r.ok) toast(r.error ?? 'Erro', 'error')
    else await renumber()
    load()
  }

  if (!list) return <FullPageLoader />

  return (
    <div>
      <AdminPageTitle
        title="Categorias"
        subtitle="Prémios a atribuir, pela ordem em que aparecem na votação"
        actions={
          <button
            onClick={() => setDraft({ name: '', description: '', icon: 'trophy', sort_order: list.length + 1, active: true })}
            className="btn-gold btn-sm"
          >
            <Plus className="h-4 w-4" /> Nova categoria
          </button>
        }
      />
      {votingStarted && (
        <p className="mb-4 rounded-2xl border border-cvp-500/40 bg-cvp-500/10 p-4 text-xs text-red-100">
          A votação já começou: adicionar ou desativar categorias agora afeta quem ainda não votou. Altere apenas textos, se necessário.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[...list].sort(byOrder).map((c) => (
          <Panel key={c.id} className={cn('flex h-full flex-col', c.active === false && 'opacity-50')}>
            <div className="flex items-start gap-4">
              <CategoryMedallion icon={c.icon} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.2em] text-gold-400/60">#{c.sort_order}</div>
                <h3 className="line-clamp-3 h-[3.75em] font-display text-lg leading-tight text-gold-50" title={c.name}>
                  {c.name}
                </h3>
              </div>
            </div>
            {/* tamanho fixo: todos os cartões iguais; texto maior acaba em "…" (lê-se tudo em Editar) */}
            <p className="mt-3 line-clamp-3 h-[3.75rem] text-sm leading-5 text-gold-50/55">{c.description}</p>
            <div className="mt-auto flex items-center justify-between pt-4">
              <button
                onClick={() => toggleActive(c)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition',
                  c.active !== false ? 'bg-gold-400/15 text-gold-200 hover:bg-gold-400/25' : 'bg-white/5 text-gold-100/50 hover:bg-white/10',
                )}
                title={c.active !== false ? 'Desativar categoria' : 'Ativar categoria'}
              >
                {c.active !== false ? 'Ativa' : 'Inativa'}
              </button>
              <div className="flex gap-2">
                <button onClick={() => remove(c)} className="rounded-lg p-2 text-gold-100/30 hover:text-cvp-400" aria-label="Apagar">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button onClick={() => setDraft({ ...c })} className="btn-ghost btn-sm">
                  Editar
                </button>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Editar categoria' : 'Nova categoria'}>
        {draft && (
          <div className="space-y-4">
            <div>
              <label className="label-gala">Nome</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="input-gala py-3" />
            </div>
            <div>
              <label className="label-gala">Descrição</label>
              <textarea
                value={draft.description ?? ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
                className="input-gala py-3 text-sm"
              />
            </div>
            <div>
              <label className="label-gala">Ícone</label>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
                {Object.keys(CATEGORY_ICONS).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDraft({ ...draft, icon: k })}
                    className={cn(
                      'grid aspect-square place-items-center rounded-xl border transition',
                      draft.icon === k ? 'border-gold-300 bg-gold-400/20 text-gold-100' : 'border-white/10 text-gold-100/50 hover:border-gold-400/40',
                    )}
                    aria-label={k}
                  >
                    <CategoryIcon icon={k} className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-28">
                <label className="label-gala">Posição</label>
                <input
                  type="number"
                  min={1}
                  max={(list?.length ?? 0) + (draft.id ? 0 : 1)}
                  value={draft.sort_order ?? 0}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
                  className="input-gala py-3"
                />
              </div>
              <label className="mt-7 flex cursor-pointer items-center gap-3 text-sm text-gold-100">
                <input
                  type="checkbox"
                  checked={draft.active !== false}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  className="h-5 w-5 accent-[#e3b53a]"
                />
                Ativa
              </label>
            </div>
            <button onClick={save} disabled={draft.name.trim().length < 3} className="btn-gold w-full">
              <Save className="h-4 w-4" /> Guardar
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
