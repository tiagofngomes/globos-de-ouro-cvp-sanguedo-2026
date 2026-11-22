import { AlertTriangle, CheckCircle2, PartyPopper, RotateCcw, Star } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { Category, ProposalRow, ResultRow } from '../../api/types'
import { ResultsHidden } from '../../components/admin/ResultsHidden'
import { AdminPageTitle, Panel, useAdmin } from '../../components/admin/AdminLayout'
import { CategoryMedallion } from '../../components/ui/CategoryIcon'
import { FullPageLoader, Spinner, useConfirm, useToast } from '../../components/ui/Feedback'
import { cn } from '../../lib/cn'
import { formatDateTime, plural } from '../../lib/format'

/** Limites de finalistas por categoria (também garantidos pelo servidor). */
export const MIN_FINALISTS = 2
export const MAX_FINALISTS = 8

/**
 * Apuramento dos finalistas. Nada avança sozinho: o sistema pré-seleciona os
 * mais votados (pelo número recomendado) como sugestão, e os administradores
 * revêem, resolvem empates e aprovam. A 2ª fase só abre depois da aprovação.
 */
export function FinalistsPage() {
  const { api } = useApi()
  const { overview, reload } = useAdmin()
  const toast = useToast()
  const ask = useConfirm()
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [proposal, setProposal] = useState<ProposalRow[]>([])
  const [current, setCurrent] = useState<ResultRow[]>([])
  const [selection, setSelection] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState(false)
  const [savingN, setSavingN] = useState(false)

  const confirmed = overview?.settings.finalists_confirmed ?? false
  const n = overview?.settings.finalists_per_category ?? 5
  const phase1Open = overview ? !overview.results_visible.phase1 && !confirmed : true

  const load = useCallback(async () => {
    const [cats, prop] = await Promise.all([api.admin.listCategories(), api.admin.finalistProposal()])
    setCategories(cats.filter((c) => c.active !== false))
    setProposal(prop)
    // recomendação: os mais votados acima do corte já vêm marcados; os empatados ficam para escolher
    const sel: Record<string, string[]> = {}
    for (const p of prop) if (p.status === 'qualified') (sel[p.category_id] ??= []).push(p.candidate_id)
    setSelection(sel)
    if (confirmed) setCurrent(await api.admin.results(2))
  }, [api, confirmed])

  useEffect(() => {
    load()
  }, [load, n])

  const byCat = useMemo(() => {
    const m: Record<string, ProposalRow[]> = {}
    for (const p of proposal) (m[p.category_id] ??= []).push(p)
    return m
  }, [proposal])

  const tiedCats = categories?.filter((c) => (byCat[c.id] ?? []).some((p) => p.status === 'tied')) ?? []

  const toggle = (cat: string, cand: string) => {
    const list = selection[cat] ?? []
    if (!list.includes(cand) && list.length >= MAX_FINALISTS) {
      toast(
        `Máximo de ${MAX_FINALISTS} finalistas por categoria, para a apresentação na gala ficar legível. Desmarque alguém para escolher outra pessoa.`,
        'error',
      )
      return
    }
    setSelection((s) => ({ ...s, [cat]: list.includes(cand) ? list.filter((x) => x !== cand) : [...list, cand] }))
  }

  const changeN = async (value: number) => {
    const next = Math.min(MAX_FINALISTS, Math.max(MIN_FINALISTS, value))
    if (next === n) return
    setSavingN(true)
    const r = await api.admin.updateSettings({ finalists_per_category: next })
    setSavingN(false)
    if (!r.ok) toast(r.error ?? 'Erro', 'error')
    await reload()
  }

  // mínimo de 2, ou de 1 se só uma pessoa teve votos nessa categoria
  const minFor = (catId: string) => Math.min(MIN_FINALISTS, (byCat[catId] ?? []).length)

  const approve = async () => {
    if (!categories || !overview) return
    const noVotes = categories.find((c) => (byCat[c.id] ?? []).length === 0)
    if (noVotes) return toast(`A categoria “${noVotes.name}” não teve votos na 1ª fase. Desative-a em Categorias para poder aprovar.`, 'error')
    const tooFew = categories.find((c) => (selection[c.id]?.length ?? 0) < minFor(c.id))
    if (tooFew) return toast(`Selecione pelo menos ${minFor(tooFew.id)} finalistas em “${tooFew.name}”.`, 'error')
    const total = categories.reduce((a, c) => a + (selection[c.id]?.length ?? 0), 0)
    const opensAt = overview.settings.phase2_opens_at
    const opensNow = new Date(opensAt).getTime() <= new Date(overview.server_now).getTime()
    if (
      !(await ask({
        title: 'Aprovar finalistas?',
        message: (
          <div className="space-y-3">
            <ul className="space-y-1">
              {categories.map((c) => {
                const k = selection[c.id]?.length ?? 0
                return (
                  <li key={c.id} className="flex justify-between gap-3">
                    <span className="truncate">{c.name}</span>
                    <span className={cn('shrink-0 tabular-nums', k === n ? 'text-gold-200' : 'text-amber-300')}>{plural(k, 'finalista', 'finalistas')}</span>
                  </li>
                )
              })}
            </ul>
            <p>
              Total: {plural(total, 'finalista', 'finalistas')}.{' '}
              <strong className="text-gold-100">{opensNow ? 'A 2ª fase abre logo após a aprovação.' : `A 2ª fase abre a ${formatDateTime(opensAt)}.`}</strong>
            </p>
          </div>
        ),
        confirmText: 'Aprovar finalistas',
      }))
    )
      return
    setBusy(true)
    let r: { ok: boolean; error?: string }
    try {
      r = await api.admin.setFinalists(selection)
    } catch (e) {
      r = { ok: false, error: (e as Error).message }
    } finally {
      setBusy(false)
    }
    if (r.ok) toast(opensNow ? 'Finalistas aprovados! A 2ª fase está aberta.' : 'Finalistas aprovados! A 2ª fase abre na data definida.')
    else toast(r.error ?? 'Erro ao aprovar.', 'error')
    await reload()
  }

  const reset = async () => {
    if (
      !(await ask({
        title: 'Repor apuramento',
        message: 'Os finalistas aprovados são removidos e a 2ª fase volta a ficar à espera de uma nova aprovação.',
        confirmText: 'Repor',
        danger: true,
      }))
    )
      return
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
          subtitle={`Aprovados ${overview.settings.finalists_confirmed_at ? 'a ' + formatDateTime(overview.settings.finalists_confirmed_at) : ''}`}
          actions={
            <button onClick={reset} className="btn-ghost btn-sm">
              <RotateCcw className="h-4 w-4" /> Repor apuramento
            </button>
          }
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((c) => {
            const list = current.filter((r) => r.category_id === c.id)
            return (
              <Panel key={c.id} title={<CatTitle c={c} />} actions={<span className="text-xs tabular-nums text-gold-300">{list.length}</span>}>
                <ul className="space-y-2">
                  {list.map((r) => (
                    <li
                      key={r.candidate_id}
                      className="flex items-center gap-2 rounded-xl border border-gold-400/20 bg-gold-400/5 px-3 py-2 text-sm text-gold-50"
                    >
                      <Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" /> {r.candidate_name}
                    </li>
                  ))}
                </ul>
              </Panel>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <AdminPageTitle
        title="Apuramento dos finalistas"
        subtitle="Os mais votados vêm pré-selecionados como sugestão. Nada avança sem a vossa aprovação."
        actions={
          <button onClick={approve} disabled={busy || phase1Open} className="btn-gold btn-sm">
            {busy ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} Aprovar finalistas
          </button>
        }
      />

      {/* número recomendado (sugestão para a pré-seleção) */}
      <Panel className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-gold-100">Finalistas por categoria (recomendação)</div>
            <p className="mt-1 text-xs text-gold-100/55">
              Quantos vêm pré-selecionados em cada categoria. Podem aprovar entre {MIN_FINALISTS} e {MAX_FINALISTS} em cada uma, à vossa escolha.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => changeN(n - 1)} disabled={savingN || n <= MIN_FINALISTS} className="btn-ghost h-10 w-10 p-0" aria-label="Menos">
              −
            </button>
            <span className="w-10 text-center font-display text-2xl tabular-nums text-gold-50">{savingN ? <Spinner className="h-5 w-5" /> : n}</span>
            <button onClick={() => changeN(n + 1)} disabled={savingN || n >= MAX_FINALISTS} className="btn-ghost h-10 w-10 p-0" aria-label="Mais">
              +
            </button>
          </div>
        </div>
      </Panel>

      {phase1Open ? (
        <>
          <ResultsHidden phase={1} closesAt={overview.settings.phase1_closes_at} />
          <p className="mt-4 text-center text-xs text-gold-100/50">
            Depois do fecho, os mais votados aparecem aqui já pré-selecionados. A 2ª fase só abre depois de aprovarem os finalistas.
          </p>
        </>
      ) : tiedCats.length > 0 ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-cvp-500/50 bg-cvp-500/15 p-4 text-sm text-red-50">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-cvp-400" />
          <span>
            <strong>Empate na última vaga</strong> em {plural(tiedCats.length, 'categoria', 'categorias')}. Nas pessoas com a etiqueta{' '}
            <span className="rounded-full bg-cvp-500/30 px-1.5 py-0.5 text-[10px] uppercase">empate</span>, escolham quem passa (de {MIN_FINALISTS} a{' '}
            {MAX_FINALISTS} por categoria) e depois aprovem os finalistas.
          </span>
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-50">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-gold-300" />
          <span>
            <strong>Apuramento pronto!</strong> Todas as categorias têm os {n} mais votados, sem empates. Revejam e aprovem os finalistas.
          </span>
        </div>
      )}

      <div className={cn('grid grid-cols-1 gap-4 xl:grid-cols-2', phase1Open && 'hidden')}>
        {categories.map((c) => {
          const list = byCat[c.id] ?? []
          const chosen = selection[c.id] ?? []
          const ok = list.length > 0 && chosen.length >= minFor(c.id) && chosen.length <= MAX_FINALISTS
          return (
            <Panel
              key={c.id}
              title={<CatTitle c={c} />}
              actions={
                <span
                  className={cn('text-xs tabular-nums', !ok ? 'text-cvp-400' : chosen.length === n ? 'text-gold-300' : 'text-amber-300')}
                  title={`Recomendação: ${n}. Permitido: de ${MIN_FINALISTS} a ${MAX_FINALISTS}.`}
                >
                  {chosen.length}/{n}
                </span>
              }
            >
              {list.length === 0 && (
                <p className="text-sm text-gold-100/60">
                  Esta categoria não teve votos na 1ª fase. Desative-a em <strong className="text-gold-100">Categorias</strong> para poder aprovar os
                  finalistas.
                </p>
              )}
              {list.length === 1 && <p className="mb-3 text-xs text-gold-100/55">Só uma pessoa teve votos nesta categoria: pode passar sozinha à 2ª fase.</p>}
              <ul className="space-y-1.5">
                {list.slice(0, Math.max(n + 6, list.filter((p) => p.status !== 'out').length)).map((p) => {
                  const on = chosen.includes(p.candidate_id)
                  return (
                    <li key={p.candidate_id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition',
                          on ? 'border-gold-400/50 bg-gold-400/10 text-gold-50' : 'border-white/5 text-gold-50/60 hover:border-gold-400/25',
                        )}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggle(c.id, p.candidate_id)} className="h-4 w-4 accent-[#e3b53a]" />
                        <span className="w-5 text-right font-display text-xs text-gold-400/60">{p.rank_pos}</span>
                        <span className="flex-1 truncate">{p.candidate_name}</span>
                        {p.status === 'tied' && <span className="rounded-full bg-cvp-500/20 px-2 py-0.5 text-[10px] uppercase text-cvp-400">empate</span>}
                        <span className="text-xs tabular-nums text-gold-100/60">{plural(p.votes, 'voto', 'votos')}</span>
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
