import Anthropic from '@anthropic-ai/sdk'
import { Limitador, ipDe, json, origenPermitido } from './_lib/limites.js'
import { ESQUEMA_IA, INSTRUCCIONES_IA, mensajeIA, type Propuesta } from './_lib/textos.js'
import type { Datos } from './_lib/extraer.js'

/**
 * POST /api/textos  { textos } → propuesta de textos con Claude Haiku 5.5
 * GET  /api/textos            → { configured }: si hay clave y saldo
 */

const MODELO = 'claude-haiku-5-5'
const limitador = new Limitador(10, 10 * 60_000, 500, 60 * 60_000)
let cliente: Anthropic | null = null
let sinSaldoHasta = 0
let comprobadoHasta = 0

const sinSaldo = (e: unknown) => /credit balance|billing/i.test(e instanceof Error ? e.message : String(e))

export async function GET(): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json(200, { configured: false, motivo: 'sin_clave' })
  // Una petición de un token, como mucho cada 10 minutos, para saber si hay saldo.
  if (Date.now() > comprobadoHasta && Date.now() > sinSaldoHasta) {
    comprobadoHasta = Date.now() + 10 * 60_000
    try {
      cliente ??= new Anthropic()
      await cliente.messages.create({ model: MODELO, max_tokens: 1, messages: [{ role: 'user', content: '.' }] })
    } catch (e) {
      if (sinSaldo(e) || e instanceof Anthropic.AuthenticationError) sinSaldoHasta = Date.now() + 10 * 60_000
    }
  }
  const ok = Date.now() > sinSaldoHasta
  return json(200, { configured: ok, motivo: ok ? null : 'sin_saldo' })
}

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '')
const lista = (v: unknown, n: number, m: number) => (Array.isArray(v) ? v.slice(0, n).map((x) => str(x, m)) : [])

export async function POST(request: Request): Promise<Response> {
  if (!origenPermitido(request.headers.get('origin'), request.headers.get('host'))) return json(403, { error: 'Origen no permitido.' })
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'La IA no está activada.', codigo: 'sin_clave' })
  if (Date.now() < sinSaldoHasta) return json(503, { error: 'La IA no tiene saldo.', codigo: 'sin_saldo' })
  if (!limitador.comprobar(ipDe(request)).ok) return json(429, { error: 'Demasiadas peticiones.', codigo: 'limite' })

  let b: Record<string, unknown>
  try {
    b = ((await request.json()) as { textos?: Record<string, unknown> }).textos ?? {}
  } catch {
    return json(400, { error: 'Petición no válida.' })
  }
  const d = {
    titulo: str(b.titulo, 200),
    descripcion: str(b.descripcion, 400),
    h1: lista(b.h1, 4, 200),
    llamadasAccion: lista(b.llamadasAccion, 8, 60),
    texto: str(b.texto, 2500),
    nombre: str(b.nombre, 80),
    ciudad: str(b.ciudad, 60),
    telefonos: lista(b.telefonos, 2, 20),
  } as Datos

  try {
    cliente ??= new Anthropic()
    const r = await cliente.messages.create({
      model: MODELO,
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_IA as unknown as Record<string, unknown> } },
      system: INSTRUCCIONES_IA,
      messages: [{ role: 'user', content: mensajeIA(d) }],
    })
    if (r.stop_reason === 'refusal') return json(422, { error: 'La IA no ha podido revisar esta web.' })
    const t = r.content.find((x) => x.type === 'text')
    const p = JSON.parse(t && t.type === 'text' ? t.text : '{}') as Omit<Propuesta, 'origen'>
    if (!p.titulo || !p.h1) return json(502, { error: 'Respuesta no válida de la IA.' })
    return json(200, { ...p, problemas: (p.problemas ?? []).slice(0, 3), origen: 'ia' } satisfies Propuesta)
  } catch (e) {
    if (sinSaldo(e)) {
      sinSaldoHasta = Date.now() + 10 * 60_000
      return json(503, { error: 'La IA no tiene saldo.', codigo: 'sin_saldo' })
    }
    if (e instanceof Anthropic.RateLimitError) return json(503, { error: 'La IA está saturada.', codigo: 'ocupado' })
    return json(502, { error: 'La IA no responde.', codigo: 'ia' })
  }
}
