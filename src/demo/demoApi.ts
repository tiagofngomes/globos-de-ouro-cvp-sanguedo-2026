/**
 * API de DEMONSTRAÇÃO — totalmente separada da votação real.
 * Tudo vive no navegador (localStorage); nada é enviado para o Supabase.
 * Reproduz as mesmas regras do servidor para que a experiência seja fiel.
 */
import { normalizeMemberNumber, normalizeText } from '../lib/normalize'
import type {
  AdminOverview,
  Candidate,
  Category,
  EventSettings,
  Member,
  Phase,
  ProposalRow,
  PublicResults,
  PublicState,
  ResultRow,
  VotingApi,
} from '../api/types'
import { DEMO_CANDIDATES, DEMO_CATEGORIES } from './data'

const STORAGE_KEY = 'globos-cvp-demo-v2'
const DEMO_MEMBER_RANGE = { from: 1001, to: 1100 }

interface DemoState {
  phase: Phase
  settings: EventSettings
  categories: Category[]
  candidates: Candidate[]
  members: Member[]
  voted: Record<string, number[]> // member_id → fases em que votou
  tallies: Record<string, number> // `${phase}|${category}|${candidate}` → votos
  finalists: Record<string, string[]> // category → candidatos
  sessions: Record<string, { member_id: string; phase: 1 | 2; expires: number }>
}

// --------------------------------------------------------------- seed ------

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedState(): DemoState {
  const rand = mulberry32(2026)
  const categories = DEMO_CATEGORIES.map((c) => ({ ...c, active: true }))
  const candidates: Candidate[] = DEMO_CANDIDATES.map((name, i) => ({
    id: `cand-${i + 1}`,
    name,
    active: true,
    created_at: '2026-11-20T00:00:00Z',
  }))
  const members: Member[] = []
  for (let n = DEMO_MEMBER_RANGE.from; n <= DEMO_MEMBER_RANGE.to; n++) {
    members.push({ id: `mem-${n}`, member_number: String(n), active: true, has_pin: false, created_at: '2026-11-20T00:00:00Z' })
  }

  // Resultados simulados: 68 membros (1033–1100) já votaram na 1.ª fase.
  const tallies: Record<string, number> = {}
  const voted: Record<string, number[]> = {}
  for (const m of members.slice(32)) voted[m.id] = [1]
  categories.forEach((cat, ci) => {
    // cada categoria tem "favoritos" diferentes, com pesos decrescentes
    const weights = candidates.map((_, i) => {
      const shifted = (i + ci * 3) % candidates.length
      return Math.max(0.15, 1 - shifted * 0.075) * (0.6 + rand() * 0.8)
    })
    const total = weights.reduce((a, b) => a + b, 0)
    for (let v = 0; v < 68; v++) {
      let r = rand() * total
      let idx = 0
      while (r > weights[idx]) r -= weights[idx++]
      const key = `1|${cat.id}|${candidates[idx].id}`
      tallies[key] = (tallies[key] ?? 0) + 1
    }
  })
  // Força um empate na 5.ª posição da categoria "Inovação" para demonstrar a resolução.
  const inov = categories.find((c) => c.slug === 'inovacao')!
  const ranking = candidates.map((c) => ({ id: c.id, v: tallies[`1|${inov.id}|${c.id}`] ?? 0 })).sort((a, b) => b.v - a.v)
  if (ranking.length > 6) {
    // transfere votos de um candidato mais abaixo para manter o total igual ao nº de votantes
    const diff = ranking[4].v - ranking[5].v
    const donor = ranking.slice(6).find((r) => r.v >= diff)
    if (diff > 0 && donor) {
      tallies[`1|${inov.id}|${ranking[5].id}`] = ranking[5].v + diff
      tallies[`1|${inov.id}|${donor.id}`] = donor.v - diff
    }
  }

  return {
    phase: 'phase1',
    settings: {
      phase1_opens_at: '2026-11-20T00:00:00Z',
      phase1_closes_at: '2026-12-10T23:59:59Z',
      phase2_opens_at: '2026-12-11T00:00:00Z',
      phase2_closes_at: null,
      gala_at: null,
      voting_paused: false,
      finalists_per_category: 5,
      finalists_confirmed: false,
      finalists_confirmed_at: null,
      results_published: false,
    },
    categories,
    candidates,
    members,
    voted,
    tallies,
    finalists: {},
    sessions: {},
  }
}

