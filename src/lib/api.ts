import type { Informe, PageSpeed, Propuesta } from '../../api/_lib/informe'

export type { Informe, PageSpeed, Propuesta }
export type { Hallazgo } from '../../api/_lib/informe'

export class ErrorAnalisis extends Error {}

/** Lanza el análisis y va avisando de cada paso (la función responde en NDJSON). */
export async function analizar(url: string, alPaso: (paso: string, texto: string) => void, senal?: AbortSignal): Promise<Informe> {
  const r = await fetch(`/api/analizar?url=${encodeURIComponent(url)}`, { signal: senal })
  if (!r.ok || !r.body) {
    const e = (await r.json().catch(() => ({}))) as { error?: string }
    throw new ErrorAnalisis(e.error ?? 'No se ha podido analizar la web.')
  }
  const lector = r.body.getReader()
  const dec = new TextDecoder()
  let resto = ''
  for (;;) {
    const { done, value } = await lector.read()
    if (value) resto += dec.decode(value, { stream: true })
    let i: number
    while ((i = resto.indexOf('\n')) >= 0) {
      const linea = resto.slice(0, i).trim()
      resto = resto.slice(i + 1)
      if (!linea) continue
      const m = JSON.parse(linea) as { tipo: string; paso?: string; texto?: string; informe?: Informe; error?: string }
      if (m.tipo === 'paso') alPaso(m.paso!, m.texto!)
      else if (m.tipo === 'informe') return m.informe!
      else if (m.tipo === 'error') throw new ErrorAnalisis(m.error ?? 'No se ha podido analizar la web.')
    }
    if (done) break
  }
  throw new ErrorAnalisis('La conexión se cortó antes de terminar.')
}

export async function disponible(ruta: '/api/textos' | '/api/pagespeed'): Promise<boolean> {
  try {
    const r = await fetch(ruta)
    if (!r.ok) return false
    return Boolean(((await r.json()) as { configured?: boolean }).configured)
  } catch {
    return false
  }
}

export async function textosIA(textos: Informe['textos']): Promise<Propuesta> {
  const r = await fetch('/api/textos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ textos }) })
  const d = (await r.json()) as Propuesta & { error?: string }
  if (!r.ok) throw new ErrorAnalisis(d.error ?? 'La IA no ha podido revisar los textos.')
  return d
}

export async function pagespeed(url: string): Promise<PageSpeed> {
  const r = await fetch(`/api/pagespeed?url=${encodeURIComponent(url)}`)
  const d = (await r.json()) as PageSpeed & { error?: string }
  if (!r.ok) throw new ErrorAnalisis(d.error ?? 'Google no ha podido analizar la web.')
  return d
}
