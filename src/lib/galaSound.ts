/**
 * Efeitos sonoros sintetizados (sem ficheiros): rufar de tambores e fanfarra.
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

/** Prato + acorde de fanfarra para a revelação. */
function fanfareImpl() {
  const a = audio()
  if (!a) return
  const t = a.currentTime
  // prato
  const len = a.sampleRate * 1.8
  const buf = a.createBuffer(1, len, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5)
  const src = a.createBufferSource()
  src.buffer = buf
  const hp = a.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 5000
  const g = a.createGain()
  g.gain.value = 0.35
  src.connect(hp).connect(g).connect(a.destination)
  src.start(t)
  // acorde maior (Dó-Mi-Sol-Dó) em metais suaves
  ;[261.63, 329.63, 392.0, 523.25].forEach((f, i) => {
    const o = a.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    const lp = a.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    const og = a.createGain()
    og.gain.setValueAtTime(0, t + i * 0.06)
    og.gain.linearRampToValueAtTime(0.07, t + i * 0.06 + 0.05)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
    o.connect(lp).connect(og).connect(a.destination)
    o.start(t + i * 0.06)
    o.stop(t + 2.3)
  })
}

/** "Pum!": batida grave e seca para o momento em que o gráfico para. */
function boomImpl() {
  const a = audio()
  if (!a) return
  const t = a.currentTime
  // bombo: seno que desce rapidamente de tom
  const o = a.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(140, t)
  o.frequency.exponentialRampToValueAtTime(38, t + 0.45)
  const g = a.createGain()
  g.gain.setValueAtTime(0.9, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + 1)
  // ataque com ruído para dar impacto
  const src = a.createBufferSource()
  src.buffer = noiseBuffer(a)
  const lp = a.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1200
  const ng = a.createGain()
  ng.gain.value = 0.5
  src.connect(lp).connect(ng).connect(a.destination)
  src.start(t)
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
export const boom = safe(boomImpl)
