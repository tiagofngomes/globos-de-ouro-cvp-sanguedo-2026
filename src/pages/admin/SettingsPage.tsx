import { Eye, EyeOff, Pause, Play, Save, Square, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { EventSettings } from '../../api/types'
import { AdminPageTitle, Panel, PhaseBadge, useAdmin } from '../../components/admin/AdminLayout'
import { FullPageLoader, Spinner, useToast } from '../../components/ui/Feedback'
import { isoToLisbonInput, lisbonInputToIso } from '../../lib/format'

type DateKey = 'phase1_opens_at' | 'phase1_closes_at' | 'phase2_opens_at' | 'phase2_closes_at' | 'gala_at'

const DATE_FIELDS: Array<{ key: DateKey; label: string; help: string; optional?: boolean; endOfMinute?: boolean }> = [
  { key: 'phase1_opens_at', label: 'Abertura da 1ª fase', help: 'Início da votação.' },
  { key: 'phase1_closes_at', label: 'Fecho da 1ª fase', help: 'Inclui o minuto indicado (ex.: 23h59 fecha às 23:59:59).', endOfMinute: true },
  { key: 'phase2_opens_at', label: 'Abertura da 2ª fase', help: 'Os finalistas são apurados automaticamente nesta hora, se não houver empates.' },
  {
    key: 'phase2_closes_at',
    label: 'Fecho da 2ª fase',
    help: 'Opcional. Sem data, a 2ª fase fica aberta até a encerrar manualmente.',
    optional: true,
    endOfMinute: true,
  },
  {
    key: 'gala_at',
    label: 'Data da gala',
    help: 'A partir das 00h00 deste dia (e daí em diante), o cartão “Gala” da página inicial dá acesso ao Modo Gala, com credenciais.',
    optional: true,
  },
]

export function SettingsPage() {
  const { api } = useApi()
  const { overview, reload } = useAdmin()
  const toast = useToast()
  const [form, setForm] = useState<Record<DateKey, string> | null>(null)
  const [perCat, setPerCat] = useState(5)
  const [saving, setSaving] = useState(false)
  const [resetText, setResetText] = useState('')

  useEffect(() => {
    if (!overview || form) return
    const s = overview.settings
    setForm({
      phase1_opens_at: isoToLisbonInput(s.phase1_opens_at),
      phase1_closes_at: isoToLisbonInput(s.phase1_closes_at),
      phase2_opens_at: isoToLisbonInput(s.phase2_opens_at),
      phase2_closes_at: isoToLisbonInput(s.phase2_closes_at),
      gala_at: isoToLisbonInput(s.gala_at),
    })
    setPerCat(s.finalists_per_category)
  }, [overview, form])

  if (!overview || !form) return <FullPageLoader />
  const s = overview.settings

  const update = async (patch: Partial<EventSettings>, okMsg: string) => {
    const r = await api.admin.updateSettings(patch)
    toast(r.ok ? okMsg : (r.error ?? 'Erro'), r.ok ? 'success' : 'error')
    await reload()
  }

  const saveDates = async () => {
    const patch: Partial<EventSettings> = { finalists_per_category: perCat }
    for (const f of DATE_FIELDS) {
      const iso = lisbonInputToIso(form[f.key], f.endOfMinute ? 59 : 0)
      if (!iso && !f.optional) return toast(`Preencha: ${f.label}.`, 'error')
      ;(patch as Record<string, unknown>)[f.key] = iso
    }
    if (new Date(patch.phase1_closes_at!) <= new Date(patch.phase1_opens_at!)) return toast('O fecho da 1ª fase tem de ser depois da abertura.', 'error')
    if (new Date(patch.phase2_opens_at!) < new Date(patch.phase1_closes_at!)) return toast('A 2ª fase não pode abrir antes do fecho da 1ª fase.', 'error')
    const gapHours = (new Date(patch.phase2_opens_at!).getTime() - new Date(patch.phase1_closes_at!).getTime()) / 3_600_000
    if (
      gapHours < 24 &&
      !window.confirm(
        'A 2ª fase abre menos de 24 horas depois do fecho da 1ª. Recomendamos pelo menos um dia de pausa, para verem os resultados e resolverem empates com calma. Guardar mesmo assim?',
      )
    )
      return
    setSaving(true)
    await update(patch, 'Datas guardadas.')
    setSaving(false)
  }

  const now = new Date().toISOString()
  const closeNow = async () => {
    if (overview.phase === 'phase1') {
      if (!window.confirm('Encerrar AGORA a 1ª fase?')) return
      await update({ phase1_closes_at: now }, '1ª fase encerrada.')
    } else if (overview.phase === 'phase2') {
      if (!window.confirm('Encerrar AGORA a 2ª fase?')) return
      await update({ phase2_closes_at: now }, '2ª fase encerrada.')
    }
    setForm(null)
  }

  const resetVotes = async (phase: 1 | 2) => {
    if (resetText !== 'APAGAR') return toast('Escreva APAGAR para confirmar.', 'error')
    if (!window.confirm(`Apagar TODOS os votos da ${phase === 1 ? '1ª fase' : '2ª fase'}? Esta ação é irreversível.`)) return
    const r = await api.admin.resetVotes(phase, resetText)
    toast(r.ok ? 'Votos apagados.' : (r.error ?? 'Erro'), r.ok ? 'success' : 'error')
    setResetText('')
    reload()
  }

  return (
    <div>
      <AdminPageTitle
        title="Datas e fases"
        subtitle="Todas as horas são de Portugal continental. A fase atual é calculada pelo servidor."
        actions={<PhaseBadge phase={overview.phase} />}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Calendário">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {DATE_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label-gala">{f.label}</label>
                <input
                  type="datetime-local"
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="input-gala py-3 [color-scheme:dark]"
                />
                <p className="mt-1.5 text-[11px] text-gold-100/40">{f.help}</p>
              </div>
            ))}
            <div>
              <label className="label-gala">Finalistas por categoria</label>
              <input type="number" min={1} max={20} value={perCat} onChange={(e) => setPerCat(Number(e.target.value))} className="input-gala py-3" />
              <p className="mt-1.5 text-[11px] text-gold-100/40">Por omissão, os 5 mais votados.</p>
            </div>
          </div>
          <button onClick={saveDates} disabled={saving} className="btn-gold mt-6">
            {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} Guardar calendário
          </button>
        </Panel>

        <div className="space-y-4">
          <Panel title="Controlo da votação">
            <div className="space-y-3">
              <button
                onClick={() => update({ voting_paused: !s.voting_paused }, s.voting_paused ? 'Votação retomada.' : 'Votação suspensa.')}
                className="btn-ghost w-full justify-start"
              >
                {s.voting_paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {s.voting_paused ? 'Retomar votação' : 'Suspender votação'}
              </button>
              <button onClick={closeNow} disabled={overview.phase !== 'phase1' && overview.phase !== 'phase2'} className="btn-ghost w-full justify-start">
                <Square className="h-4 w-4" /> Encerrar a fase atual agora
              </button>
            </div>
          </Panel>

          <Panel title="Publicação dos resultados">
            <p className="mb-4 text-sm text-gold-100/60">
              {s.results_published
                ? 'Os vencedores estão visíveis publicamente na página de resultados.'
                : 'Os resultados estão privados. Só os administradores os veem.'}
            </p>
            <button
              onClick={() => {
                if (!s.results_published && !window.confirm('Publicar os vencedores para todos?')) return
                update({ results_published: !s.results_published }, s.results_published ? 'Resultados ocultados.' : 'Resultados publicados!')
              }}
              className={s.results_published ? 'btn-ghost w-full' : 'btn-red w-full'}
            >
              {s.results_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {s.results_published ? 'Ocultar resultados' : 'Publicar resultados'}
            </button>
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2 text-cvp-400">
                <TriangleAlert className="h-4 w-4" /> Zona de perigo
              </span>
            }
          >
            <p className="mb-3 text-xs text-gold-100/55">Apaga votos de testes antes da votação real. Escreva APAGAR para ativar.</p>
            <input value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="APAGAR" className="input-gala py-2.5 text-sm" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => resetVotes(1)} disabled={resetText !== 'APAGAR'} className="btn-ghost btn-sm border-cvp-500/40">
                Votos da 1ª fase
              </button>
              <button onClick={() => resetVotes(2)} disabled={resetText !== 'APAGAR'} className="btn-ghost btn-sm border-cvp-500/40">
                Votos da 2ª fase
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
