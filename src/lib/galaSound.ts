/**
 * Efeitos sonoros sintetizados (sem ficheiros): rufar de tambores, prato e fanfarra.
 * Só tocam após interação do utilizador (regra dos navegadores).
 */
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

function noiseBuffer(a: AudioContext) {
  const buf = a.createBuffer(1, a.sampleRate * 0.12, a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3)
  return buf
}

/** Rufar crescente durante `seconds` segundos. */
function drumrollImpl(seconds = 3) {
  const a = audio()
  if (!a) return
  const buf = noiseBuffer(a)
  const start = a.currentTime
  const hits = Math.floor(seconds * 22)
  for (let i = 0; i < hits; i++) {
    const t = Math.max(a.currentTime, start + 0.01 + i / 22 + (Math.random() - 0.5) * 0.008)
    const src = a.createBufferSource()
    src.buffer = buf
    const filter = a.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 900 + Math.random() * 300
    filter.Q.value = 0.8
    const gain = a.createGain()
    gain.gain.value = 0.08 + (i / hits) * 0.35
    src.connect(filter).connect(gain).connect(a.destination)
    src.start(t)
  }
}

/**
 * Fanfarra de metais (sem prato) para o nome do vencedor: um "ta-" curto em
 * Sol maior que resolve num "-taaa" longo em Dó maior.
 */
function fanfareImpl() {
  const a = audio()
  if (!a) return
  const t = a.currentTime + 0.01
  const brass = (freqs: number[], start: number, end: number, level: number) =>
    freqs.forEach((f, i) => {
      const o = a.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      const lp = a.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(900, start)
      lp.frequency.linearRampToValueAtTime(2400, start + 0.12) // "abre" como um metal a soprar
      const g = a.createGain()
      g.gain.setValueAtTime(0.0001, start + i * 0.02)
      g.gain.linearRampToValueAtTime(level, start + i * 0.02 + 0.05)
      g.gain.setValueAtTime(level, end - 0.25)
      g.gain.exponentialRampToValueAtTime(0.0001, end)
      o.connect(lp).connect(g).connect(a.destination)
      o.start(start + i * 0.02)
      o.stop(end + 0.05)
    })
  brass([196.0, 246.94, 293.66, 392.0], t, t + 0.3, 0.07) // Sol maior, curto
  brass([261.63, 329.63, 392.0, 523.25, 659.25], t + 0.32, t + 2.6, 0.075) // Dó maior, longo
}

/**
 * "Tchhhh!": prato de orquestra com bombo grave, para o momento em que o
 * rufar acaba e as barras param nos valores reais.
 */
function crashImpl() {
  const a = audio()
  if (!a) return
  const t = a.currentTime + 0.01
  const master = a.createGain()
  master.gain.value = 0.7
  const comp = a.createDynamicsCompressor()
  master.connect(comp).connect(a.destination)

  // 1) prato: ruído brilhante em estéreo, com cauda longa
  const len = Math.floor(a.sampleRate * 3)
  const buf = a.createBuffer(2, len, a.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  const noise = a.createBufferSource()
  noise.buffer = buf
  const hp = a.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 3200
  const sheen = a.createBiquadFilter()
  sheen.type = 'peaking'
  sheen.frequency.value = 7500
  sheen.Q.value = 0.7
  sheen.gain.value = 6
  const cg = a.createGain()
  cg.gain.setValueAtTime(0.0001, t)
  cg.gain.exponentialRampToValueAtTime(0.55, t + 0.008)
  cg.gain.exponentialRampToValueAtTime(0.18, t + 0.35)
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 2.8)
  noise.connect(hp).connect(sheen).connect(cg).connect(master)
  noise.start(t)
  noise.stop(t + 3)

  // 2) brilho metálico: parciais inarmónicos, como num prato verdadeiro
  const metalHp = a.createBiquadFilter()
  metalHp.type = 'highpass'
  metalHp.frequency.value = 6000
  const mg = a.createGain()
  mg.gain.setValueAtTime(0.0001, t)
  mg.gain.exponentialRampToValueAtTime(0.09, t + 0.005)
  mg.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
  metalHp.connect(mg).connect(master)
  ;[302, 409, 544, 627, 813, 1077].forEach((f) => {
    const o = a.createOscillator()
    o.type = 'square'
    o.frequency.value = f * 4
    o.connect(metalHp)
    o.start(t)
    o.stop(t + 1.7)
  })

  // 3) bombo grave por baixo, para dar corpo
  const kick = a.createOscillator()
  kick.type = 'sine'
  kick.frequency.setValueAtTime(110, t)
  kick.frequency.exponentialRampToValueAtTime(45, t + 0.5)
  const kg = a.createGain()
  kg.gain.setValueAtTime(0.0001, t)
  kg.gain.exponentialRampToValueAtTime(0.75, t + 0.01)
  kg.gain.exponentialRampToValueAtTime(0.0001, t + 1.0)
  kick.connect(kg).connect(master)
  kick.start(t)
  kick.stop(t + 1.1)
}

/** O som nunca pode interromper a apresentação: qualquer falha é ignorada. */
function safe<A extends unknown[]>(fn: (...args: A) => void) {
  return (...args: A) => {
    try {
      fn(...args)
    } catch {
      /* sem som, mas o espetáculo continua */
    }
  }
}
export const drumroll = safe(drumrollImpl)
export const fanfare = safe(fanfareImpl)
export const crash = safe(crashImpl)
