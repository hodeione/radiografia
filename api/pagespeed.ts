import { Limitador, ipDe, json } from './_lib/limites.js'
import { normalizarUrl } from './_lib/red.js'
import type { PageSpeed } from './_lib/informe.js'

/**
 * GET /api/pagespeed?url=… → Lighthouse de Google (PageSpeed Insights) en
 * móvil: notas oficiales, Core Web Vitals y datos reales de usuarios de
 * Chrome si los hay. Lighthouse corre en los servidores de Google, así que
 * aquí solo se espera. Necesita PSI_API_KEY (gratuita en Google Cloud).
 */

const limitador = new Limitador(10, 10 * 60_000, 400, 60 * 60_000)

interface Auditoria {
  numericValue?: number
  displayValue?: string
  score?: number | null
}


export async function GET(request: Request): Promise<Response> {
  const entrada = new URL(request.url).searchParams.get('url') ?? ''
  if (!entrada) return json(200, { configured: Boolean(process.env.PSI_API_KEY) })
  if (!process.env.PSI_API_KEY) return json(503, { error: 'Lighthouse no está activado.', codigo: 'sin_clave' })
  let url: URL
  try {
    url = normalizarUrl(entrada)
  } catch {
    return json(400, { error: 'Dirección no válida.' })
  }
  if (!limitador.comprobar(ipDe(request)).ok) return json(429, { error: 'Demasiadas peticiones.' })

  const q = new URLSearchParams({ url: url.href, strategy: 'mobile', locale: 'es', key: process.env.PSI_API_KEY })
  for (const c of ['performance', 'accessibility', 'best-practices', 'seo']) q.append('category', c)
  let r: Response
  try {
    r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(55_000) })
  } catch {
    return json(504, { error: 'Google ha tardado demasiado en analizar la web.' })
  }
  if (!r.ok) return json(502, { error: r.status === 429 ? 'Google está saturado. Prueba en un rato.' : 'Google no ha podido analizar esta web.' })
  const d = (await r.json()) as {
    lighthouseResult: { categories: Record<string, { score: number }>; audits: Record<string, Auditoria> }
    loadingExperience?: { overall_category?: string; metrics?: Record<string, { percentile: number }> }
  }
  const c = d.lighthouseResult.categories
  const a = d.lighthouseResult.audits
  const m = d.loadingExperience?.metrics
  const salida: PageSpeed = {
    notas: {
      rendimiento: Math.round((c.performance?.score ?? 0) * 100),
      accesibilidad: Math.round((c.accessibility?.score ?? 0) * 100),
      buenasPracticas: Math.round((c['best-practices']?.score ?? 0) * 100),
      seo: Math.round((c.seo?.score ?? 0) * 100),
    },
    metricas: {
      lcp: a['largest-contentful-paint']?.displayValue ?? '',
      cls: a['cumulative-layout-shift']?.displayValue ?? '',
      tbt: a['total-blocking-time']?.displayValue ?? '',
      fcp: a['first-contentful-paint']?.displayValue ?? '',
      si: a['speed-index']?.displayValue ?? '',
    },
    campo: d.loadingExperience?.overall_category
      ? {
          categoria: d.loadingExperience.overall_category,
          lcpMs: m?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
          inpMs: m?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
          cls: m?.CUMULATIVE_LAYOUT_SHIFT_SCORE ? m.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
        }
      : null,
  }
  return json(200, salida, { 'cache-control': 'public, s-maxage=3600' })
}
