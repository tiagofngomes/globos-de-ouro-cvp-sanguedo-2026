import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '../api/ApiContext'
import type { PublicState } from '../api/types'
import { subscribeDemo } from '../demo/demoApi'

/**
 * Estado público do evento vindo do servidor. Guarda também a diferença entre
 * o relógio do servidor e o do dispositivo, para que as contagens
 * decrescentes não dependam da hora (possivelmente errada) do telemóvel.
 */
export function usePublicState(pollMs = 30_000) {
  const { api, isDemo } = useApi()
  const [state, setState] = useState<PublicState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const t0 = Date.now()
      const s = await api.getPublicState()
      const t1 = Date.now()
      if (!alive.current) return
      setOffset(new Date(s.server_now).getTime() - (t0 + t1) / 2)
      setState(s)
      setError(null)
    } catch (e) {
      if (alive.current) setError((e as Error).message || 'Sem ligação ao servidor.')
    }
  }, [api])

  useEffect(() => {
    alive.current = true
    refresh()
    const id = setInterval(refresh, pollMs)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    const unsub = isDemo ? subscribeDemo(refresh) : undefined
    return () => {
      alive.current = false
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      unsub?.()
    }
  }, [refresh, pollMs, isDemo])

  return { state, error, offset, refresh }
}
