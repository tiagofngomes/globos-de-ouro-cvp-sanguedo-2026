import { AlertTriangle, Check, Crown, Lock, Plus, Save, Search, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { Candidate, Category, CategoryKind } from '../../api/types'
import { AdminPageTitle, Panel, useAdmin } from '../../components/admin/AdminLayout'
import { CATEGORY_ICONS, CategoryIcon, CategoryMedallion } from '../../components/ui/CategoryIcon'
import { FullPageLoader, Modal, Spinner, useConfirm, useToast } from '../../components/ui/Feedback'
import { byCategoryOrder, ELIGIBLE_MAX, ELIGIBLE_MIN, KIND_GROUP_TITLES, KIND_LABELS, KIND_ORDER, kindOf } from '../../lib/categories'
import { cn } from '../../lib/cn'
import { formatPersonName, normalizeText } from '../../lib/normalize'

type Draft = Partial<Category> & { name: string }

const KIND_HELP: Record<CategoryKind, string> = {
  all: 'Votada na 1ª e na 2ª fase, como sempre.',
  phase2: 'Só existe na 2ª fase. Escolham aqui de 2 a 8 pessoas: são elas os finalistas.',
  secret: 'Sem votação. O vencedor é escrito à mão e a categoria só aparece na gala, no fim.',
}

export function CategoriesPage() {
  const { api } = useApi()
  const { overview, reload } = useAdmin()
  const toast = useToast()
  const ask = useConfirm()
  const [list, setList] = useState<Category[] | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const votingStarted = overview ? overview.phase1_voters > 0 : false
  // o que fica fechado (o servidor garante o mesmo)
  const phase1Opened = overview ? overview.phase !== 'pre_voting' : true
  const finalistsApproved = overview?.settings.finalists_confirmed ?? false
  const published = overview?.settings.results_published ?? false

  const load = useCallback(async () => {
    setList(await api.admin.listCategories())
    reload()
  }, [api, reload])
  useEffect(() => {
    load()
    api.admin
      .listCandidates()
      .then(setCandidates)
      .catch(() => {})
  }, [load, api])

  const sorted = useMemo(() => [...(list ?? [])].sort(byCategoryOrder), [list])
  const groupOf = (kind: CategoryKind) => sorted.filter((c) => kindOf(c) === kind)
  const nameOf = (id: string) => candidates.find((c) => c.id === id)?.name ?? '?'
  const isActive = (id: string) => candidates.some((c) => c.id === id && c.active)

  /**
   * Numeração sempre seguida e sempre por grupos (Todas as fases, Apenas 2ª fase,
   * Prémios secretos): a categoria `movedId` fica na posição pedida dentro do seu
   * grupo e as outras chegam-se para trás ou para a frente.
   */
  const renumber = async (movedId?: string, position?: number) => {
    const current = (await api.admin.listCategories()).sort(byCategoryOrder)
    const moved = current.find((c) => c.id === movedId)
    const others = current.filter((c) => c.id !== movedId)
    if (moved) {
      const rank = KIND_ORDER.indexOf(kindOf(moved))
      const group = others.filter((c) => kindOf(c) === kindOf(moved))
      const p = Math.min(Math.max((position ?? group.length + 1) - 1, 0), group.length)
      let at = p < group.length ? others.indexOf(group[p]) : -1
      if (at < 0) {
        // fim do grupo: antes da primeira categoria de um grupo seguinte
        const after = others.findIndex((c) => KIND_ORDER.indexOf(kindOf(c)) > rank)
        at = group.length ? others.indexOf(group[group.length - 1]) + 1 : after < 0 ? others.length : after
      }
      others.splice(at, 0, moved)
    }
    const ids = others.map((c) => c.id)
    if (ids.some((id, i) => current.find((c) => c.id === id)!.sort_order !== i + 1)) await api.admin.reorderCategories(ids)
  }

  const draftKind = draft ? kindOf(draft) : 'all'
  const original = draft?.id ? list?.find((c) => c.id === draft.id) : undefined
  const eligible = draft?.eligible ?? []
  // a escolha das pessoas fecha quando os finalistas são aprovados (passam a ser os finalistas)
  const eligibleLocked = draftKind === 'phase2' && finalistsApproved
  const secretLocked = (draftKind === 'secret' || (original && kindOf(original) === 'secret')) && published
  const eligibleOk = draftKind !== 'phase2' || eligibleLocked || (eligible.length >= ELIGIBLE_MIN && eligible.length <= ELIGIBLE_MAX)
  const canSave = !!draft && draft.name.trim().length >= 3 && eligibleOk && !secretLocked && !saving

  /**
   * Porque é que um tipo não pode ser escolhido (as mesmas regras do servidor).
   * A razão aparece sempre por escrito, nunca só um botão apagado.
   */
  const kindBlockedReason = (k: CategoryKind): string | null => {
    if (!draft) return null
    if (draft.id) return phase1Opened && k !== kindOf(original ?? draft) ? 'o tipo de uma categoria só pode ser mudado antes de a 1ª fase abrir.' : null
    if (k === 'phase2' && finalistsApproved)
      return 'os finalistas já foram aprovados. Estas categorias só podem ser criadas antes da aprovação (em Finalistas, “Repor apuramento” volta atrás, mas só enquanto ninguém tiver votado na 2ª fase).'
    if (k === 'secret' && published)
      return 'os resultados já foram publicados. Para criar um prémio secreto, ocultem primeiro os resultados em Datas e fases.'
    return null
  }
  /** porque é que o botão Guardar está desligado */
  const saveHint = !draft || saving || secretLocked
    ? null
    : draft.name.trim().length < 3
      ? 'Escreva um nome com pelo menos 3 letras.'
      : !eligibleOk
        ? eligible.length < ELIGIBLE_MIN
          ? `Escolham pelo menos ${ELIGIBLE_MIN} pessoas (${eligible.length === 0 ? 'ainda não há nenhuma' : `falta ${ELIGIBLE_MIN - eligible.length}`}).`
          : `Escolham no máximo ${ELIGIBLE_MAX} pessoas.`
        : null

  /** posição dentro do grupo (1, 2, 3…) */
  const positionInGroup = (c: Category) => groupOf(kindOf(c)).findIndex((x) => x.id === c.id) + 1

  const openNew = () => setDraft({ name: '', description: '', icon: 'trophy', sort_order: groupOf('all').length + 1, active: true, kind: 'all', eligible: [] })
  const openEdit = (c: Category) => setDraft({ ...c, kind: kindOf(c), eligible: c.eligible ?? [], sort_order: positionInGroup(c) })

  const changeKind = (kind: CategoryKind) => {
    if (!draft) return
    // ao mudar de grupo, a categoria vai para o fim desse grupo
    const size = groupOf(kind).filter((c) => c.id !== draft.id).length
    setDraft({ ...draft, kind, sort_order: size + 1 })
  }

  const save = async () => {
    if (!draft || !canSave) return
    setSaving(true)
    try {
      const position = draft.sort_order ?? groupOf(draftKind).length + 1
      const payload: Draft = {
        ...draft,
        kind: draftKind,
        secret_winner: draftKind === 'secret' ? formatPersonName(draft.secret_winner ?? '') || null : null,
      }
      const r = await api.admin.saveCategory(payload)
      if (!r.ok) {
        toast(r.error ?? 'Erro', 'error')
        return
      }
      const savedId = draft.id ?? r.id
      // pessoas da "Apenas 2ª fase" (só se mudaram)
      if (savedId && draftKind === 'phase2' && !eligibleLocked) {
        const before = [...(original?.eligible ?? [])].sort().join()
        if (!draft.id || before !== [...eligible].sort().join()) {
          const e = await api.admin.setEligible(savedId, eligible)
          if (!e.ok) {
            toast(e.error ?? 'Erro ao guardar as pessoas.', 'error')
            await load()
            return
          }
        }
      }
      toast('Categoria guardada.')
      // a categoria guardada (nova ou editada) fica na posição escolhida dentro do seu grupo
      await renumber(savedId, position)
      setDraft(null)
    } finally {
      setSaving(false)
      load()
    }
  }

  const toggleActive = async (c: Category) => {
    const activating = c.active === false
    if (
      votingStarted &&
      kindOf(c) !== 'secret' &&
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

  const groups = KIND_ORDER.filter((k) => groupOf(k).length > 0)
  const maxPosition = draft ? groupOf(draftKind).filter((c) => c.id !== draft.id).length + 1 : 1

  return (
    <div>
      <AdminPageTitle
        title="Categorias"
        subtitle="Prémios a atribuir, pela ordem em que aparecem na votação e na gala"
        actions={
          <button onClick={openNew} className="btn-gold btn-sm">
            <Plus className="h-4 w-4" /> Nova categoria
          </button>
        }
      />
      {votingStarted && (
        <p className="mb-4 rounded-2xl border border-cvp-500/40 bg-cvp-500/10 p-4 text-xs text-red-100">
          A votação já começou: adicionar ou desativar categorias agora afeta quem ainda não votou. Altere apenas textos, se necessário.
        </p>
      )}

      <div className="space-y-8">
        {groups.map((kind) => (
          <section key={kind}>
            {/* só se mostram os títulos quando há mais de um grupo */}
            {groups.length > 1 && (
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="font-display text-lg text-gold-100">{KIND_GROUP_TITLES[kind]}</h2>
                <span className="text-xs text-gold-100/45">{KIND_HELP[kind]}</span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groupOf(kind).map((c, idx) => (
                <Panel key={c.id} className={cn('flex h-full flex-col', c.active === false && 'opacity-50')}>
                  <div className="flex items-start gap-4">
                    <CategoryMedallion icon={c.icon} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gold-400/60">
                        #{idx + 1}
                        {kind !== 'all' && <span className="ml-2 text-gold-300/80">· {KIND_LABELS[kind]}</span>}
                      </div>
                      <h3 className="line-clamp-3 h-[3.75em] font-display text-lg leading-tight text-gold-50">
                        {c.name}
                      </h3>
                    </div>
                  </div>
                  {/* tamanho fixo: todos os cartões iguais; texto maior acaba em "…" (lê-se tudo em Editar) */}
                  <p className="mt-3 line-clamp-3 h-[3.75rem] text-sm leading-5 text-gold-50/55">{c.description}</p>
                  {kind === 'phase2' && <EligibleSummary ids={c.eligible ?? []} nameOf={nameOf} isActive={isActive} />}
                  {kind === 'secret' &&
                    (c.secret_winner ? (
                      <p className="mt-3 flex items-center gap-2 truncate rounded-xl border border-gold-400/25 bg-gold-400/5 px-3 py-2 text-sm text-gold-50">
                        <Crown className="h-4 w-4 shrink-0 text-gold-300" /> <span className="truncate">{c.secret_winner}</span>
                      </p>
                    ) : (
                      <p className="mt-3 flex items-center gap-2 rounded-xl border border-cvp-500/40 bg-cvp-500/10 px-3 py-2 text-xs text-red-100">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-cvp-400" /> Falta escrever o vencedor
                      </p>
                    ))}
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <button
                      onClick={() => toggleActive(c)}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition',
                        c.active !== false ? 'bg-gold-400/15 text-gold-200 hover:bg-gold-400/25' : 'bg-white/5 text-gold-100/50 hover:bg-white/10',
                      )}
                      aria-label={c.active !== false ? 'Desativar categoria' : 'Ativar categoria'}
                    >
                      {c.active !== false ? 'Ativa' : 'Inativa'}
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => remove(c)} className="rounded-lg p-2 text-gold-100/30 hover:text-cvp-400" aria-label="Apagar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(c)} className="btn-ghost btn-sm">
                        Editar
                      </button>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Editar categoria' : 'Nova categoria'}>
        {draft && (
          <div className="space-y-4">
            <div>
              <label className="label-gala">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {KIND_ORDER.map((k) => {
                  // o tipo só muda antes da 1ª fase; criar "Apenas 2ª fase" só até à aprovação dos finalistas;
                  // criar prémios secretos só até à publicação dos resultados
                  const blockedReason = kindBlockedReason(k)
                  const on = draftKind === k
                  return (
                    <button
                      key={k}
                      type="button"
                      // bloqueado: ao tocar, diz porquê (não fica só apagado)
                      onClick={() => (blockedReason ? toast(`${KIND_LABELS[k]}: ${blockedReason}`, 'error') : changeKind(k))}
                      aria-disabled={!!blockedReason}
                      className={cn(
                        'rounded-xl border px-2 py-2.5 text-xs font-semibold leading-tight transition',
                        on ? 'border-gold-300 bg-gold-400/20 text-gold-50' : 'border-white/10 text-gold-100/60 hover:border-gold-400/40',
                        blockedReason && 'cursor-not-allowed opacity-35 hover:border-white/10',
                      )}
                    >
                      {KIND_LABELS[k]}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-gold-100/55">{KIND_HELP[draftKind]}</p>
              {/* a razão de cada tipo bloqueado, sempre à vista */}
              {draft.id && phase1Opened ? (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-gold-100/60">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0" /> O tipo de uma categoria só pode ser mudado antes de a 1ª fase abrir.
                </p>
              ) : (
                KIND_ORDER.filter((k) => kindBlockedReason(k)).map((k) => (
                  <p key={k} className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-gold-100/60">
                    <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      <strong className="text-gold-100/80">{KIND_LABELS[k]}</strong> indisponível: {kindBlockedReason(k)}
                    </span>
                  </p>
                ))
              )}
            </div>
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

            {draftKind === 'secret' && (
              <div>
                <label className="label-gala">Vencedor</label>
                <input
                  value={draft.secret_winner ?? ''}
                  onChange={(e) => setDraft({ ...draft, secret_winner: e.target.value })}
                  placeholder="Nome de quem recebe o prémio"
                  className="input-gala py-3"
                  disabled={!!secretLocked}
                />
                <p className="mt-1.5 text-[11px] text-gold-100/45">
                  Escrito à mão (não precisa de estar na lista de candidatos). Fica escondido de todos até à gala.
                </p>
              </div>
            )}

            {draftKind === 'phase2' && (
              <EligiblePicker
                candidates={candidates}
                value={eligible}
                locked={eligibleLocked}
                onChange={(ids) => setDraft({ ...draft, eligible: ids })}
                onLimit={() => toast(`Máximo de ${ELIGIBLE_MAX} pessoas por categoria. Desmarque alguém para escolher outra pessoa.`, 'error')}
              />
            )}

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
                  max={maxPosition}
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
            {draftKind !== 'all' && <p className="-mt-2 text-[11px] text-gold-100/45">A posição conta dentro do grupo “{KIND_GROUP_TITLES[draftKind]}”.</p>}
            {secretLocked && (
              <p className="flex items-center gap-2 text-xs text-gold-100/55">
                <Lock className="h-3.5 w-3.5" /> Os resultados já foram publicados: os prémios secretos já não podem ser alterados.
              </p>
            )}
            <button onClick={save} disabled={!canSave} className="btn-gold w-full">
              {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} Guardar
            </button>
            {/* o botão nunca fica desligado sem se dizer porquê */}
            {saveHint && <p className="-mt-2 text-center text-xs text-amber-300">{saveHint}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}

/** Cartão: quem está na categoria "Apenas 2ª fase" (avisa se faltam pessoas ou se alguém foi desativado). */
function EligibleSummary({ ids, nameOf, isActive }: { ids: string[]; nameOf: (id: string) => string; isActive: (id: string) => boolean }) {
  const inactive = ids.filter((id) => !isActive(id))
  const ok = ids.length - inactive.length >= ELIGIBLE_MIN
  return (
    <div
      className={cn(
        'mt-3 rounded-xl border px-3 py-2 text-xs',
        ok ? 'border-gold-400/25 bg-gold-400/5 text-gold-50/75' : 'border-cvp-500/40 bg-cvp-500/10 text-red-100',
      )}
    >
      <div className="flex items-center gap-2 font-semibold">
        {ok ? <Users className="h-3.5 w-3.5 text-gold-300" /> : <AlertTriangle className="h-3.5 w-3.5 text-cvp-400" />}
        {ids.length === 0 ? 'Faltam escolher as pessoas (de 2 a 8)' : `${ids.length} ${ids.length === 1 ? 'pessoa' : 'pessoas'}`}
      </div>
      {ids.length > 0 && <p className="mt-1 line-clamp-2">{ids.map(nameOf).join(', ')}</p>}
      {inactive.length > 0 && (
        <p className="mt-1 text-red-200">
          {inactive.length === 1 ? 'Desativada' : 'Desativadas'} em Candidatos: {inactive.map(nameOf).join(', ')} (não {inactive.length === 1 ? 'passa' : 'passam'} à 2ª
          fase).
        </p>
      )}
    </div>
  )
}

/** Escolha das pessoas de uma categoria "Apenas 2ª fase": da lista de candidatos, de 2 a 8. */
function EligiblePicker({
  candidates,
  value,
  locked,
  onChange,
  onLimit,
}: {
  candidates: Candidate[]
  value: string[]
  locked: boolean
  onChange: (ids: string[]) => void
  onLimit: () => void
}) {
  const [q, setQ] = useState('')
  const term = normalizeText(q)
  const chosen = candidates.filter((c) => value.includes(c.id))
  const shown = candidates
    .filter((c) => c.active || value.includes(c.id))
    .filter((c) => !term || normalizeText(c.name).includes(term))
    .sort((a, b) => Number(value.includes(b.id)) - Number(value.includes(a.id)) || a.name.localeCompare(b.name, 'pt'))
  const toggle = (id: string) => {
    if (value.includes(id)) return onChange(value.filter((x) => x !== id))
    if (value.length >= ELIGIBLE_MAX) return onLimit()
    onChange([...value, id])
  }
  const ok = value.length >= ELIGIBLE_MIN && value.length <= ELIGIBLE_MAX

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label-gala">Pessoas</label>
        <span className={cn('text-xs tabular-nums', ok ? 'text-gold-300' : 'text-cvp-400')}>
          {value.length} de {ELIGIBLE_MAX} (mínimo {ELIGIBLE_MIN})
        </span>
      </div>
      {locked ? (
        <div className="rounded-xl border border-white/10 p-3 text-sm text-gold-50/75">
          <p className="mb-2 flex items-center gap-2 text-xs text-gold-100/55">
            <Lock className="h-3.5 w-3.5" /> Os finalistas já foram aprovados: estas pessoas são os finalistas desta categoria.
          </p>
          {chosen.map((c) => c.name).join(', ') || 'Ninguém escolhido.'}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-100/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar na lista de candidatos" className="input-gala py-2.5 pl-9 text-sm" />
          </div>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-white/10 p-1.5">
            {shown.map((c) => {
              const on = value.includes(c.id)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition',
                      on ? 'bg-gold-400/15 text-gold-50' : 'text-gold-50/65 hover:bg-white/5',
                    )}
                  >
                    <span
                      className={cn('grid h-4 w-4 shrink-0 place-items-center rounded border', on ? 'border-gold-300 bg-gold-400 text-gala-900' : 'border-white/25')}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 truncate">{c.name}</span>
                    {!c.active && <span className="text-[10px] uppercase text-cvp-400">desativado</span>}
                  </button>
                </li>
              )
            })}
            {shown.length === 0 && <li className="px-3 py-2 text-xs text-gold-100/45">Ninguém encontrado.</li>}
          </ul>
        </>
      )}
    </div>
  )
}
