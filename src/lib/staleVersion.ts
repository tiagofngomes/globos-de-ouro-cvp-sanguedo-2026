/**
 * Proteção contra versões antigas do site.
 *
 * Cada publicação apaga os ficheiros da versão anterior. Quem tinha o site aberto
 * de antes e entra numa parte que ainda não tinha sido descarregada (área
 * reservada, Modo Gala) pede um ficheiro que já não existe. Nesse caso a página
 * recarrega sozinha, uma única vez, e passa a usar a versão nova. Se mesmo assim
 * falhar, o erro segue para o ErrorBoundary (mensagem com botão), sem ciclos.
 */
const KEY = 'globos-cvp-reload-at'
const WINDOW_MS = 60_000

function recentlyReloaded(): boolean {
  try {
    const at = Number(sessionStorage.getItem(KEY) ?? 0)
    return Date.now() - at < WINDOW_MS
  } catch {
    return true // sem sessionStorage não arriscamos recarregar em ciclo
  }
}

/** Recarrega a página uma vez; devolve false se já o fez há pouco (para não entrar em ciclo). */
export function reloadOnce(): boolean {
  if (recentlyReloaded()) return false
  try {
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/** Para usar com React.lazy: se o ficheiro da parte pedida já não existir, recarrega a página uma vez. */
export function importWithReload<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().catch((error: unknown) => {
      // enquanto a página recarrega, fica à espera (o ecrã de carregamento continua visível)
      if (reloadOnce()) return new Promise<T>(() => {})
      throw error
    })
}

/** O Vite avisa quando não consegue carregar ficheiros auxiliares de uma parte do site. */
export function installStaleVersionGuard() {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnce()) event.preventDefault()
  })
}
