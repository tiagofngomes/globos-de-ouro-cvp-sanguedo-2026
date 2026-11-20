import { describe, expect, it } from 'vitest'
import { normalizeText, searchNames } from './normalize'

const names = ['Mariana Lopes', 'Mário Jorge Ribeiro', 'Marta Fonseca', 'Ana Sofia Martins', 'João Pedro Almeida', 'Tiago Mendes']

describe('normalizeText', () => {
  it('remove acentos e maiúsculas', () => {
    expect(normalizeText('  JOÃO   Gonçalves ')).toBe('joao goncalves')
  })
})

describe('searchNames', () => {
  const run = (q: string) => searchNames(names, q, (n) => n).map((r) => r.item)

  it('encontra pelo início das palavras, ignorando acentos e maiúsculas', () => {
    expect(run('mar')).toEqual(expect.arrayContaining(['Mariana Lopes', 'Mário Jorge Ribeiro', 'Marta Fonseca', 'Ana Sofia Martins']))
    expect(run('mario')).toEqual(['Mário Jorge Ribeiro'])
    expect(run('MÁRI')).toEqual(['Mariana Lopes', 'Mário Jorge Ribeiro'])
  })

  it('dá prioridade a quem começa pelo termo pesquisado', () => {
    expect(run('mar').at(-1)).toBe('Ana Sofia Martins')
  })

  it('aceita várias palavras', () => {
    expect(run('jo al')).toEqual(['João Pedro Almeida'])
  })

  it('destaca o texto correspondente no nome original', () => {
    const [match] = searchNames(names, 'joao', (n) => n)
    expect(match.ranges).toEqual([[0, 4]])
  })

  it('pesquisa vazia não devolve nada', () => {
    expect(run('  ')).toEqual([])
  })
})
