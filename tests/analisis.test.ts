import { describe, expect, it } from 'vitest'
import { analizar } from '../api/_lib/analizar'
import { extraer } from '../api/_lib/extraer'
import { ErrorRed, descargar, ipPrivada, normalizarUrl, robotsBloqueaTodo } from '../api/_lib/red'
import { evaluar, formatearTel, notas, prioridades, type Red } from '../api/_lib/reglas'
import { detectarTipo, propuestaReglas } from '../api/_lib/textos'
import { BUENA, MALA, SPA } from './fixtures'

const RED_OK: Red = { urlFinal: 'https://taberna.example/', https: true, redirigeHttps: true, saltos: 0, ttfbMs: 250, bytesHtml: 30_000, compresion: 'br', certDias: 80, robots: { existe: true, bloqueaTodo: false }, sitemap: true, imagenes: [{ url: 'a.webp', bytes: 90_000, tipo: 'image/webp' }], rotos: [] }
const estado = (h: ReturnType<typeof evaluar>, id: string) => h.find((x) => x.id === id)?.estado

describe('direcciones y red', () => {
  it('normaliza lo que escribe la gente', () => {
    expect(normalizarUrl('mibar.es').href).toBe('https://mibar.es/')
    expect(normalizarUrl(' www.mibar.es/carta#arriba ').href).toBe('https://www.mibar.es/carta')
    expect(normalizarUrl('http://mibar.es').protocol).toBe('http:')
  })
  it('rechaza lo que no es una web pública', () => {
    for (const u of ['', 'localhost', 'ftp://x.es', 'https://user:pw@x.es', 'https://x.es:8080', 'intranet.local', 'servidor']) expect(() => normalizarUrl(u)).toThrow(ErrorRed)
  })
  it('detecta IPs internas', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1', '0.0.0.0']) expect(ipPrivada(ip)).toBe(true)
    for (const ip of ['8.8.8.8', '76.76.21.21', '2606:4700::1111']) expect(ipPrivada(ip)).toBe(false)
  })
  it('no sigue redirecciones hacia la red interna', async () => {
    const f = (async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } })) as unknown as typeof fetch
    const resolver = async (h: string) => {
      if (ipPrivada(h)) throw new ErrorRed('privada', 'interna')
    }
    await expect(descargar('https://bueno.example/', { f, resolver })).rejects.toMatchObject({ codigo: 'privada' })
  })
  it('lee robots.txt por grupos', () => {
    expect(robotsBloqueaTodo('User-agent: *\nDisallow: /')).toBe(true)
    expect(robotsBloqueaTodo('User-agent: *\nDisallow: /wp-admin/\nAllow: /')).toBe(false)
    expect(robotsBloqueaTodo('User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow:')).toBe(false)
    expect(robotsBloqueaTodo('User-agent: Googlebot\nUser-agent: Bingbot\nDisallow: / # todo')).toBe(true)
  })
})

