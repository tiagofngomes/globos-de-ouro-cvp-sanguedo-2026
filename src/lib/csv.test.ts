import { describe, expect, it } from 'vitest'
import { decodeText, parseList } from './csv'

const buf = (bytes: number[]) => new Uint8Array(bytes).buffer

describe('importação de ficheiros (acentos e cedilhas)', () => {
  it('lê ficheiros do Excel em "ANSI" (Windows-1252)', () => {
    // "Cátia\r\nPatrícia Sá\r\nGonçalo" em Windows-1252
    const ansi = buf([
      0x43, 0xe1, 0x74, 0x69, 0x61, 0x0d, 0x0a, 0x50, 0x61, 0x74, 0x72, 0xed, 0x63, 0x69, 0x61, 0x20, 0x53, 0xe1, 0x0d, 0x0a, 0x47, 0x6f, 0x6e, 0xe7, 0x61,
      0x6c, 0x6f,
    ])
    expect(parseList(decodeText(ansi), 'names')).toEqual(['Cátia', 'Patrícia Sá', 'Gonçalo'])
  })
  it('lê ficheiros em UTF-8 (com ou sem marca BOM)', () => {
    const text = 'Tânia Batista\nCíntia Valente'
    expect(decodeText(new TextEncoder().encode(text).buffer as ArrayBuffer)).toBe(text)
    expect(decodeText(buf([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)]))).toBe(text)
  })
  it('lê ficheiros "Texto Unicode" do Excel (UTF-16)', () => {
    const text = 'Conceição'
    const bytes = [0xff, 0xfe, ...Array.from(text).flatMap((ch) => [ch.charCodeAt(0) & 0xff, ch.charCodeAt(0) >> 8])]
    expect(decodeText(buf(bytes))).toBe(text)
  })
})
