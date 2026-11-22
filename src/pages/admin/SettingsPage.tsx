import { Eye, EyeOff, Pause, Play, Save, Square, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApi } from '../../api/ApiContext'
import type { EventSettings } from '../../api/types'
import { AdminPageTitle, Panel, PhaseBadge, useAdmin } from '../../components/admin/AdminLayout'
import { DateTimeField } from '../../components/admin/DateTimeField'
import { FullPageLoader, Spinner, useConfirm, useToast } from '../../components/ui/Feedback'
import { formatDate, isGalaDayReached, isoToLisbonInput, lisbonInputToIso } from '../../lib/format'

type DateKey = 'phase1_opens_at' | 'phase1_closes_at' | 'phase2_opens_at' | 'phase2_closes_at' | 'gala_at'

const DATE_FIELDS: Array<{ key: DateKey; label: string; help: string; optional?: boolean; endOfMinute?: boolean; dateOnly?: boolean }> = [
  { key: 'phase1_opens_at', label: 'Abertura da 1ª fase', help: 'Início da votação.' },
  { key: 'phase1_closes_at', label: 'Fecho da 1ª fase', help: 'Inclui o minuto indicado (23:59 fecha às 23:59:59).', endOfMinute: true },
  {
    key: 'phase2_opens_at',
    label: 'Abertura da 2ª fase',
    help: 'Só abre se os finalistas já estiverem aprovados (menu Finalistas). Se forem aprovados depois desta hora, abre logo nesse momento.',
  },
  {
    key: 'phase2_closes_at',
    label: 'Fecho da 2ª fase',
    help: 'Opcional. Sem data, a 2ª fase fica aberta até a encerrar manualmente.',
    optional: true,
    endOfMinute: true,
  },
  {
    key: 'gala_at',
    label: 'Dia da gala',
    help: 'Só o dia. Neste dia (e daí em diante) o cartão “Gala” da página inicial fica em destaque e dá acesso ao Modo Gala, com credenciais, a qualquer hora.',
    optional: true,
    dateOnly: true,
  },
]