// ------------------------------------------------------------- storage -----

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DemoState
  } catch {
    /* sem armazenamento: usa estado em memória */
  }
  return seedState()
}

let state: DemoState = load()
const listeners = new Set<() => void>()

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignora */
  }
  listeners.forEach((l) => l())
}

export function subscribeDemo(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDemoPhase(): Phase {
  return state.phase
}

export function resetDemo() {
  state = seedState()
  save()
}

/** Muda a fase simulada (painel da demonstração). */
export function setDemoPhase(phase: Phase) {
  if ((phase === 'phase2' || phase === 'awaiting_gala' || phase === 'results') && !state.settings.finalists_confirmed) {
    // resolve automaticamente eventuais empates escolhendo os primeiros
    const proposal = computeProposal()
    const n = state.settings.finalists_per_category
    state.finalists = {}
    for (const cat of activeCategories()) {
      state.finalists[cat.id] = proposal
        .filter((p) => p.category_id === cat.id && p.status !== 'out')
        .slice(0, n)
        .map((p) => p.candidate_id)
    }
    state.settings.finalists_confirmed = true
    state.settings.finalists_confirmed_at = new Date().toISOString()
  }
  if ((phase === 'awaiting_gala' || phase === 'results') && !hasPhase2Votes()) simulatePhase2()
  state.settings.results_published = phase === 'results'
  state.phase = phase
  save()
}

export const DEMO_HINT = `Na demonstração, use um número de membro entre ${DEMO_MEMBER_RANGE.from} e ${DEMO_MEMBER_RANGE.to}.`

// ------------------------------------------------------------- helpers -----

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))
const activeCategories = () => state.categories.filter((c) => c.active !== false).sort((a, b) => a.sort_order - b.sort_order)
const candidateName = (id: string) => state.candidates.find((c) => c.id === id)?.name ?? '—'

function hasPhase2Votes() {
  return Object.keys(state.tallies).some((k) => k.startsWith('2|'))
}

function simulatePhase2() {
  const rand = mulberry32(11)
  const voters = state.members.slice(40)
  for (const m of voters) state.voted[m.id] = Array.from(new Set([...(state.voted[m.id] ?? []), 2]))
  for (const cat of activeCategories()) {
    const fins = state.finalists[cat.id] ?? []
    if (!fins.length) continue
    const weights = fins.map((_, i) => 1.4 - i * 0.22 + rand() * 0.5)
    const total = weights.reduce((a, b) => a + b, 0)
    for (let v = 0; v < voters.length; v++) {
      let r = rand() * total
      let idx = 0
      while (r > weights[idx]) r -= weights[idx++]
      const key = `2|${cat.id}|${fins[idx]}`
      state.tallies[key] = (state.tallies[key] ?? 0) + 1
    }
  }
}

