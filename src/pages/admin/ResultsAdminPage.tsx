import { AlertTriangle, CheckCircle2, ChevronDown, Crown, Download, Lock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { Category, ProposalRow, ResultRow } from '../../api/types'
import { ResultsHidden } from '../../components/admin/ResultsHidden'
import { AdminPageTitle, Panel, useAdmin } from '../../components/admin/AdminLayout'
import { BarChart, type BarDatum } from '../../components/charts/BarChart'
import { CategoryMedallion } from '../../components/ui/CategoryIcon'
import { FullPageLoader, Spinner, useToast } from '../../components/ui/Feedback'
import { cn } from '../../lib/cn'
import { downloadFile, toCsv } from '../../lib/csv'
import { formatPct, pct, plural } from '../../lib/format'

export function ResultsAdminPage() {
  const { api } = useApi()
  const { overview, reload } = useAdmin()
  const toast = useToast()
  const defaultPhase = overview && ['phase2', 'awaiting_gala', 'results'].includes(overview.phase) ? 2 : 1
  const [phase, setPhase] = useState<1 | 2>(defaultPhase)
  // abre no separador da fase atual (o painel pode ainda estar a carregar quando a página abre)
  const [phaseChosen, setPhaseChosen] = useState(false)
  useEffect(() => {
    if (overview && !phaseChosen) setPhase(defaultPhase)
  }, [overview, phaseChosen, defaultPhase])
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [rows, setRows] = useState<ResultRow[]>([])
  const [proposal, setProposal] = useState<ProposalRow[]>([])
  const voters = phase === 1 ? overview?.phase1_voters : overview?.phase2_voters
  // anonimato: com a fase aberta os resultados não são mostrados (nem devolvidos pelo servidor)
  const hidden = overview ? !overview.results_visible[phase === 1 ? 'phase1' : 'phase2'] : true

  useEffect(() => {
    api.admin.listCategories().then((c) => setCategories(c.filter((x) => x.active !== false)))
  }, [api])
  const [version, setVersion] = useState(0)
  useEffect(() => {
    api.admin.results(phase).then(setRows)
    if (phase === 1) api.admin.finalistProposal().then(setProposal)
  }, [api, phase, voters, version])

  const winnerTies = overview?.winner_ties ?? []
  const published = overview?.settings.results_published ?? false
  const saveWinners = async (categoryId: string, ids: string[]) => {
    const r = await api.admin.setWinners(categoryId, ids)
    toast(r.ok ? 'Vencedor guardado.' : (r.error ?? 'Erro'), r.ok ? 'success' : 'error')
    await reload()
    setVersion((v) => v + 1)
    return r.ok
  }

  const confirmed = overview?.settings.finalists_confirmed ?? false

  const byCategory = useMemo(() => {
    const map: Record<string, ResultRow[]> = {}
    for (const r of rows) (map[r.category_id] ??= []).push(r)
    for (const k in map) map[k].sort((a, b) => b.votes - a.votes || a.candidate_name.localeCompare(b.candidate_name, 'pt'))
    return map
  }, [rows])

  const exportCsv = () => {
    if (!categories) return
    const out: Array<Array<string | number>> = [['Fase', 'Categoria', 'Posição', 'Nome', 'Votos', 'Percentagem', 'Estado']]
    for (const c of categories) {
      const list = byCategory[c.id] ?? []
      const total = list.reduce((a, r) => a + r.votes, 0)
      list.forEach((r, i) => {
        const status =
          phase === 2
            ? r.is_winner
              ? 'Vencedor'
              : 'Finalista'
            : r.is_finalist
              ? 'Finalista'
              : proposal.find((p) => p.category_id === c.id && p.candidate_id === r.candidate_id)?.status === 'tied'
                ? 'Empatado'
                : ''
        out.push([phase === 1 ? '1ª fase' : '2ª fase', c.name, i + 1, r.candidate_name, r.votes, formatPct(pct(r.votes, total)), status])
      })
    }
    downloadFile(`globos-de-ouro-${phase === 1 ? '1a-fase' : '2a-fase'}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(out))
  }

  if (!categories) return <FullPageLoader />

  return (
    <div>
      <AdminPageTitle
        title="Resultados"
        subtitle={`${voters ?? 0} ${voters === 1 ? 'código já votou' : 'códigos já votaram'} nesta fase`}
        actions={
          <button onClick={exportCsv} disabled={hidden} className="btn-ghost btn-sm">
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        }
      />

      <div className="mb-5 inline-flex rounded-full border border-gold-400/20 bg-black/30 p-1">
        {([1, 2] as const).map((p) => (
          <button
            key={p}
            onClick={() => {
              setPhaseChosen(true)
              setPhase(p)
            }}
            className={cn(
              'rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition',
              phase === p ? 'bg-gold-400 text-gala-900' : 'text-gold-100/60 hover:text-gold-100',
            )}
          >
            {p === 1 ? '1ª fase' : '2ª fase'}
          </button>
        ))}
      </div>

      <p className="mb-5 flex items-start gap-2 text-xs text-gold-100/45">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Os votos são guardados apenas como totais por candidato. Não é possível saber em quem cada código votou.
      </p>

      {phase === 2 && !hidden && winnerTies.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-cvp-500/50 bg-cvp-500/15 p-4 text-sm text-red-50">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-cvp-400" />
          <span>
            <strong>Empate no 1.º lugar</strong> em {plural(winnerTies.length, 'categoria', 'categorias')}. Escolham o vencedor de cada uma (há sempre um só
            vencedor por categoria). A gala e a publicação dos resultados ficam bloqueadas até decidirem.
          </span>
        </div>
      )}

      {hidden && (
        <ResultsHidden phase={phase} closesAt={phase === 1 ? (overview?.settings.phase1_closes_at ?? null) : (overview?.settings.phase2_closes_at ?? null)} />
      )}

      <div className={cn('grid grid-cols-1 gap-4 xl:grid-cols-2', hidden && 'hidden')}>
        {categories.map((c) => {
          const list = byCategory[c.id] ?? []
          const total = list.reduce((a, r) => a + r.votes, 0)
          const max = list[0]?.votes ?? 0
          const top = phase === 2 && max > 0 ? list.filter((r) => r.votes === max) : []
          const statusOf = (r: ResultRow): BarDatum['highlight'] => {
            if (phase === 2) return r.is_winner ? 'winner' : 'finalist'
            if (confirmed) return r.is_finalist ? 'finalist' : undefined
            const st = proposal.find((p) => p.category_id === c.id && p.candidate_id === r.candidate_id)?.status
            return st === 'qualified' ? 'finalist' : st === 'tied' ? 'tied' : undefined
          }
          const data: BarDatum[] = list.map((r) => ({ id: r.candidate_id, label: r.candidate_name, value: r.votes, highlight: statusOf(r) }))
          const cutoff = phase === 1 ? data.findIndex((d) => !d.highlight) : -1
          return (
            <CategoryResults key={c.id + phase} category={c} data={data} total={total} cutoff={cutoff > 0 ? cutoff : undefined}>
              {top.length > 1 && <WinnerTie top={top} undecided={winnerTies.includes(c.id)} locked={published} onSave={(ids) => saveWinners(c.id, ids)} />}
            </CategoryResults>
          )
        })}
      </div>

      <div className={cn('mt-6 flex flex-wrap gap-4 text-xs text-gold-100/50', hidden && 'hidden')}>
        <Legend className="bg-gradient-to-r from-gold-700 to-gold-300" label={phase === 1 ? 'Passa à 2ª fase' : 'Finalista'} />
        {phase === 2 && <Legend className="bg-gradient-to-r from-gold-600 to-gold-50" label="Vencedor" />}
        {phase === 1 && <Legend className="bg-gradient-to-r from-cvp-700 to-cvp-400" label="Empate na última vaga" />}
      </div>
    </div>
  )
}

function CategoryResults({
  category,
  data,
  total,
  cutoff,
  children,
}: {
  category: Category
  data: BarDatum[]
  total: number
  cutoff?: number
  children?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const LIMIT = 10
  return (
    <Panel
      title={
        <span className="flex items-center gap-3">
          <CategoryMedallion icon={category.icon} size="sm" />
          <span className="leading-tight">{category.name}</span>
        </span>
      }
      actions={<span className="shrink-0 text-xs tabular-nums text-gold-100/50">{plural(total, 'voto', 'votos')}</span>}
    >
      {children}
      <BarChart
        data={data}
        total={total}
        maxRows={expanded ? undefined : LIMIT}
        cutoffAfter={cutoff !== undefined && (expanded || cutoff < LIMIT) ? cutoff : undefined}
      />
      {data.length > LIMIT && (
        <button onClick={() => setExpanded((e) => !e)} className="mt-4 flex items-center gap-1 text-xs text-gold-300 hover:text-gold-100">
          {expanded ? 'Mostrar menos' : `Ver todos (${data.length})`} <ChevronDown className={cn('h-3.5 w-3.5 transition', expanded && 'rotate-180')} />
        </button>
      )}
    </Panel>
  )
}

/** Empate no 1.º lugar: os administradores escolhem o vencedor (há sempre um só por categoria). */
function WinnerTie({ top, undecided, locked, onSave }: { top: ResultRow[]; undecided: boolean; locked: boolean; onSave: (ids: string[]) => Promise<boolean> }) {
  const current = top.find((r) => r.is_winner)?.candidate_id ?? null
  const [chosen, setChosen] = useState<string | null>(undecided ? null : current)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(undecided)
  const nameOf = (id: string | null) => top.find((r) => r.candidate_id === id)?.candidate_name ?? ''
  const save = async () => {
    if (!chosen) return
    setSaving(true)
    const ok = await onSave([chosen])
    setSaving(false)
    if (ok) setEditing(false)
  }

  if (!editing) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gold-400/30 bg-gold-400/10 p-3 text-xs text-gold-50">
        <span className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-gold-300" />
          Empate no 1.º lugar decidido: vencedor, {nameOf(current)}.
        </span>
        {!locked && (
          <button onClick={() => setEditing(true)} className="text-gold-300 underline-offset-4 hover:underline">
            Alterar
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-xl border border-cvp-500/50 bg-cvp-500/10 p-3">
      <div className="flex items-start gap-2 text-xs text-red-50">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-cvp-400" />
        <span>
          <strong>Empate no 1.º lugar</strong> entre {top.length} pessoas com {plural(top[0].votes, 'voto', 'votos')}. Escolham quem fica com o prémio.
        </span>
      </div>
      <ul className="mt-3 space-y-1.5" role="radiogroup">
        {top.map((r) => {
          const on = chosen === r.candidate_id
          return (
            <li key={r.candidate_id}>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition',
                  on ? 'border-gold-400/50 bg-gold-400/10 text-gold-50' : 'border-white/10 text-gold-50/70 hover:border-gold-400/25',
                )}
              >
                <input
                  type="radio"
                  name={`winner-${r.category_id}`}
                  checked={on}
                  onChange={() => setChosen(r.candidate_id)}
                  className="h-4 w-4 accent-[#e3b53a]"
                />
                <span className="flex-1">{r.candidate_name}</span>
                {on && <Crown className="h-4 w-4 text-gold-300" />}
              </label>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex items-center justify-end gap-2">
        {!undecided && (
          <button onClick={() => setEditing(false)} className="btn-ghost btn-sm">
            Cancelar
          </button>
        )}
        <button onClick={save} disabled={saving || !chosen} className="btn-gold btn-sm">
          {saving ? <Spinner className="h-4 w-4" /> : <Crown className="h-4 w-4" />} Confirmar vencedor
        </button>
      </div>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('h-2.5 w-6 rounded-full', className)} /> {label}
    </span>
  )
}
