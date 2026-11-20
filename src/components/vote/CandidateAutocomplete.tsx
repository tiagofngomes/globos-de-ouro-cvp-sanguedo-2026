import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, List, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CandidateOption } from '../../api/types'
import { cn } from '../../lib/cn'
import { initials } from '../../lib/format'
import { normalizeText, searchNames } from '../../lib/normalize'

interface Props {
  candidates: CandidateOption[]
  value: CandidateOption | null
  onChange: (c: CandidateOption | null) => void
  categoryName: string
}

/**
 * Pesquisa com autocomplete: ignora maiúsculas e acentos, destaca a parte
 * correspondente, navegação por teclado e lista completa alfabética para
 * quem prefere procurar. A lista aparece por baixo do campo (e não por cima
 * do conteúdo), o que funciona muito melhor com o teclado do telemóvel.
 */
export function CandidateAutocomplete({ candidates, value, onChange, categoryName }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [browse, setBrowse] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = 'cand-list'

  const results = useMemo(() => searchNames(candidates, query, (c) => c.name, 8), [candidates, query])
  const grouped = useMemo(() => {
    const sorted = [...candidates].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    const groups: Record<string, CandidateOption[]> = {}
    for (const c of sorted) {
      const letter = normalizeText(c.name)[0]?.toUpperCase() ?? '#'
      ;(groups[letter] ??= []).push(c)
    }
    return Object.entries(groups)
  }, [candidates])

  useEffect(() => setActive(0), [query])

  const choose = (c: CandidateOption) => {
    onChange(c)
    setQuery('')
    setBrowse(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[active].item)
    } else if (e.key === 'Escape') {
      setQuery('')
    }
  }

  // ao focar no telemóvel, levar o campo para o topo para a lista ficar visível acima do teclado
  const onFocus = () => {
    if (window.innerWidth < 640) {
      setTimeout(() => {
        const el = inputRef.current
        if (!el) return
        const y = el.getBoundingClientRect().top + window.scrollY - 90
        window.scrollTo({ top: y, behavior: 'smooth' })
      }, 250)
    }
  }

  if (value) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 220 }}
        className="relative overflow-hidden rounded-3xl border border-gold-300/60 bg-gradient-to-br from-gold-400/20 via-gala-800/80 to-gala-900 p-5 shadow-gold-lg"
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gold-300/20 blur-2xl" />
        <div className="eyebrow mb-3 flex items-center gap-2 text-gold-200">
          <Check className="h-3.5 w-3.5" /> A sua escolha
        </div>
        <div className="flex items-center gap-4">
          <Avatar name={value.name} large />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-xl text-gold-50 sm:text-2xl">{value.name}</div>
            <div className="mt-0.5 truncate text-xs text-gold-100/60">{categoryName}</div>
          </div>
        </div>
        <button
          onClick={() => {
            onChange(null)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold-300 underline-offset-4 hover:underline"
        >
          Alterar escolha
        </button>
      </motion.div>
    )
  }

  return (
    <div>
      <label htmlFor="cand-search" className="label-gala">
        Quem merece este prémio?
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gold-300/60" />
        <input
          id="cand-search"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          placeholder="Comece a escrever um nome…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results.length ? `opt-${active}` : undefined}
          className="input-gala pl-14 pr-12 text-lg"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Limpar pesquisa"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-gold-200/60 hover:text-gold-100"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {query.trim() && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 overflow-hidden rounded-2xl border border-gold-400/20 bg-gala-900/95"
          >
            {results.length === 0 && <li className="px-5 py-4 text-sm text-gold-100/50">Nenhum colega encontrado com “{query}”.</li>}
            {results.map((r, i) => (
              <li key={r.item.id} id={`opt-${i}`} role="option" aria-selected={i === active}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(r.item)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition last:border-b-0',
                    i === active ? 'bg-gold-400/15' : 'hover:bg-white/5',
                  )}
                >
                  <Avatar name={r.item.name} />
                  <span className="text-base text-gold-50/90">
                    <Highlight text={r.item.name} ranges={r.ranges} />
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {!query.trim() && (
        <div className="mt-4">
          <button
            onClick={() => setBrowse((b) => !b)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-300/80 hover:text-gold-200"
          >
            <List className="h-4 w-4" /> {browse ? 'Esconder lista' : 'Ver todos os nomes'}
            <ChevronDown className={cn('h-4 w-4 transition', browse && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {browse && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 max-h-[50vh] overflow-y-auto rounded-2xl border border-gold-400/15 bg-black/30">
                  {grouped.map(([letter, items]) => (
                    <div key={letter}>
                      <div className="sticky top-0 bg-gala-850/95 px-4 py-1 font-display text-xs text-gold-400 backdrop-blur">{letter}</div>
                      {items.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => choose(c)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gold-50/85 hover:bg-gold-400/10"
                        >
                          <Avatar name={c.name} small />
                          {c.name}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function Highlight({ text, ranges }: { text: string; ranges: Array<[number, number]> }) {
  if (!ranges.length) return <>{text}</>
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const parts: React.ReactNode[] = []
  let pos = 0
  sorted.forEach(([s, e], i) => {
    if (s < pos) return
    if (s > pos) parts.push(text.slice(pos, s))
    parts.push(
      <mark key={i} className="rounded bg-transparent font-semibold text-gold-300">
        {text.slice(s, e)}
      </mark>,
    )
    pos = e
  })
  parts.push(text.slice(pos))
  return <>{parts}</>
}

export function Avatar({ name, small, large }: { name: string; small?: boolean; large?: boolean }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-display font-semibold text-gala-900',
        small ? 'h-7 w-7 text-[10px]' : large ? 'h-16 w-16 text-xl' : 'h-10 w-10 text-sm',
      )}
      style={{ background: 'linear-gradient(135deg, #fdf8e8, #e3b53a 50%, #8a611b)' }}
    >
      {initials(name)}
    </span>
  )
}