describe('extracción', () => {
  const d = extraer(BUENA, 'https://taberna.example/')
  it('textos y etiquetas para Google', () => {
    expect(d.titulo).toBe('Restaurante en Bilbao | Taberna del Puerto')
    expect(d.h1).toEqual(['Restaurante de pescado en Bilbao'])
    expect(d.lang).toBe('es')
    expect(d.esquemas[0]).toMatchObject({ tipo: 'Restaurant', nombre: 'Taberna del Puerto', ciudad: 'Bilbao' })
    expect(d.palabras).toBeGreaterThan(200)
  })
  it('formas de contacto', () => {
    expect(d.telefonos).toContain('944123456')
    expect(d.enlacesTel).toBe(1)
    expect(d.whatsapp).toBe(true)
    expect(d.mapa).toBe(true)
    expect(d.redes).toEqual(['Instagram'])
    expect(d.reservas.length).toBeGreaterThan(0)
    expect(d.llamadasAccion).toEqual(expect.arrayContaining(['Reservar mesa', 'Cómo llegar']))
  })
  it('legal, cookies y rastreadores', () => {
    expect(d.legal).toEqual({ avisoLegal: true, privacidad: true, cookies: true })
    expect(d.gestorCookies).toBe('Cookiebot')
    expect(d.rastreadores).toContain('Google Analytics')
    expect(d.copyright).toBe(2026)
  })
  it('marca: nombre, ciudad, logo y colores', () => {
    expect(d.nombre).toBe('Taberna del Puerto')
    expect(d.ciudad).toBe('Bilbao')
    expect(d.iconoApple).toBe('https://taberna.example/apple-touch-icon.png')
    expect(d.colores[0]).toBe('#a3282d')
  })
  it('no confunde entidades HTML con colores ni texto con CMS', () => {
    const x = extraer('<html><body><a href="/?a=1&#038;b=2">x</a><p>Hacemos webs en WordPress y Wix</p></body></html>', 'https://a.example/')
    expect(x.colores).toEqual([])
    expect(x.cms).toBeNull()
    expect(extraer(MALA, 'https://taller.example/').cms).toBe('WordPress')
  })
  it('detecta webs hechas solo con JavaScript', () => {
    expect(extraer(SPA, 'https://tienda.example/').spa).toBe(true)
    expect(d.spa).toBe(false)
  })
})

describe('reglas y notas', () => {
  it('una web bien hecha saca buena nota', () => {
    const h = evaluar(extraer(BUENA, 'https://taberna.example/'), RED_OK, 2026)
    const n = notas(h)
    expect(h.filter((x) => x.estado === 'mal')).toEqual([])
    expect(n.global).toBeGreaterThanOrEqual(90)
  })

  it('una web descuidada suspende con los motivos correctos', () => {
    const red: Red = { ...RED_OK, https: true, ttfbMs: 2100, compresion: null, bytesHtml: 40_000, sitemap: false, certDias: 10, imagenes: [{ url: 'foto1.jpg', bytes: 2_400_000, tipo: 'image/jpeg' }, { url: 'foto2.jpg', bytes: 900_000, tipo: 'image/jpeg' }, { url: 'foto3.jpg', bytes: 400_000, tipo: 'image/jpeg' }], rotos: ['https://taller.example/servicios'] }
    const h = evaluar(extraer(MALA, 'https://taller.example/'), red, 2026)
    expect(estado(h, 'tel_clic')).toBe('mal')
    expect(estado(h, 'titulo')).toBe('mejorable')
    expect(estado(h, 'descripcion')).toBe('mal')
    expect(estado(h, 'h1')).toBe('mejorable')
    expect(estado(h, 'ttfb')).toBe('mal')
    expect(estado(h, 'imagenes')).toBe('mejorable')
    expect(estado(h, 'bloqueo')).toBe('mejorable')
    expect(estado(h, 'cookies')).toBe('mal')
    expect(estado(h, 'privacidad')).toBe('mal')
    expect(estado(h, 'aviso')).toBe('mal')
    expect(estado(h, 'actualizada')).toBe('mejorable')
    expect(estado(h, 'certificado')).toBe('mejorable')
    expect(estado(h, 'mixto')).toBe('mejorable')
    expect(estado(h, 'zoom')).toBe('mejorable')
    expect(estado(h, 'alt')).toBe('mal')
    expect(estado(h, 'botones')).toBe('mejorable')
    expect(estado(h, 'campos')).toBe('mejorable')
    expect(estado(h, 'rotos')).toBe('mejorable')
    expect(notas(h).global).toBeLessThan(55)
    // Lo más urgente: problemas graves de peso 3 primero
    const p = prioridades(h)
    expect(p).toHaveLength(3)
    expect(p.every((x) => x.estado === 'mal' && x.peso === 3)).toBe(true)
  })

  it('en webs de JavaScript no puntúa lo que no puede ver', () => {
    const h = evaluar(extraer(SPA, 'https://tienda.example/'), RED_OK, 2026)
    expect(h[0]!.id).toBe('spa')
    expect(h.some((x) => x.id === 'telefono')).toBe(false)
    expect(notas(h).categorias.find((c) => c.id === 'clientes')!.nota).toBeNull()
  })

  it('cada fallo explica el impacto y el arreglo', () => {
    const h = evaluar(extraer(MALA, 'https://taller.example/'), { ...RED_OK, https: false }, 2026)
    for (const x of h.filter((y) => y.estado !== 'bien')) {
      expect(x.impacto, x.id).toBeTruthy()
      expect(x.arreglo, x.id).toBeTruthy()
    }
  })
})

