import { AlertTriangle, ArrowRight, CalendarClock, Eye, PartyPopper, Tags, UserRound, Users, Vote } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi, usePath } from '../../api/ApiContext'
import type { Category, ResultRow } from '../../api/types'
import { ResultsHidden } from '../../components/admin/ResultsHidden'
import { AdminPageTitle, Panel, PhaseBadge, useAdmin } from '../../components/admin/AdminLayout'
import { RingStat } from '../../components/charts/BarChart'
import { CategoryMedallion } from '../../components/ui/CategoryIcon'
import { FullPageLoader } from '../../components/ui/Feedback'
import { Countdown } from '../../components/ui/Countdown'
import { formatDate, formatDateTime, pct } from '../../lib/format'

export function DashboardPage() {
  const { overview } = useAdmin()
  const { api } = useApi()
  const path = usePath()
  const [categories, setCategories] = useState<Category[]>([])
  const [leaders, setLeaders] = useState<ResultRow[]>([])

  const livePhase = overview && (overview.phase === 'phase2' || overview.phase === 'awaiting_gala' || overview.phase === 'results') ? 2 : 1
  const votersKey = overview ? overview.phase1_voters + overview.phase2_voters : 0

  useEffect(() => {
    api.admin
      .listCategories()
      .then(setCategories)
      .catch(() => {})
  }, [api])
  useEffect(() => {
    api.admin
      .results(livePhase)
      .then(setLeaders)
      .catch(() => {})
  }, [api, livePhase, votersKey])

  if (!overview) return <FullPageLoader label="A carregar o painel…" />
  const o = overview
  const s = o.settings
  const nextDeadline =
    o.phase === 'pre_voting'
      ? { label: 'Abertura da 1ª fase', at: s.phase1_opens_at }
      : o.phase === 'phase1'
        ? { label: 'Fecho da 1ª fase', at: s.phase1_closes_at }
        : o.phase === 'counting'
          ? { label: 'Abertura da 2ª fase', at: s.phase2_opens_at }
          : o.phase === 'phase2' && s.phase2_closes_at
            ? { label: 'Fecho da 2ª fase', at: s.phase2_closes_at }
            : null

  return (
    <div>
      <AdminPageTitle title="Painel" subtitle="Acompanhamento em tempo real da votação" actions={<PhaseBadge phase={o.phase} />} />

      {o.winner_ties.length > 0 && !s.results_published && (
        <Link
          to={path('/admin/resultados')}
          className="mb-5 flex items-center gap-3 rounded-2xl border border-cvp-500/50 bg-cvp-500/15 p-4 text-sm text-red-50 transition hover:bg-cvp-500/25"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-cvp-400" />
          <span className="flex-1">
            <strong>Empate no 1.º lugar</strong> em {o.winner_ties.length} {o.winner_ties.length === 1 ? 'categoria' : 'categorias'}. Escolham o vencedor de
            cada uma em Resultados (2ª fase). A gala e a publicação ficam bloqueadas até decidirem.
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      {/* depois do fecho da 1ª fase, nada avança sem aprovação: o painel avisa sempre */}
      {o.results_visible.phase1 && !s.finalists_confirmed && o.ties.length > 0 && (
        <Link
          to={path('/admin/finalistas')}
          className="mb-5 flex items-center gap-3 rounded-2xl border border-cvp-500/50 bg-cvp-500/15 p-4 text-sm text-red-50 transition hover:bg-cvp-500/25"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-cvp-400" />
          <span className="flex-1">
            <strong>Empate na última vaga</strong> em {o.ties.length} {o.ties.length === 1 ? 'categoria' : 'categorias'}. Resolvam o empate e aprovem os
            finalistas. A 2ª fase só abre depois da aprovação.
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      {o.results_visible.phase1 && !s.finalists_confirmed && o.ties.length === 0 && (
        <Link
          to={path('/admin/finalistas')}
          className="mb-5 flex items-center gap-3 rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-gold-50 transition hover:bg-gold-400/20"
        >
          <PartyPopper className="h-5 w-5 shrink-0 text-gold-300" />
          <span className="flex-1">
            <strong>Apuramento pronto!</strong> Todas as categorias têm os {s.finalists_per_category} mais votados, sem empates. Revejam e aprovem os
            finalistas. A 2ª fase só abre depois da aprovação.
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel>
          <RingStat value={pct(o.phase1_voters, o.members_active)} label="Participação · 1ª fase" sub={`${o.phase1_voters} de ${o.members_active} códigos`} />
        </Panel>
        <Panel>
          <RingStat value={pct(o.phase2_voters, o.members_active)} label="Participação · 2ª fase" sub={`${o.phase2_voters} de ${o.members_active} códigos`} />
        </Panel>
        <Panel className="md:col-span-2 xl:col-span-1">
          {nextDeadline ? (
            <>
              <div className="eyebrow mb-3 flex items-center gap-2">
                <CalendarClock className="h-3.5 w-3.5" /> {nextDeadline.label}
              </div>
              <Countdown target={nextDeadline.at} size="md" />
              <p className="mt-3 text-center text-xs text-gold-100/50">{formatDateTime(nextDeadline.at)}</p>
            </>
          ) : (
            <p className="text-sm text-gold-100/60">
              {o.phase === 'awaiting_gala' || o.phase === 'results'
                ? `Votações encerradas. ${s.gala_at ? `Gala: ${formatDate(s.gala_at)}.` : 'Defina o dia da gala em “Datas e fases”.'}`
                : 'Sem prazos pendentes. Defina as datas em “Datas e fases”.'}
            </p>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Users}
          label="Eleitores"
          value={o.members_active}
          sub={o.members_total !== o.members_active ? `${o.members_total} no total` : undefined}
          to={path('/admin/membros')}
        />
        <Stat icon={UserRound} label="Candidatos" value={o.candidates_active} to={path('/admin/candidatos')} />
        <Stat icon={Tags} label="Categorias" value={o.categories_active} to={path('/admin/categorias')} />
        <Stat
          icon={Vote}
          label="Finalistas"
          value={o.finalists_count}
          sub={s.finalists_confirmed ? 'confirmados' : 'por apurar'}
          to={path('/admin/finalistas')}
        />
      </div>

      <Panel
        className="mt-4"
        title={livePhase === 1 ? 'Líderes da 1ª fase' : 'Líderes da 2ª fase'}
        actions={
          <Link to={path('/admin/resultados')} className="flex items-center gap-1 text-xs text-gold-300 hover:text-gold-100">
            <Eye className="h-3.5 w-3.5" /> Ver tudo
          </Link>
        }
      >
        {!o.results_visible[livePhase === 1 ? 'phase1' : 'phase2'] ? (
          <ResultsHidden compact phase={livePhase} closesAt={livePhase === 1 ? s.phase1_closes_at : s.phase2_closes_at} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categories
              .filter((c) => c.active !== false)
              .map((c) => {
                const rows = leaders.filter((r) => r.category_id === c.id).sort((a, b) => b.votes - a.votes)
                const top = rows[0]
                const total = rows.reduce((a, r) => a + r.votes, 0)
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[.02] p-3">
                    <CategoryMedallion icon={c.icon} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] uppercase tracking-[0.12em] text-gold-300/70">{c.name}</div>
                      <div className="truncate text-sm text-gold-50">
                        {top && top.votes > 0 ? top.candidate_name : <span className="text-gold-100/35">Sem votos</span>}
                      </div>
                    </div>
                    {top && top.votes > 0 && <div className="text-right text-xs tabular-nums text-gold-200">{Math.round(pct(top.votes, total))}%</div>}
                  </div>
                )
              })}
          </div>
        )}
      </Panel>

      <Panel className="mt-4" title="Calendário">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <DateItem label="Abertura da 1ª fase" value={s.phase1_opens_at} />
          <DateItem label="Fecho da 1ª fase" value={s.phase1_closes_at} />
          <DateItem label="Abertura da 2ª fase" value={s.phase2_opens_at} />
          <DateItem label="Fecho da 2ª fase" value={s.phase2_closes_at} empty="A definir" />
          <DateItem label="Gala" value={s.gala_at} empty="A definir" dateOnly />
          <div className="rounded-xl border border-white/5 p-3">
            <dt className="text-[11px] uppercase tracking-[0.15em] text-gold-300/60">Resultados</dt>
            <dd className="mt-1 text-gold-50">{s.results_published ? 'Publicados' : 'Privados'}</dd>
          </div>
        </dl>
      </Panel>
    </div>
  )
}

function Stat({ icon: Icon, label, value, sub, to }: { icon: typeof Users; label: string; value: number; sub?: string; to: string }) {
  return (
    <Link to={to} className="card-gala block p-4 transition hover:shadow-gold">
      <Icon className="h-5 w-5 text-gold-400" />
      <div className="mt-3 font-display text-3xl text-gold-50">{value}</div>
      <div className="text-[11px] uppercase tracking-[0.12em] text-gold-100/55">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gold-100/35">{sub}</div>}
    </Link>
  )
}

function DateItem({ label, value, empty = 'Por definir', dateOnly }: { label: string; value: string | null; empty?: string; dateOnly?: boolean }) {
  return (
    <div className="rounded-xl border border-white/5 p-3">
      <dt className="text-[11px] uppercase tracking-[0.15em] text-gold-300/60">{label}</dt>
      <dd className="mt-1 text-gold-50">{value ? dateOnly ? formatDate(value) : formatDateTime(value) : <span className="text-gold-100/40">{empty}</span>}</dd>
    </div>
  )
}