function computeProposal(): ProposalRow[] {
  const n = state.settings.finalists_per_category
  const rows: ProposalRow[] = []
  for (const cat of activeCategories()) {
    const ranked = state.candidates
      .map((c) => ({ c, v: state.tallies[`1|${cat.id}|${c.id}`] ?? 0 }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v || a.c.name.localeCompare(b.c.name, 'pt'))
    const cut = ranked.length >= n ? ranked[n - 1].v : null
    const atOrAbove = cut === null ? ranked.length : ranked.filter((x) => x.v >= cut).length
    ranked.forEach((x, i) => {
      let status: ProposalRow['status']
      if (cut === null || x.v > cut) status = 'qualified'
      else if (x.v === cut) status = atOrAbove > n ? 'tied' : 'qualified'
      else status = 'out'
      rows.push({ category_id: cat.id, candidate_id: x.c.id, candidate_name: x.c.name, votes: x.v, rank_pos: i + 1, status })
    })
  }
  return rows
}

function tiesList(): string[] {
  return Array.from(
    new Set(
      computeProposal()
        .filter((p) => p.status === 'tied')
        .map((p) => p.category_id),
    ),
  )
}

// ------------------------------------------------------------------ API ----

export function createDemoApi(): VotingApi {
  let adminSignedIn = sessionStorage.getItem('globos-cvp-demo-admin') === '1'

  return {
    mode: 'demo',

    async getPublicState(): Promise<PublicState> {
      await delay(120)
      const s = state.settings
      return {
        server_now: new Date().toISOString(),
        phase: state.phase,
        phase1_opens_at: s.phase1_opens_at,
        phase1_closes_at: s.phase1_closes_at,
        phase2_opens_at: s.phase2_opens_at,
        phase2_closes_at: s.phase2_closes_at,
        gala_at: s.gala_at,
        finalists_per_category: s.finalists_per_category,
        categories: activeCategories(),
      }
    },

    async startSession(memberNumber) {
      await delay(700)
      if (state.phase !== 'phase1' && state.phase !== 'phase2') return { ok: false, error: 'voting_closed', phase: state.phase }
      const num = normalizeMemberNumber(memberNumber)
      const member = state.members.find((m) => m.member_number === num && m.active)
      if (!member) return { ok: false, error: 'not_authorized' }
      const phaseN = state.phase === 'phase1' ? 1 : 2
      if (state.voted[member.id]?.includes(phaseN)) return { ok: false, error: 'already_voted', phase: state.phase }
      const token = `demo-${crypto.getRandomValues(new Uint32Array(2)).join('')}`
      state.sessions = { [token]: { member_id: member.id, phase: phaseN, expires: Date.now() + 45 * 60_000 } }
      save()
      return {
        ok: true,
        token,
        phase: state.phase,
        expires_at: new Date(Date.now() + 45 * 60_000).toISOString(),
        candidates: phaseN === 1 ? state.candidates.filter((c) => c.active).map(({ id, name }) => ({ id, name })) : [],
        finalists:
          phaseN === 2
            ? Object.entries(state.finalists).flatMap(([category_id, ids]) =>
                ids.map((candidate_id) => ({ category_id, candidate_id, name: candidateName(candidate_id) })),
              )
            : [],
      }
    },

    async submitBallot(token, votes) {
      await delay(1100)
      const session = state.sessions[token]
      if (!session || session.expires < Date.now()) return { ok: false, error: 'session_expired' }
      const phaseN = state.phase === 'phase1' ? 1 : state.phase === 'phase2' ? 2 : null
      if (phaseN !== session.phase) return { ok: false, error: 'voting_closed' }
      const cats = activeCategories()
      if (votes.length !== cats.length || new Set(votes.map((v) => v.category_id)).size !== cats.length) {
        return { ok: false, error: 'invalid_ballot' }
      }
      if (state.voted[session.member_id]?.includes(phaseN)) return { ok: false, error: 'already_voted' }
      state.voted[session.member_id] = [...(state.voted[session.member_id] ?? []), phaseN]
      for (const v of votes) {
        const key = `${phaseN}|${v.category_id}|${v.candidate_id}`
        state.tallies[key] = (state.tallies[key] ?? 0) + 1
      }
      delete state.sessions[token]
      save()
      return { ok: true }
    },

    async getPublicResults(): Promise<PublicResults> {
      await delay(200)
      if (state.phase !== 'results') return { published: false }
      return {
        published: true,
        categories: activeCategories().map((cat) => {
          const fins = (state.finalists[cat.id] ?? [])
            .map((id) => ({ id, v: state.tallies[`2|${cat.id}|${id}`] ?? 0 }))
            .sort((a, b) => b.v - a.v || candidateName(a.id).localeCompare(candidateName(b.id), 'pt'))
          const max = fins[0]?.v ?? 0
          return {
            category_id: cat.id,
            name: cat.name,
            icon: cat.icon,
            description: cat.description,
            finalists: fins.map((f) => ({ candidate_id: f.id, name: candidateName(f.id), winner: f.v > 0 && f.v === max })),
          }
        }),
      }
    },

    admin: {
      async getSessionEmail() {
        return adminSignedIn ? 'demo@globos.local' : null
      },
      async signIn() {
        await delay(500)
        adminSignedIn = true
        sessionStorage.setItem('globos-cvp-demo-admin', '1')
        return { ok: true }
      },
      async signOut() {
        adminSignedIn = false
        sessionStorage.removeItem('globos-cvp-demo-admin')
      },
      async isAdmin() {
        return adminSignedIn
      },

      async overview(): Promise<AdminOverview> {
        await delay(150)
        const voters = (p: number) => Object.values(state.voted).filter((v) => v.includes(p)).length
        return {
          server_now: new Date().toISOString(),
          phase: state.phase,
          settings: state.settings,
          members_total: state.members.length,
          members_active: state.members.filter((m) => m.active).length,
          phase1_voters: voters(1),
          phase2_voters: voters(2),
          candidates_active: state.candidates.filter((c) => c.active).length,
          categories_active: activeCategories().length,
          finalists_count: Object.values(state.finalists).flat().length,
          ties: state.settings.finalists_confirmed ? [] : tiesList(),
        }
      },

      async results(phase): Promise<ResultRow[]> {
        await delay(150)
        const rows: ResultRow[] = []
        for (const cat of activeCategories()) {
          const fins = state.finalists[cat.id] ?? []
          const ids = phase === 1 ? state.candidates.map((c) => c.id) : fins
          for (const id of ids) {
            const votes = state.tallies[`${phase}|${cat.id}|${id}`] ?? 0
            if (phase === 1 && votes === 0) continue
            rows.push({ category_id: cat.id, candidate_id: id, candidate_name: candidateName(id), votes, is_finalist: fins.includes(id) })
          }
        }
        return rows.sort((a, b) => b.votes - a.votes)
      },

      async finalistProposal() {
        await delay(150)
        return computeProposal()
      },

      async autoFinalize() {
        await delay(300)
        const ties = tiesList()
        if (ties.length) return { confirmed: false, ties }
        const proposal = computeProposal()
        state.finalists = {}
        for (const cat of activeCategories()) {
          state.finalists[cat.id] = proposal.filter((p) => p.category_id === cat.id && p.status === 'qualified').map((p) => p.candidate_id)
        }
        state.settings.finalists_confirmed = true
        state.settings.finalists_confirmed_at = new Date().toISOString()
        save()
        return { confirmed: true, ties: [] }
      },

      async setFinalists(selection) {
        await delay(300)
        if (hasPhase2Votes()) return { ok: false, error: 'A final já tem votos: não é possível alterar os finalistas.' }
        if (activeCategories().some((c) => !(selection[c.id]?.length > 0))) {
          return { ok: false, error: 'Todas as categorias ativas precisam de pelo menos um finalista.' }
        }
        state.finalists = selection
        state.settings.finalists_confirmed = true
        state.settings.finalists_confirmed_at = new Date().toISOString()
        save()
        return { ok: true }
      },

      async resetFinalists() {
        if (hasPhase2Votes()) return { ok: false, error: 'A final já tem votos: não é possível repor os finalistas.' }
        state.finalists = {}
        state.settings.finalists_confirmed = false
        state.settings.finalists_confirmed_at = null
        save()
        return { ok: true }
      },

      async updateSettings(patch) {
        await delay(250)
        state.settings = { ...state.settings, ...patch }
        if (patch.results_published !== undefined) {
          if (patch.results_published) {
            if (!hasPhase2Votes() && state.settings.finalists_confirmed) simulatePhase2()
            state.phase = 'results'
          } else if (state.phase === 'results') state.phase = 'awaiting_gala'
        }
        save()
        return { ok: true }
      },

      async resetVotes(phase, confirmation) {
        if (confirmation !== 'APAGAR') return { ok: false, error: 'Confirmação inválida.' }
        for (const k of Object.keys(state.tallies)) if (k.startsWith(`${phase}|`)) delete state.tallies[k]
        for (const id of Object.keys(state.voted)) state.voted[id] = state.voted[id].filter((p) => p !== phase)
        save()
        return { ok: true }
      },

      async listCategories() {
        return [...state.categories].sort((a, b) => a.sort_order - b.sort_order)
      },
      async saveCategory(c) {
        if (c.id) {
          state.categories = state.categories.map((x) => (x.id === c.id ? { ...x, ...c } : x))
        } else {
          state.categories.push({
            id: `cat-${Date.now()}`,
            slug: normalizeText(c.name).replace(/\s+/g, '-'),
            name: c.name,
            description: c.description ?? '',
            icon: c.icon ?? 'trophy',
            sort_order: c.sort_order ?? state.categories.length + 1,
            active: c.active ?? true,
          })
        }
        save()
        return { ok: true }
      },
      async deleteCategory(id) {
        if (Object.keys(state.tallies).some((k) => k.split('|')[1] === id)) {
          return { ok: false, error: 'Não é possível apagar: existem votos associados. Desative em vez de apagar.' }
        }
        state.categories = state.categories.filter((c) => c.id !== id)
        save()
        return { ok: true }
      },

      async listCandidates() {
        return [...state.candidates].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
      },
      async saveCandidate(c) {
        const name = c.name.trim().replace(/\s+/g, ' ')
        const dup = state.candidates.find((x) => normalizeText(x.name) === normalizeText(name) && x.id !== c.id)
        if (dup) return { ok: false, error: 'Já existe um registo com esse valor.' }
        if (c.id) state.candidates = state.candidates.map((x) => (x.id === c.id ? { ...x, name, active: c.active ?? x.active } : x))
        else state.candidates.push({ id: `cand-${Date.now()}`, name, active: true, created_at: new Date().toISOString() })
        save()
        return { ok: true }
      },
      async deleteCandidate(id) {
        if (Object.keys(state.tallies).some((k) => k.endsWith(`|${id}`))) {
          return { ok: false, error: 'Não é possível apagar: existem votos associados. Desative em vez de apagar.' }
        }
        state.candidates = state.candidates.filter((c) => c.id !== id)
        save()
        return { ok: true }
      },
      async importCandidates(names) {
        let inserted = 0
        const seen = new Set(state.candidates.map((c) => normalizeText(c.name)))
        for (const raw of names) {
          const name = raw.trim().replace(/\s+/g, ' ')
          const key = normalizeText(name)
          if (name.length < 2 || seen.has(key)) continue
          seen.add(key)
          state.candidates.push({ id: `cand-${Date.now()}-${inserted}`, name, active: true, created_at: new Date().toISOString() })
          inserted++
        }
        save()
        return { inserted, skipped: names.length - inserted }
      },

      async listMembers() {
        return [...state.members]
      },
      async importMembers(numbers) {
        let inserted = 0
        const seen = new Set(state.members.map((m) => m.member_number))
        for (const raw of numbers) {
          const num = normalizeMemberNumber(raw)
          if (!num || seen.has(num)) continue
          seen.add(num)
          state.members.push({ id: `mem-x${Date.now()}-${inserted}`, member_number: num, active: true, has_pin: false, created_at: new Date().toISOString() })
          inserted++
        }
        save()
        return { inserted, skipped: numbers.length - inserted }
      },
      async setMemberActive(id, active) {
        state.members = state.members.map((m) => (m.id === id ? { ...m, active } : m))
        save()
        return { ok: true }
      },
      async setMemberPin(id, pin) {
        state.members = state.members.map((m) => (m.id === id ? { ...m, has_pin: Boolean(pin) } : m))
        save()
        return { ok: true }
      },
      async deleteMember(id) {
        if (state.voted[id]?.length) return { ok: false, error: 'Este membro já votou: desative-o em vez de o apagar.' }
        state.members = state.members.filter((m) => m.id !== id)
        save()
        return { ok: true }
      },
    },
  }
}
