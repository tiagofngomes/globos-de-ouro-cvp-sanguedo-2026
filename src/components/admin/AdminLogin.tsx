import { motion } from 'framer-motion'
import { LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi, usePath } from '../../api/ApiContext'
import { GalaBackground } from '../layout/GalaBackground'
import { CvpBrand } from '../ui/CvpBrand'
import { Spinner } from '../ui/Feedback'
import { Trophy } from '../ui/Trophy'

export function AdminLogin({ onSuccess, subtitle }: { onSuccess: () => void; subtitle?: string }) {
  const { api, isDemo } = useApi()
  const path = usePath()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await api.admin.signIn(email, password)
    setLoading(false)
    if (res.ok) onSuccess()
    else setError(res.error ?? 'Não foi possível entrar.')
  }

  return (
    <div className="relative grid min-h-[100dvh] place-items-center px-4 py-10">
      <GalaBackground intensity={0.6} />
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="card-gala w-full max-w-sm p-7">
        <div className="flex justify-center">
          <CvpBrand compact />
        </div>
        <Trophy className="mx-auto mt-6 h-24 w-16" />
        <h1 className="mt-4 text-center font-display text-2xl text-gold-50">Área reservada</h1>
        <p className="mt-1 text-center text-xs text-gold-100/50">{subtitle ?? 'Painel de administração dos Globos da Cruz'}</p>

        {isDemo ? (
          <p className="mt-6 rounded-xl border border-gold-400/20 bg-gold-400/5 p-3 text-center text-xs text-gold-100/70">
            Demonstração: não são necessárias credenciais.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="label-gala" htmlFor="email">
                Utilizador
              </label>
              <input
                id="email"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-gala py-3"
              />
            </div>
            <div>
              <label className="label-gala" htmlFor="password">
                Palavra-passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-gala py-3"
              />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-cvp-500/40 bg-cvp-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-gold mt-6 w-full py-3.5">
          {loading ? (
            <Spinner />
          ) : (
            <>
              <LockKeyhole className="h-4 w-4" /> Entrar
            </>
          )}
        </button>
        <Link to={path('/')} className="mt-4 block text-center text-xs text-gold-100/40 hover:text-gold-200">
          Voltar ao site
        </Link>
      </motion.form>
    </div>
  )
}
