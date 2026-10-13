import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { connect } from 'node:tls'

/**
 * Descargas seguras de webs de terceros. Como la URL la escribe cualquiera,
 * nunca se pide nada de la red interna (SSRF): se resuelve el dominio y se
 * rechazan direcciones privadas en cada salto de redirección. Además hay
 * límite de tiempo y de tamaño. Todo es espera de red, casi sin CPU.
 */

export const AGENTE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 RadiografiaWeb/1.0 (+https://dht-radiografia.vercel.app)'

export class ErrorRed extends Error {
  constructor(
    public codigo: 'url' | 'privada' | 'dns' | 'tiempo' | 'conexion' | 'grande' | 'redirecciones' | 'no_html' | 'estado',
    mensaje: string,
  ) {
    super(mensaje)
  }
}

/** Normaliza lo que escribe la gente: «mibar.es», «www.mibar.es/carta», «http://…». */
export function normalizarUrl(entrada: string): URL {
  let s = entrada.trim()
  if (!s) throw new ErrorRed('url', 'Escribe la dirección de una web.')
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '')
  let u: URL
  try {
    u = new URL(s)
  } catch {
    throw new ErrorRed('url', 'Esa dirección no parece una web válida.')
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new ErrorRed('url', 'Solo se pueden analizar webs (http o https).')
  if (u.username || u.password) throw new ErrorRed('url', 'La dirección no puede llevar usuario ni contraseña.')
  if (u.port && !['80', '443'].includes(u.port)) throw new ErrorRed('url', 'Solo se analizan webs en los puertos normales.')
  if (!u.hostname.includes('.') || /\.(local|internal|lan|home|corp)$/i.test(u.hostname) || /^localhost$/i.test(u.hostname)) throw new ErrorRed('url', 'Esa dirección no es una web pública.')
  u.hash = ''
  return u
}

/** ¿Es una IP de uso interno (privada, local, enlace local, reservada…)? */
export function ipPrivada(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number]
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  }
  const v = ip.toLowerCase()
  if (v === '::' || v === '::1') return true
  if (v.startsWith('::ffff:')) return ipPrivada(v.slice(7))
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v)
}

async function comprobarHost(host: string) {
  if (isIP(host)) {
    if (ipPrivada(host)) throw new ErrorRed('privada', 'Esa dirección es de una red interna.')
    return
  }
  let ips: { address: string }[]
  try {
    ips = await lookup(host, { all: true })
  } catch {
    throw new ErrorRed('dns', `No existe ningún dominio «${host}». Revisa que esté bien escrito.`)
  }
  if (!ips.length || ips.some((i) => ipPrivada(i.address))) throw new ErrorRed('privada', 'Esa dirección apunta a una red interna.')
}

export interface Descarga {
  url: string
  /** Cada salto: URL y código (301, 302…). */
  cadena: { url: string; estado: number }[]
  estado: number
  cabeceras: Record<string, string>
  cuerpo: string
  bytes: number
  ttfbMs: number
  totalMs: number
  /** Se cortó al llegar a maxBytes (con truncar: true). */
  truncado?: boolean
}

export interface OpcionesDescarga {
  metodo?: 'GET' | 'HEAD'
  maxBytes?: number
  tiempoMs?: number
  maxSaltos?: number
  /** Si se pasa de maxBytes, devuelve lo descargado en vez de fallar. */
  truncar?: boolean
  f?: typeof fetch
  resolver?: (host: string) => Promise<void>
}

