import { analizar, type Informe } from './_lib/analizar.js'
import { Limitador, ipDe, json } from './_lib/limites.js'
import { ErrorRed } from './_lib/red.js'

/**
 * GET /api/analizar?url=…
 * Devuelve NDJSON: una línea por paso ({tipo:'paso'}) y al final el informe
 * ({tipo:'informe'}) o el error ({tipo:'error'}). Casi todo es espera de
 * red, así que apenas consume CPU.
 */

// 15 análisis por IP cada 10 minutos y 600 por hora en total por instancia.
const limitador = new Limitador(15, 10 * 60_000, 600, 60 * 60_000)
/** Mismo dominio en los últimos 10 minutos: se reutiliza (al compartir el enlace del informe, por ejemplo). */
const cache = new Map<string, { informe: Informe; hasta: number }>()

export async function GET(request: Request): Promise<Response> {
  const entrada = new URL(request.url).searchParams.get('url')?.slice(0, 500) ?? ''
  if (!entrada.trim()) return json(400, { error: 'Falta la dirección de la web.' })
  const clave = entrada.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
  const enCache = cache.get(clave)
  const cod = new TextEncoder()

  if (!enCache || enCache.hasta < Date.now()) {
    const rl = limitador.comprobar(ipDe(request))
    if (!rl.ok) return json(429, { error: `Has hecho muchos análisis seguidos. Prueba dentro de ${Math.ceil(rl.reintentarEn / 60)} min.` })
  }

  const cuerpo = new ReadableStream<Uint8Array>({
    async start(c) {
      const enviar = (o: unknown) => c.enqueue(cod.encode(JSON.stringify(o) + '\n'))
      try {
        if (enCache && enCache.hasta > Date.now()) {
          enviar({ tipo: 'informe', informe: enCache.informe, cache: true })
          return
        }
        const informe = await analizar(entrada, { alPaso: (paso, texto) => enviar({ tipo: 'paso', paso, texto }) })
        cache.set(clave, { informe, hasta: Date.now() + 10 * 60_000 })
        if (cache.size > 300) cache.delete(cache.keys().next().value!)
        enviar({ tipo: 'informe', informe })
      } catch (err) {
        if (err instanceof ErrorRed) enviar({ tipo: 'error', codigo: err.codigo, error: err.message })
        else enviar({ tipo: 'error', codigo: 'interno', error: 'No se ha podido analizar esa web. Prueba de nuevo en un momento.' })
      } finally {
        c.close()
      }
    },
  })
  return new Response(cuerpo, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } })
}
