import { useEffect, useRef, useState } from 'react'

export interface CountdownParts {
  total: number
  days: number
  hours: number
  minutes: number
  seconds: number
  done: boolean
}

/** Contagem decrescente corrigida pela diferença de relógio do servidor. */
export function useCountdown(targetIso: string | null | undefined, serverOffsetMs = 0, onDone?: () => void): CountdownParts {
  const compute = (): CountdownParts => {
    const target = targetIso ? new Date(targetIso).getTime() : 0
    const total = Math.max(0, target - (Date.now() + serverOffsetMs))
    return {
      total,
      days: Math.floor(total / 86_400_000),
      hours: Math.floor((total / 3_600_000) % 24),
      minutes: Math.floor((total / 60_000) % 60),
      seconds: Math.floor((total / 1000) % 60),
      done: total <= 0,
    }
  }
  const [parts, setParts] = useState(compute)
  const fired = useRef(false)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    fired.current = false
    const tick = () => {
      const p = compute()
      setParts(p)
      if (p.done && targetIso && !fired.current) {
        fired.current = true
        // pequena margem para o servidor já estar na nova fase
        setTimeout(() => doneRef.current?.(), 1500)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso, serverOffsetMs])

  return parts
}
