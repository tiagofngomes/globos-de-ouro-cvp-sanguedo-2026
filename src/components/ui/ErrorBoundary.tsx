import { Component, type ReactNode } from 'react'
import { GalaBackground } from '../layout/GalaBackground'
import { CvpBrand } from './CvpBrand'
import { Trophy } from './Trophy'

/**
 * Se algo correr mal ao mostrar uma página, aparece uma mensagem com um botão para
 * recarregar, em vez de um ecrã preto.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Erro ao mostrar a página:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    const home = window.location.href.split('#')[0] + (window.location.hash.startsWith('#/demo') ? '#/demo' : '#/')
    return (
      <div className="fixed inset-0 grid place-items-center overflow-y-auto bg-gala-950 px-6 py-10 text-center">
        <GalaBackground intensity={0.5} />
        <div className="relative max-w-md">
          <CvpBrand compact className="justify-center" />
          <Trophy className="mx-auto mt-8 h-32 w-24 opacity-80" glow={false} />
          <h1 className="mt-8 font-display text-2xl text-gold-50 sm:text-3xl">Algo correu mal</h1>
          <p className="mt-3 text-sm text-gold-100/70">Pode acontecer se o site foi atualizado enquanto estava aberto. Recarregue a página para continuar.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button onClick={() => window.location.reload()} className="btn-gold">
              Recarregar página
            </button>
            <a href={home} onClick={() => setTimeout(() => window.location.reload(), 0)} className="btn-ghost">
              Ir para o início
            </a>
          </div>
        </div>
      </div>
    )
  }
}
