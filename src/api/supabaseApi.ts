import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js'
import type {
  AdminOverview,
  Category,
  Candidate,
  EventSettings,
  ImportResult,
  Member,
  OpResult,
  ProposalRow,
  PublicResults,
  PublicState,
  ResultRow,
  SubmitResult,
  VotingApi,
  VotingSession,
} from './types'

/**
 * O Supabase exige um email, mas os administradores entram só com um nome de
 * utilizador: "tiago" → "tiago@globos-sanguedo.pt". Nenhum email é enviado.
 */
export const ADMIN_LOGIN_DOMAIN = 'globos-sanguedo.pt'
export const adminLoginEmail = (user: string) => {
  const u = user.trim().toLowerCase()
  return u.includes('@') ? u : `${u}@${ADMIN_LOGIN_DOMAIN}`
}
const displayUser = (email: string) => (email.endsWith(`@${ADMIN_LOGIN_DOMAIN}`) ? email.slice(0, -ADMIN_LOGIN_DOMAIN.length - 1) : email)

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('xxxxxxxx'))

let client: SupabaseClient | null = null
function sb(): SupabaseClient {
  if (!client) {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado')
    client = createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'globos-cvp-admin' },
    })
  }
  return client
}

function friendly(error: PostgrestError | Error | null): string {
  if (!error) return 'Erro desconhecido.'
  const msg = error.message ?? ''
  if ('code' in error && error.code === '23503') return 'Não é possível apagar: existem votos associados. Desative em vez de apagar.'
  if ('code' in error && error.code === '23505') return 'Já existe um registo com esse valor.'
  if ('code' in error && error.code === '42501') return 'Sem permissões para esta operação.'
  if ('code' in error && error.code === '23514')
    return 'As datas estão fora de ordem: a 1ª fase tem de fechar depois de abrir, a 2ª fase não pode abrir antes do fecho da 1ª e tem de fechar depois de abrir.'
  return msg || 'Ocorreu um erro.'
}

/** Sessão de administrador expirada (o painel esteve aberto muito tempo). */
function isExpiredSession(error: PostgrestError | null): boolean {
  if (!error) return false
  return error.code === 'PGRST301' || error.code === 'PGRST303' || /jwt|token/i.test(error.message ?? '')
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  let { data, error } = await sb().rpc(fn, args)
  // sessão expirada: renova e tenta outra vez, sem o administrador dar por nada
  if (isExpiredSession(error)) {
    const refreshed = await sb().auth.refreshSession()
    if (!refreshed.error) ({ data, error } = await sb().rpc(fn, args))
  }
  if (error) throw new Error(isExpiredSession(error) ? 'A sessão expirou. Saia do painel e volte a entrar.' : friendly(error))
  return data as T
}

/** Para ações que devolvem { ok, error }: um erro de rede ou de sessão vira uma mensagem, nunca uma exceção. */
async function rpcOp(fn: string, args?: Record<string, unknown>): Promise<OpResult> {
  try {
    return await rpc<OpResult>(fn, args)
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Não foi possível contactar o servidor. Tente novamente.' }
  }
}

function op(error: PostgrestError | null): OpResult {
  return error ? { ok: false, error: friendly(error) } : { ok: true }
}

export function createSupabaseApi(): VotingApi {
  return {
    mode: 'live',

    getPublicState: () => rpc<PublicState>('get_public_state'),

    async startSession(code) {
      try {
        return await rpc<VotingSession>('start_voting_session', { p_member_number: code, p_pin: null })
      } catch {
        return { ok: false, error: 'network' }
      }
    },

    async submitBallot(token, votes) {
      try {
        return await rpc<SubmitResult>('submit_ballot', { p_token: token, p_votes: votes })
      } catch {
        return { ok: false, error: 'network' }
      }
    },

    getPublicResults: () => rpc<PublicResults>('get_public_results'),

    admin: {
      async getSessionEmail() {
        const { data } = await sb().auth.getSession()
        const email = data.session?.user.email
        return email ? displayUser(email) : null
      },
      async signIn(email, password) {
        const { error } = await sb().auth.signInWithPassword({ email: adminLoginEmail(email), password })
        if (error) return { ok: false, error: 'Credenciais inválidas.' }
        const admin = await rpc<boolean>('is_admin')
        if (!admin) {
          await sb().auth.signOut()
          return { ok: false, error: 'Esta conta não tem permissões de administração.' }
        }
        return { ok: true }
      },
      async signOut() {
        await sb().auth.signOut()
      },
      isAdmin: () => rpc<boolean>('is_admin'),

      overview: () => rpc<AdminOverview>('admin_overview'),
      results: (phase) => rpc<ResultRow[]>('admin_results', { p_phase: phase }),
      finalistProposal: () => rpc<ProposalRow[]>('admin_finalist_proposal'),
      setFinalists: (selection) => rpcOp('admin_set_finalists', { p_selection: selection }),
      resetFinalists: () => rpcOp('admin_reset_finalists'),
      setWinners: (categoryId, candidateIds) => rpcOp('admin_set_winners', { p_category: categoryId, p_candidates: candidateIds }),
      async updateSettings(patch: Partial<EventSettings>) {
        const { error } = await sb()
          .from('event_settings')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', true)
        return op(error)
      },
      resetVotes: (phase, confirmation) => rpc<OpResult>('admin_reset_votes', { p_phase: phase, p_confirmation: confirmation }),

      async listCategories() {
        const { data, error } = await sb().from('categories').select('*').order('sort_order').order('name')
        if (error) throw new Error(friendly(error))
        return data as Category[]
      },
      async reorderCategories(ids) {
        const results = await Promise.all(
          ids.map((id, i) =>
            sb()
              .from('categories')
              .update({ sort_order: i + 1 })
              .eq('id', id),
          ),
        )
        return op(results.find((r) => r.error)?.error ?? null)
      },
      async saveCategory(c) {
        const row = {
          name: c.name.trim(),
          description: c.description ?? '',
          icon: c.icon ?? 'trophy',
          sort_order: c.sort_order ?? 0,
          active: c.active ?? true,
        }
        if (c.id) return op((await sb().from('categories').update(row).eq('id', c.id)).error)
        const slug =
          c.slug ??
          c.name
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') +
            '-' +
            Math.random().toString(36).slice(2, 6)
        return op(
          (
            await sb()
              .from('categories')
              .insert({ ...row, slug })
          ).error,
        )
      },
      async deleteCategory(id) {
        return op((await sb().from('categories').delete().eq('id', id)).error)
      },

      async listCandidates() {
        const { data, error } = await sb().from('candidates').select('*').order('name')
        if (error) throw new Error(friendly(error))
        return data as Candidate[]
      },
      async saveCandidate(c) {
        const row = { name: c.name.trim().replace(/\s+/g, ' '), active: c.active ?? true }
        if (c.id) return op((await sb().from('candidates').update(row).eq('id', c.id)).error)
        return op((await sb().from('candidates').insert(row)).error)
      },
      async deleteCandidate(id) {
        return op((await sb().from('candidates').delete().eq('id', id)).error)
      },
      importCandidates: (names) => rpc<ImportResult>('admin_import_candidates', { p_names: names }),

      listMembers: () => rpc<Member[]>('admin_list_members'),
      importMembers: (numbers) => rpc<ImportResult>('admin_import_members', { p_numbers: numbers }),
      async setMemberActive(id, active) {
        return op((await sb().from('members').update({ active }).eq('id', id)).error)
      },
      async deleteMember(id) {
        return op((await sb().from('members').delete().eq('id', id)).error)
      },
    },
  }
}
