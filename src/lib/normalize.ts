/** Remove acentos, passa a minúsculas e normaliza espaços. */
export function normalizeText(value: string): string {
  return stripAccents(value).toLowerCase().replace(/\s+/g, ' ').trim()
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function normalizeMemberNumber(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

export interface SearchMatch<T> {
  item: T
  score: number
  /** intervalos [início, fim) no texto original a destacar */
  ranges: Array<[number, number]>
}

/**
 * Pesquisa "inteligente": ignora maiúsculas e acentos; cada palavra escrita
 * tem de corresponder ao início de uma palavra do nome (ou, com menor
 * prioridade, a qualquer parte do nome). Ex.: "mar" → Mariana, Mário, Marta…
 * "jo al" → João Pedro Almeida.
 */
export function searchNames<T>(items: T[], query: string, getName: (item: T) => string, limit = 8): SearchMatch<T>[] {
  const q = normalizeText(query)
  if (!q) return []
  const tokens = q.split(' ').filter(Boolean)
  const results: SearchMatch<T>[] = []

  for (const item of items) {
    const name = getName(item)
    // normalizar carácter a carácter mantém o alinhamento de índices com o original
    const chars = Array.from(name)
    const norm = chars.map((ch) => stripAccents(ch).toLowerCase().slice(0, 1) || ch).join('')
    const offsets: number[] = []
    let acc = 0
    for (const ch of chars) {
      offsets.push(acc)
      acc += ch.length
    }
    offsets.push(acc)

    const words: Array<{ start: number; text: string }> = []
    const re = /[^\s-]+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(norm))) words.push({ start: m.index, text: m[0] })

    let score = 0
    const ranges: Array<[number, number]> = []
    let ok = true
    const used = new Set<number>()
    for (const token of tokens) {
      const wi = words.findIndex((w, i) => !used.has(i) && w.text.startsWith(token))
      if (wi >= 0) {
        used.add(wi)
        ranges.push([offsets[words[wi].start], offsets[words[wi].start + token.length]])
        score += wi === 0 ? 100 : 60
        continue
      }
      const idx = norm.indexOf(token)
      if (idx >= 0 && token.length >= 2) {
        ranges.push([offsets[idx], offsets[idx + token.length]])
        score += 20
        continue
      }
      ok = false
      break
    }
    if (!ok) continue
    if (norm.startsWith(q)) score += 50
    results.push({ item, score, ranges })
  }

  return results.sort((a, b) => b.score - a.score || getName(a.item).localeCompare(getName(b.item), 'pt')).slice(0, limit)
}

const NAME_PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'della', 'di', 'van', 'von'])

/**
 * Põe um nome com só as iniciais em maiúscula, à portuguesa:
 * "MARIA DA CONCEIÇÃO SANTOS" → "Maria da Conceição Santos".
 * Só mexe em nomes escritos todos em maiúsculas ou todos em minúsculas; um nome
 * já com maiúsculas e minúsculas misturadas é mantido como foi escrito.
 */
export function formatPersonName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim()
  const mixed = name !== name.toUpperCase() && name !== name.toLowerCase()
  if (mixed) return name
  return name
    .toLowerCase()
    .split(' ')
    .map((word, i) =>
      i > 0 && NAME_PARTICLES.has(word)
        ? word
        : // inicial maiúscula também depois de hífen ou apóstrofo (Maria-João, D'Almeida)
          word.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase()),
    )
    .join(' ')
}