export function SettingsPage() {
  const { api } = useApi()
  const { overview, reload } = useAdmin()
  const toast = useToast()
  const ask = useConfirm()
  const [form, setForm] = useState<Record<DateKey, string> | null>(null)
  const [invalid, setInvalid] = useState<Partial<Record<DateKey, boolean>>>({})
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
  }, [overview, form])

  if (!overview || !form) return <FullPageLoader />
  const s = overview.settings
  // publicar só a partir do dia da gala (o servidor também o garante)
  const canPublish = isGalaDayReached(s.gala_at, new Date(overview.server_now).getTime())

  // ordem das datas, verificada enquanto se escreve (o servidor volta a verificar ao guardar)
  const iso = (k: DateKey) => (form[k] ? lisbonInputToIso(form[k], DATE_FIELDS.find((f) => f.key === k)?.endOfMinute ? 59 : 0) : null)
  const t = (k: DateKey) => (iso(k) ? new Date(iso(k)!).getTime() : null)
  const orderErrors: Partial<Record<DateKey, string>> = {}
  if (t('phase1_opens_at') !== null && t('phase1_closes_at') !== null && t('phase1_closes_at')! <= t('phase1_opens_at')!)
    orderErrors.phase1_closes_at = 'Tem de ser depois da abertura da 1ª fase.'
  if (t('phase1_closes_at') !== null && t('phase2_opens_at') !== null && t('phase2_opens_at')! < t('phase1_closes_at')!)
    orderErrors.phase2_opens_at = 'Não pode ser antes do fecho da 1ª fase.'
  if (t('phase2_opens_at') !== null && t('phase2_closes_at') !== null && t('phase2_closes_at')! <= t('phase2_opens_at')!)
    orderErrors.phase2_closes_at = 'Tem de ser depois da abertura da 2ª fase.'

  const update = async (patch: Partial<EventSettings>, okMsg: string) => {
    const r = await api.admin.updateSettings(patch)
    toast(r.ok ? okMsg : (r.error ?? 'Erro'), r.ok ? 'success' : 'error')
    await reload()
  }

  const saveDates = async () => {
    if (DATE_FIELDS.some((f) => invalid[f.key])) return toast('Corrija as datas assinaladas a vermelho.', 'error')
    if (Object.keys(orderErrors).length) return toast('As datas estão fora de ordem. Veja os avisos a vermelho.', 'error')
    const patch: Partial<EventSettings> = {}
    for (const f of DATE_FIELDS) {
      const value = iso(f.key)
      if (!value && !f.optional) return toast(`Preencha: ${f.label}.`, 'error')
      ;(patch as Record<string, unknown>)[f.key] = value
    }
    const gapHours = (new Date(patch.phase2_opens_at!).getTime() - new Date(patch.phase1_closes_at!).getTime()) / 3_600_000
    if (
      gapHours < 24 &&
      !(await ask({
        title: 'Pouco tempo entre fases',
        message:
          'A 2ª fase abre menos de 24 horas depois do fecho da 1ª. Recomendamos pelo menos um dia de pausa, para verem os resultados e resolverem empates com calma.',
        confirmText: 'Guardar mesmo assim',
      }))
    )
      return
    setSaving(true)
    await update(patch, 'Datas guardadas.')
    setSaving(false)
  }

  const now = new Date().toISOString()
  const closeNow = async () => {
    if (overview.phase === 'phase1') {
      if (
        !(await ask({
          title: 'Encerrar a 1ª fase agora?',
          message: 'A votação da 1ª fase fecha de imediato para toda a gente.',
          confirmText: 'Encerrar agora',
          danger: true,
        }))
      )
        return
      await update({ phase1_closes_at: now }, '1ª fase encerrada.')
    } else if (overview.phase === 'phase2') {
      if (
        !(await ask({
          title: 'Encerrar a 2ª fase agora?',
          message: 'A votação da 2ª fase fecha de imediato para toda a gente.',
          confirmText: 'Encerrar agora',
          danger: true,
        }))
      )
        return
      await update({ phase2_closes_at: now }, '2ª fase encerrada.')
    }
    setForm(null)
    setInvalid({})
  }

  const resetVotes = async (phase: 1 | 2) => {
    if (resetText !== 'APAGAR') return toast('Escreva APAGAR para confirmar.', 'error')
    if (
      !(await ask({
        title: `Apagar todos os votos da ${phase}ª fase?`,
        message: 'Esta ação é irreversível. Os códigos voltam a poder votar nesta fase.',
        confirmText: 'Apagar votos',
        danger: true,
      }))
    )
      return
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
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
            {DATE_FIELDS.map((f) => (
              <DateTimeField
                key={f.key}
                label={f.label}
                help={f.help}
                optional={f.optional}
                dateOnly={f.dateOnly}
                value={form[f.key]}
                error={orderErrors[f.key]}
                onChange={(value, valid) => {
                  setForm((prev) => (prev ? { ...prev, [f.key]: value } : prev))
                  setInvalid((prev) => ({ ...prev, [f.key]: !valid }))
                }}
              />
            ))}
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
            {!s.results_published && !canPublish && (
              <p className="mb-4 rounded-xl border border-gold-400/20 bg-gold-400/5 p-3 text-xs text-gold-100/70">
                {s.gala_at
                  ? `O botão fica disponível no dia da gala (${formatDate(s.gala_at)}), para não haver o risco de publicar mais cedo.`
                  : 'Defina primeiro o dia da gala no calendário. O botão fica disponível a partir desse dia.'}
              </p>
            )}
            <button
              onClick={async () => {
                if (
                  !s.results_published &&
                  !(await ask({
                    title: 'Publicar os vencedores?',
                    message: (
                      <ul className="list-disc space-y-2 pl-5">
                        <li>
                          Na página inicial, o botão de votar é substituído por <strong className="text-gold-100">“Ver vencedores”</strong>, que abre a página
                          com o vencedor de cada categoria (sem números de votos).
                        </li>
                        <li>Toda a gente passa a ver os vencedores.</li>
                        <li>
                          <strong className="text-red-200">Se ainda houver alguma votação aberta, termina nesse momento.</strong>
                        </li>
                        <li>É o último passo de tudo: façam isto só depois de apresentarem a gala.</li>
                      </ul>
                    ),
                    confirmText: 'Publicar',
                    danger: true,
                  }))
                )
                  return
                update({ results_published: !s.results_published }, s.results_published ? 'Resultados ocultados.' : 'Resultados publicados!')
              }}
              disabled={!s.results_published && !canPublish}
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
