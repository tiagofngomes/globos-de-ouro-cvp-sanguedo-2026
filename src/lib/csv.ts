/** Gera CSV compatível com o Excel em português (separador ';' e BOM UTF-8). */
export function toCsv(rows: Array<Array<string | number>>): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n')
}

export function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Lê listas coladas ou ficheiros CSV/TXT: uma entrada por linha.
 * Para códigos de voto também aceita separadores ; , e tabulação.
 * Para nomes, usa apenas a primeira coluna de cada linha.
 */
export function parseList(text: string, mode: 'numbers' | 'names'): string[] {
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  for (const line of lines) {
    if (mode === 'numbers') {
      out.push(...line.split(/[;,\t]+/))
    } else {
      out.push(line.split(/[;\t]/)[0])
    }
  }
  return out.map((s) => s.replace(/^\s*"|"\s*$/g, '').trim()).filter(Boolean)
}
