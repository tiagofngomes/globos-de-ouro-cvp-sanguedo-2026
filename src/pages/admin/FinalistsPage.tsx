import { AlertTriangle, CheckCircle2, RotateCcw, Sparkles, Star } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { Category, ProposalRow, ResultRow } from '../../api/types'
import { AdminPageTitle, Panel, useAdmin } from '../../components/admin/AdminLayout'
import { CategoryMedallion } from '../../components/ui/CategoryIcon'
import { FullPageLoader, Spinner, useToast } from '../../components/ui/Feedback'
import { cn } from '../../lib/cn'
import { formatDateTime } from '../../lib/format'

/**
 * Apuramento dos finalistas. O sistema propõe automaticamente os N mais
 * votados; se houver empate na última vaga, o administrador escolhe quem
 * passa (ou inclui todos os empatados) antes de abrir a final.
 */
export function FinalistsPage() {
  const { api } = useApi()
  const { overview, reload } = useAdmin()
  const toast = useToast()
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [proposal, setProposal] = useState<ProposalRow[]>([])
  const [current, setCurrent] = useState<ResultRow[]>([])
  const [selection, setSelection] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)

  const confirmed = overview?.settings.finalists_confirmed ?? false
  const n = overview?.settings.finalists_per_category ?? 5
  const phase1Open = overview ? ['pre_voting', 'phase1', 'paused'].includes(overview.phase) && !confirmed : true

  const load = useCallback(async () => {
    const [cats, prop] = await Promise.all([api.admin.listCategories(), api.admin.finalistProposal()])
    setCategories(cats.filter((c) => c.active !== false))
    setProposal(prop)
    const sel: Record<string, string[]> = {}
    for (const p of prop) if (p.status === 'qualified') (sel[p.category_id] ??= []).push(p.candidate_id)
    setSelection(sel)
    if (confirmed) setCurrent(await api.admin.results(2))
  }, [api, confirmed])

  useEffect(() => {
    load()
  }, [load])

  const byCat = useMemo(() => {
    const m: Record<string, ProposalRow[]> = {}
    for (const p of proposal) (m[p.category_id] ??= []).push(p)
    return m
  }, [proposal])

  const toggle = (cat: string, cand: string) =>
    setSelection((s) => {
      const list = s[cat] ?? []
      return { ...s, [cat]: list.includes(cand) ? list.filter((x) => x !== cand) : [...list, cand] }
    })

  const auto = async () => {
    setBusy(true)
    const r = await api.admin.autoFinalize()
    setBusy(false)
    if (r.confirmed) toast('Finalistas apurados e confirmados automaticamente.')
    else if (r.ties.length) toast('Existem empates por resolver. Escolha manualmente nas categorias assinaladas.', 'error')
    else if (r.reason === 'phase1_open') toast('A 1.ª fase ainda está aberta.', 'error')
    await reload()
    await load()
  }

  const confirm = async () => {
    if (!categories) return
    const bad = categories.find((c) => !(selection[c.id]?.length > 0))
    if (bad) return toast(`Selecione pelo menos um finalista em “${bad.name}”.`, 'error')
    const odd = categories.filter((c) => (selection[c.id]?.length ?? 0) !== n)
    if (odd.length && !window.confirm(`${odd.length} categoria(s) não têm exatamente ${n} finalistas. Confirmar mesmo assim?`)) return
    setBusy(true)
    const r = await api.admin.setFinalists(selection)
    setBusy(false)
    if (r.ok) toast('Finalistas confirmados! A Grande Final abre na data definida.')
    else toast(r.error ?? 'Erro ao confirmar.', 'error')
    await reload()
  }

  const reset = async () => {
    if (!window.confirm('Repor o apuramento? Os finalistas atuais serão removidos.')) return
    const r = await api.admin.resetFinalists()
    if (!r.ok) toast(r.error ?? 'Erro.', 'error')
    await reload()
  }

  if (!categories || !overview) return <FullPageLoader />

  if (confirmed) {
    return (
      <div>
        <AdminPageTitle
          title="Finalistas"
          subtitle={`Confirmados ${overview.settings.finalists_confirmed_at ? 'a ' + formatDateTime(overview.settings.finalists_confirmed_at) : ''}`}
          actions={
            <button onClick={reset} className="btn-ghost btn-sm">
              <RotateCcw className="h-4 w-4" /> Repor apuramento
            </button>
          }
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((c) => (
            <Panel key={c.id} title={<CatTitle c={c} />}>
              <ul className="space-y-2">
                {current
                  .filter((r) => r.category_id === c.id)
                  .map((r) => (
                    <li
                      key={r.candidate_id}
                      className="flex items-center gap-2 rounded-xl border border-gold-400/20 bg-gold-400/5 px-3 py-2 text-sm text-gold-50"
                    >
                      <Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" /> {r.candidate_name}
                    </li>
                  ))}
              </ul>
            </Panel>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <AdminPageTitle
        title="Apuramento dos finalistas"
        subtitle={`Os ${n} mais votados de cada categoria passam à Grande Final.`}
        actions={
          <>
            <button onClick={auto} disabled={busy || phase1Open} className="btn-ghost btn-sm">
              <Sparkles className="h-4 w-4" /> Apurar automaticamente
            </button>
            <button onClick={confirm} disabled={busy || phase1Open} className="btn-gold btn-sm">
              {busy ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} Confirmar seleção
            </button>
          </>
        }
      />
      {phase1Open && (
        <p className="mb-5 rounded-2xl border border-gold-400/20 bg-gold-400/5 p-4 text-sm text-gold-100/70">
          A fase de nomeações ainda está a decorrer. Esta é uma pré-visualização: o apuramento só pode ser confirmado depois do fecho. Se não houver empates, a
          final abre sozinha na data marcada.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {categories.map((c) => {
          const list = byCat[c.id] ?? []
          const hasTie = list.some((p) => p.status === 'tied')
          const chosen = selection[c.id] ?? []
          return (
            <Panel
              key={c.id}
              title={<CatTitle c={c} />}
              className={cn(hasTie && 'ring-1 ring-cvp-500/60')}
              actions={
                <span className={cn('text-xs tabular-nums', chosen.length === n ? 'text-gold-300' : 'text-cvp-400')}>
                  {chosen.length}/{n}
                </span>
              }
            >
              {hasTie && (
                <p className="mb-3 flex items-start gap-2 rounded-xl bg-cvp-500/15 p-3 text-xs text-red-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-cvp-400" />
                  Empate na última vaga. Selecione quem passa à final (pode incluir todos os empatados).
                </p>
              )}
              {list.length === 0 && <p className="text-sm text-gold-100/40">Sem votos nesta categoria.</p>}
              <ul className="space-y-1.5">
                {list.slice(0, Math.max(n + 6, list.filter((p) => p.status !== 'out').length)).map((p) => {
                  const on = chosen.includes(p.candidate_id)
                  return (
                    <li key={p.candidate_id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition',
                          on ? 'border-gold-400/50 bg-gold-400/10 text-gold-50' : 'border-white/5 text-gold-50/60 hover:border-gold-400/25',
                          p.status === 'tied' && !on && 'border-cvp-500/40',
                        )}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggle(c.id, p.candidate_id)} className="h-4 w-4 accent-[#e3b53a]" />
                        <span className="w-5 text-right font-display text-xs text-gold-400/60">{p.rank_pos}</span>
                        <span className="flex-1 truncate">{p.candidate_name}</span>
                        {p.status === 'tied' && <span className="rounded-full bg-cvp-500/20 px-2 py-0.5 text-[10px] uppercase text-cvp-400">empate</span>}
                        <span className="text-xs tabular-nums text-gold-100/60">{p.votes} votos</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )
        })}
      </div>
    </div>
  )
}

function CatTitle({ c }: { c: Category }) {
  return (
    <span className="flex items-center gap-3">
      <CategoryMedallion icon={c.icon} size="sm" />
      <span className="leading-tight">{c.name}</span>
    </span>
  )
}
