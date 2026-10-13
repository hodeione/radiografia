/** Límite de uso en memoria por instancia: frena abusos sin base de datos. */
export class Limitador {
  private hits = new Map<string, number[]>()
  private global: number[] = []
  constructor(
    private porIp: number,
    private ventanaIp: number,
    private maxGlobal: number,
    private ventanaGlobal: number,
  ) {}

  comprobar(clave: string, ahora = Date.now()): { ok: true } | { ok: false; reintentarEn: number } {
    this.global = this.global.filter((t) => ahora - t < this.ventanaGlobal)
    if (this.global.length >= this.maxGlobal) return { ok: false, reintentarEn: Math.ceil((this.ventanaGlobal - (ahora - this.global[0]!)) / 1000) }
    const lista = (this.hits.get(clave) ?? []).filter((t) => ahora - t < this.ventanaIp)
    if (lista.length >= this.porIp) {
      this.hits.set(clave, lista)
      return { ok: false, reintentarEn: Math.ceil((this.ventanaIp - (ahora - lista[0]!)) / 1000) }
    }
    lista.push(ahora)
    this.hits.set(clave, lista)
    this.global.push(ahora)
    if (this.hits.size > 5000) this.hits.clear()
    return { ok: true }
  }
}

export function origenPermitido(origin: string | null, host: string | null): boolean {
  if (!origin) return false
  try {
    const o = new URL(origin)
    if (o.hostname === 'localhost' || o.hostname === '127.0.0.1') return true
    if (host && o.host === host) return true
    return o.hostname === 'dht-radiografia.vercel.app'
  } catch {
    return false
  }
}

export const ipDe = (r: Request) => (r.headers.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'desconocida'

export function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } })
}
