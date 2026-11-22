/**
 * Som da gala: um único ficheiro (public/sons/grafico.mp3), tocado só no ecrã do
 * gráfico. O som sobe até aos 7 s, o momento em que as barras param e aparece a coroa.
 *
 * O ficheiro é descarregado e preparado logo ao abrir a gala, para arrancar sem atraso.
 * Os navegadores só deixam tocar som depois de uma interação (tecla, clique ou comando).
 */
const CHART_SOUND_URL = `${import.meta.env.BASE_URL}sons/grafico.mp3`

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

let chartBuffer: AudioBuffer | null = null
/** o som do gráfico que está a tocar (só pode haver um) */
let chartSource: AudioBufferSourceNode | null = null
let loading: Promise<AudioBuffer | null> | null = null

/** Descarrega e prepara o som do gráfico (uma só vez). */
export function preloadGalaSound(): Promise<AudioBuffer | null> {
  loading ??= (async () => {
    try {
      const a = audio()
      if (!a) return null
      const res = await fetch(CHART_SOUND_URL)
      if (!res.ok) throw new Error(`som: ${res.status}`)
      chartBuffer = await a.decodeAudioData(await res.arrayBuffer())
      return chartBuffer
    } catch {
      loading = null // tenta outra vez na próxima vez
      return null
    }
  })()
  return loading
}

/**
 * Todos os sons passam por este "canal" comum. Ao mudar de ecrã cortamos o canal
 * inteiro: o som cala-se logo. O som seguinte usa um canal novo.
 */
let bus: GainNode | null = null
function out(a: AudioContext): GainNode {
  if (!bus) {
    bus = a.createGain()
    bus.connect(a.destination)
  }
  return bus
}

/** Cala de imediato o som da gala. */
export function stopAllSounds() {
  const old = bus
  bus = null
  if (!old || !ctx) return
  try {
    const t = ctx.currentTime
    old.gain.cancelScheduledValues(t)
    old.gain.setValueAtTime(old.gain.value, t)
    old.gain.linearRampToValueAtTime(0, t + 0.04) // desvanecer muito curto, sem estalido
    window.setTimeout(() => {
      try {
        old.disconnect()
      } catch {
        /* já desligado */
      }
    }, 80)
  } catch {
    /* sem som, mas o espetáculo continua */
  }
}

/**
 * Toca o som do gráfico a partir de agora. Se o ficheiro ainda estiver a carregar,
 * começa assim que estiver pronto, já no ponto certo, para continuar acertado com as
 * barras (a coroa aos 7 s).
 */
export function playChartSound() {
  try {
    const a = audio()
    if (!a) return
    const channel = out(a)
    const requestedAt = performance.now()
    const start = (buf: AudioBuffer | null) => {
      // entretanto mudou-se de ecrã (o canal foi cortado): não toca
      if (!buf || bus !== channel) return
      const offset = (performance.now() - requestedAt) / 1000
      if (offset >= buf.duration) return
      // nunca dois sons do gráfico ao mesmo tempo
      try {
        chartSource?.stop()
      } catch {
        /* já tinha parado */
      }
      const src = a.createBufferSource()
      src.buffer = buf
      src.connect(channel)
      src.start(0, offset)
      chartSource = src
    }
    if (chartBuffer) start(chartBuffer)
    else void preloadGalaSound().then(start)
  } catch {
    /* sem som, mas o espetáculo continua */
  }
}