/** Descarga siguiendo redirecciones a mano (para validar cada salto). */
export async function descargar(entrada: URL | string, o: OpcionesDescarga = {}): Promise<Descarga> {
  const f = o.f ?? fetch
  const resolver = o.resolver ?? comprobarHost
  const maxBytes = o.maxBytes ?? 3_000_000
  let url = typeof entrada === 'string' ? new URL(entrada) : entrada
  const cadena: Descarga['cadena'] = []
  const inicio = performance.now()
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), o.tiempoMs ?? 12_000)
  try {
    for (let salto = 0; ; salto++) {
      await resolver(url.hostname)
      let res: Response
      try {
        res = await f(url, { method: o.metodo ?? 'GET', redirect: 'manual', signal: control.signal, headers: { 'user-agent': AGENTE, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'accept-language': 'es-ES,es;q=0.9', 'accept-encoding': 'br, gzip' } })
      } catch (err) {
        if (control.signal.aborted) throw new ErrorRed('tiempo', 'La web tarda demasiado en responder.')
        throw new ErrorRed('conexion', `No se pudo conectar con ${url.hostname}.${err instanceof Error && /certificate|cert|SSL|TLS/i.test(String((err as Error & { cause?: unknown }).cause ?? err.message)) ? ' Su certificado de seguridad no es válido.' : ''}`)
      }
      const ttfb = performance.now() - inicio
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        cadena.push({ url: url.href, estado: res.status })
        if (salto >= (o.maxSaltos ?? 6)) throw new ErrorRed('redirecciones', 'La web redirige demasiadas veces.')
        url = new URL(res.headers.get('location')!, url)
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ErrorRed('url', 'La web redirige a algo que no es una página.')
        void res.body?.cancel()
        continue
      }
      const cabeceras: Record<string, string> = {}
      res.headers.forEach((v, k) => (cabeceras[k] = v))
      let cuerpo = ''
      let bytes = 0
      if (o.metodo !== 'HEAD' && res.body) {
        const lector = res.body.getReader()
        const dec = new TextDecoder()
        for (;;) {
          const { done, value } = await lector.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > maxBytes) {
            void lector.cancel()
            if (!o.truncar) throw new ErrorRed('grande', 'La página es demasiado grande para analizarla.')
            cuerpo += dec.decode(value, { stream: true }) + dec.decode()
            return { url: url.href, cadena, estado: res.status, cabeceras, cuerpo, bytes, ttfbMs: Math.round(ttfb), totalMs: Math.round(performance.now() - inicio), truncado: true }
          }
          cuerpo += dec.decode(value, { stream: true })
        }
        cuerpo += dec.decode()
      } else bytes = Number(cabeceras['content-length'] ?? 0)
      return { url: url.href, cadena, estado: res.status, cabeceras, cuerpo, bytes, ttfbMs: Math.round(ttfb), totalMs: Math.round(performance.now() - inicio) }
    }
  } finally {
    clearTimeout(reloj)
  }
}

/** Solo el primer salto: ¿a dónde redirige esta URL? (para comprobar http → https) */
export async function primerSalto(url: string, f: typeof fetch = fetch, resolver: (h: string) => Promise<void> = comprobarHost): Promise<{ estado: number; destino: string | null }> {
  const u = new URL(url)
  await resolver(u.hostname)
  const res = await f(u, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(5000), headers: { 'user-agent': AGENTE } })
  const loc = res.headers.get('location')
  return { estado: res.status, destino: loc ? new URL(loc, u).href : null }
}

/** ¿robots.txt prohíbe toda la web a cualquier buscador? */
export function robotsBloqueaTodo(txt: string): boolean {
  let agentes: string[] = []
  let enReglas = false
  for (const bruta of txt.split(/\r?\n/)) {
    const linea = bruta.replace(/#.*/, '').trim()
    const m = linea.match(/^([a-z-]+)\s*:\s*(.*)$/i)
    if (!m) continue
    const [, campo, valor] = m as unknown as [string, string, string]
    if (/^user-agent$/i.test(campo)) {
      if (enReglas) agentes = []
      enReglas = false
      agentes.push(valor.trim())
    } else {
      enReglas = true
      if (/^disallow$/i.test(campo) && valor.trim() === '/' && agentes.some((a) => a === '*' || /googlebot/i.test(a))) return true
    }
  }
  return false
}

/** Peso de un recurso (imagen, script…) sin descargarlo entero cuando se puede. */
export async function pesoRecurso(url: string, f: typeof fetch = fetch, resolver?: (h: string) => Promise<void>): Promise<{ bytes: number | null; tipo: string | null; estado: number }> {
  try {
    const d = await descargar(url, { metodo: 'HEAD', tiempoMs: 6000, f, resolver })
    const bytes = Number(d.cabeceras['content-length'] ?? NaN)
    return { bytes: Number.isFinite(bytes) ? bytes : null, tipo: d.cabeceras['content-type'] ?? null, estado: d.estado }
  } catch {
    return { bytes: null, tipo: null, estado: 0 }
  }
}

/** Días que le quedan al certificado HTTPS. */
export function diasCertificado(host: string, tiempoMs = 5000): Promise<number | null> {
  return new Promise((ok) => {
    const s = connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: tiempoMs }, () => {
      const c = s.getPeerCertificate()
      s.end()
      ok(c?.valid_to ? Math.floor((new Date(c.valid_to).getTime() - Date.now()) / 86_400_000) : null)
    })
    s.on('error', () => ok(null))
    s.on('timeout', () => {
      s.destroy()
      ok(null)
    })
  })
}

/** Reparte trabajos con un máximo de N a la vez. */
export async function enParalelo<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = Array.from({ length: items.length })
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++
        out[k] = await fn(items[k]!)
      }
    }),
  )
  return out
}
