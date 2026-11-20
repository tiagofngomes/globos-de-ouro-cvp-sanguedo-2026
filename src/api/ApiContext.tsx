import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { VotingApi } from './types'
import { createSupabaseApi } from './supabaseApi'
import { createDemoApi } from '../demo/demoApi'

interface ApiContextValue {
  api: VotingApi
  /** prefixo das rotas: '' (real) ou '/demo' */
  base: string
  isDemo: boolean
}

const ApiContext = createContext<ApiContextValue | null>(null)

let liveApi: VotingApi | null = null
let demoApi: VotingApi | null = null

export function ApiProvider({ mode, children }: { mode: 'live' | 'demo'; children: ReactNode }) {
  const value = useMemo<ApiContextValue>(() => {
    if (mode === 'demo') {
      demoApi ??= createDemoApi()
      return { api: demoApi, base: '/demo', isDemo: true }
    }
    liveApi ??= createSupabaseApi()
    return { api: liveApi, base: '', isDemo: false }
  }, [mode])
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
}

export function useApi() {
  const ctx = useContext(ApiContext)
  if (!ctx) throw new Error('useApi fora de ApiProvider')
  return ctx
}

/** Constrói um caminho respeitando o modo (real/demonstração). */
export function usePath() {
  const { base } = useApi()
  return (path: string) => `${base}${path === '/' && base ? '' : path}` || '/'
}
