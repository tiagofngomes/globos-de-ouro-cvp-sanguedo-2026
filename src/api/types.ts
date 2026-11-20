/** Fases do evento, sempre determinadas pelo servidor. */
export type Phase =
  | 'pre_voting' // antes da votação
  | 'phase1' // nomeações
  | 'paused' // votação suspensa pelo administrador
  | 'counting' // apuramento dos finalistas
  | 'phase2' // grande final
  | 'awaiting_gala' // votações encerradas, à espera da gala
  | 'results' // resultados publicados

export interface Category {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  sort_order: number
  active?: boolean
}

export interface PublicState {
  server_now: string
  phase: Phase
  phase1_opens_at: string
  phase1_closes_at: string
  phase2_opens_at: string
  phase2_closes_at: string | null
  gala_at: string | null
  finalists_per_category: number
  categories: Category[]
}

export interface CandidateOption {
  id: string
  name: string
}

export interface FinalistOption {
  category_id: string
  candidate_id: string
  name: string
}

export type SessionError = 'not_authorized' | 'already_voted' | 'voting_closed' | 'too_many_attempts' | 'pin_required' | 'invalid_pin' | 'network'

export type VotingSession =
  | {
      ok: true
      token: string
      phase: 'phase1' | 'phase2'
      expires_at: string
      candidates: CandidateOption[]
      finalists: FinalistOption[]
    }
  | { ok: false; error: SessionError; phase?: Phase }

export interface BallotVote {
  category_id: string
  candidate_id: string
}

export type SubmitError = 'session_expired' | 'voting_closed' | 'invalid_ballot' | 'already_voted' | 'network'
export type SubmitResult = { ok: true } | { ok: false; error: SubmitError }

export interface PublicResults {
  published: boolean
  categories?: Array<{
    category_id: string
    name: string
    icon: string
    description: string
    finalists: Array<{ candidate_id: string; name: string; winner: boolean }>
  }>
}

// ----------------------------------------------------------------- admin ----

export interface EventSettings {
  phase1_opens_at: string
  phase1_closes_at: string
  phase2_opens_at: string
  phase2_closes_at: string | null
  gala_at: string | null
  voting_paused: boolean
  finalists_per_category: number
  finalists_confirmed: boolean
  finalists_confirmed_at: string | null
  results_published: boolean
}

export interface AdminOverview {
  server_now: string
  phase: Phase
  settings: EventSettings
  members_total: number
  members_active: number
  phase1_voters: number
  phase2_voters: number
  candidates_active: number
  categories_active: number
  finalists_count: number
  ties: string[]
}

export interface ResultRow {
  category_id: string
  candidate_id: string
  candidate_name: string
  votes: number
  is_finalist: boolean
}

export interface ProposalRow {
  category_id: string
  candidate_id: string
  candidate_name: string
  votes: number
  rank_pos: number
  status: 'qualified' | 'tied' | 'out'
}

export interface Member {
  id: string
  member_number: string
  active: boolean
  has_pin: boolean
  created_at: string
}

export interface Candidate {
  id: string
  name: string
  active: boolean
  created_at: string
}

export interface ImportResult {
  inserted: number
  skipped: number
}

export interface OpResult {
  ok: boolean
  error?: string
}

/** Contrato comum à API real (Supabase) e à API de demonstração. */
export interface VotingApi {
  readonly mode: 'live' | 'demo'

  getPublicState(): Promise<PublicState>
  startSession(memberNumber: string, pin?: string): Promise<VotingSession>
  submitBallot(token: string, votes: BallotVote[]): Promise<SubmitResult>
  getPublicResults(): Promise<PublicResults>

  admin: {
    getSessionEmail(): Promise<string | null>
    signIn(email: string, password: string): Promise<OpResult>
    signOut(): Promise<void>
    isAdmin(): Promise<boolean>

    overview(): Promise<AdminOverview>
    results(phase: 1 | 2): Promise<ResultRow[]>
    finalistProposal(): Promise<ProposalRow[]>
    autoFinalize(): Promise<{ confirmed: boolean; ties: string[]; reason?: string }>
    setFinalists(selection: Record<string, string[]>): Promise<OpResult>
    resetFinalists(): Promise<OpResult>
    updateSettings(patch: Partial<EventSettings>): Promise<OpResult>
    resetVotes(phase: 1 | 2, confirmation: string): Promise<OpResult>

    listCategories(): Promise<Category[]>
    saveCategory(category: Partial<Category> & { name: string }): Promise<OpResult>
    deleteCategory(id: string): Promise<OpResult>

    listCandidates(): Promise<Candidate[]>
    saveCandidate(candidate: { id?: string; name: string; active?: boolean }): Promise<OpResult>
    deleteCandidate(id: string): Promise<OpResult>
    importCandidates(names: string[]): Promise<ImportResult>

    listMembers(): Promise<Member[]>
    importMembers(numbers: string[]): Promise<ImportResult>
    setMemberActive(id: string, active: boolean): Promise<OpResult>
    setMemberPin(id: string, pin: string | null): Promise<OpResult>
    deleteMember(id: string): Promise<OpResult>
  }
}
