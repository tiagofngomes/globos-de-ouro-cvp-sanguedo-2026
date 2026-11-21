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

/**
 * Lê o conteúdo de um ficheiro de texto/CSV com a codificação certa. O Excel em
 * português grava muitas vezes em "ANSI" (Windows-1252) em vez de UTF-8; ler
 * esses ficheiros como UTF-8 estraga acentos e cedilhas ("C�tia" em vez de
 * "Cátia"). Tenta UTF-8 (e UTF-16 com marca) e, se não for válido, usa Windows-1252.
 */
export function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}