describe('propuestas de textos', () => {
  it('detecta el tipo de negocio y escribe para Google', () => {
    const p = propuestaReglas(extraer(BUENA, 'https://taberna.example/'))
    expect(p.tipo).toBe('Restaurante')
    expect(p.titulo).toBe('Taberna del Puerto · Restaurante en Bilbao')
    expect(p.descripcion.length).toBeLessThanOrEqual(158)
    expect(p.descripcion).toContain('944 12 34 56')
    expect(p.cta).toBe('Reserva tu mesa')
    expect(detectarTipo(extraer(MALA, 'https://taller.example/'))?.tipo).toBe('Taller mecánico')
  })
  it('no repite el tipo de negocio en el título', () => {
    const d = extraer(BUENA.replace('"name":"Taberna del Puerto"', '"name":"Lhardy Restaurante"'), 'https://lhardy.example/')
    expect(propuestaReglas(d).titulo).toBe('Lhardy · Restaurante en Bilbao')
  })
  it('formatea teléfonos', () => {
    expect(formatearTel('+34944123456')).toBe('944 12 34 56')
    expect(formatearTel('600111222')).toBe('600 11 12 22')
  })
})

describe('análisis completo con red simulada', () => {
  it('descarga, comprueba y puntúa', async () => {
    const pasos: string[] = []
    const f = (async (u: string | URL, init?: RequestInit) => {
      const url = new URL(String(u))
      if (url.protocol === 'http:') return new Response(null, { status: 301, headers: { location: 'https://taberna.example/' } })
      if (url.pathname === '/') return new Response(init?.method === 'HEAD' ? null : BUENA, { headers: { 'content-type': 'text/html; charset=utf-8', 'content-encoding': 'br' } })
      if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\nSitemap: https://taberna.example/sitemap.xml')
      if (url.pathname.endsWith('.webp')) return new Response(null, { headers: { 'content-length': '80000', 'content-type': 'image/webp' } })
      if (url.pathname === '/privacidad') return new Response(null, { status: 404 })
      return new Response('ok', { headers: { 'content-type': 'text/html' } })
    }) as unknown as typeof fetch
    const i = await analizar('taberna.example', { f, resolver: async () => {}, certificado: async () => 90, alPaso: (p) => pasos.push(p), anio: 2026 })
    expect(pasos).toEqual(['descarga', 'contenido', 'recursos', 'seguridad', 'informe'])
    expect(i.nombre).toBe('Taberna del Puerto')
    expect(i.hallazgos.find((h) => h.id === 'http')).toBeUndefined() // http redirige a https
    expect(i.hallazgos.find((h) => h.id === 'rotos')?.detalle).toContain('/privacidad')
    expect(i.marca.colores[0]).toBe('#a3282d')
    expect(i.nota).toBeGreaterThan(85)
  })

  it('errores comprensibles', async () => {
    const f = (async () => new Response('no', { status: 404, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch
    await expect(analizar('noexiste.example', { f, resolver: async () => {} })).rejects.toThrow('error 404')
    const pdf = (async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } })) as unknown as typeof fetch
    await expect(analizar('x.example/menu.pdf', { f: pdf, resolver: async () => {} })).rejects.toMatchObject({ codigo: 'no_html' })
  })
})
