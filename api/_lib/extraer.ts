import { parse, type HTMLElement } from 'node-html-parser'

/**
 * Lee el HTML de una página y saca los datos que importan a un negocio
 * local: textos y etiquetas para Google, formas de contacto, datos legales,
 * imágenes, scripts, rastreadores, colores… Sin ejecutar JavaScript: lo
 * mismo que ve Google en la primera pasada.
 */

export interface Imagen {
  src: string
  alt: string | null
  lazy: boolean
  dimensiones: boolean
  srcset: boolean
}

export interface Script {
  src: string | null
  enHead: boolean
  bloquea: boolean
  terceros: boolean
}

export interface Esquema {
  tipo: string
  nombre?: string
  telefono?: string
  ciudad?: string
  direccion?: string
}

export interface Datos {
  titulo: string
  descripcion: string
  h1: string[]
  h2: number
  lang: string
  viewport: string
  canonical: string
  noindex: boolean
  og: { titulo: string; descripcion: string; imagen: string; sitio: string }
  favicon: string
  iconoApple: string
  colorTema: string
  esquemas: Esquema[]
  telefonos: string[]
  enlacesTel: number
  emails: string[]
  whatsapp: boolean
  mapa: boolean
  redes: string[]
  formularios: number
  reservas: string[]
  llamadasAccion: string[]
  legal: { avisoLegal: boolean; privacidad: boolean; cookies: boolean }
  gestorCookies: string | null
  rastreadores: string[]
  copyright: number | null
  imagenes: Imagen[]
  scripts: Script[]
  hojasEstilo: string[]
  fuentesExternas: boolean
  palabras: number
  texto: string
  /** Recursos http:// en una página https. */
  mixto: string[]
  enlacesInternos: string[]
  colores: string[]
  cms: string | null
  nombre: string
  ciudad: string
  botonesSinTexto: number
  camposSinEtiqueta: number
  /** La página se construye con JavaScript: el HTML inicial casi no tiene contenido. */
  spa: boolean
}

const CTA = /\b(reserv|pide|pedir|llama|llámanos|contact|cita|presupuesto|comprar|compra|encarga|escríbenos|whatsapp|ven a vernos|cómo llegar|book|order)/i
const RESERVAS = /thefork|eltenedor|covermanager|resy|opentable|booksy|treatwell|calendly|doctoralia|reservas?|book(ing)?|cita/i
const REDES: [RegExp, string][] = [
  [/instagram\.com/i, 'Instagram'],
  [/facebook\.com|fb\.com/i, 'Facebook'],
  [/tiktok\.com/i, 'TikTok'],
  [/(twitter|x)\.com\//i, 'X'],
  [/linkedin\.com/i, 'LinkedIn'],
  [/youtube\.com|youtu\.be/i, 'YouTube'],
  [/tripadvisor\./i, 'Tripadvisor'],
]
const RASTREADORES: [RegExp, string][] = [
  [/googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/, 'Google Tag Manager'],
  [/google-analytics\.com|gtag\/js\?id=G-|['"]G-[A-Z0-9]{6,}['"]/, 'Google Analytics'],
  [/connect\.facebook\.net|fbq\(/, 'Píxel de Meta'],
  [/static\.hotjar\.com|hotjar/i, 'Hotjar'],
  [/clarity\.ms/, 'Microsoft Clarity'],
  [/tiktok\.com\/i18n\/pixel|ttq\.load/, 'Píxel de TikTok'],
  [/googleadservices|AW-\d{6,}/, 'Google Ads'],
]
const GESTORES_COOKIES: [RegExp, string][] = [
  [/cookiebot/i, 'Cookiebot'],
  [/cookieyes|cookie-law-info/i, 'CookieYes'],
  [/complianz|cmplz/i, 'Complianz'],
  [/onetrust|optanon/i, 'OneTrust'],
  [/iubenda/i, 'iubenda'],
  [/cookie-notice|cn-notice/i, 'Cookie Notice'],
  [/didomi/i, 'Didomi'],
  [/usercentrics/i, 'Usercentrics'],
  [/borlabs/i, 'Borlabs'],
  [/klaro/i, 'Klaro'],
  [/tarteaucitron/i, 'tarteaucitron'],
  [/cookieconsent|cookie-consent|cc-window|consent-banner|cookie-banner|aviso-cookies|banner-cookies/i, 'Banner propio'],
]
const CMS: [RegExp, string][] = [
  // Solo marcas técnicas (rutas de recursos o la meta generator), nunca palabras del texto.
  [/\/wp-content\/|\/wp-includes\/|<meta[^>]+generator[^>]+WordPress/i, 'WordPress'],
  [/static\.wixstatic\.com|<meta[^>]+generator[^>]+Wix/i, 'Wix'],
  [/cdn\.shopify\.com|Shopify\.theme/, 'Shopify'],
  [/static1\.squarespace\.com|<meta[^>]+generator[^>]+Squarespace/i, 'Squarespace'],
  [/data-wf-page|<meta[^>]+generator[^>]+Webflow/i, 'Webflow'],
  [/jimdosite|jimdocdn|<meta[^>]+generator[^>]+Jimdo/i, 'Jimdo'],
  [/<meta[^>]+generator[^>]+Joomla|\/media\/jui\//i, 'Joomla'],
  [/<meta[^>]+generator[^>]+PrestaShop|var prestashop\s*=/i, 'PrestaShop'],
  [/\/_next\/static\//, 'Next.js'],
  [/img1\.wsimg\.com/, 'GoDaddy'],
  [/zyrosite\.com/, 'Hostinger'],
]

/** Teléfonos españoles escritos en el texto: 944 12 34 56, 600123123, +34 600 12 31 23… */
export const TELEFONO = /(?:\+34[\s.-]?)?(?<!\d)[6789]\d{2}[\s.-]?\d{2,3}[\s.-]?\d{2}[\s.-]?\d{2,3}(?!\d)/g

function texto(e: HTMLElement | null | undefined) {
  return (e?.text ?? '').replace(/\s+/g, ' ').trim()
}

function meta(raiz: HTMLElement, nombre: string) {
  const e = raiz.querySelector(`meta[name="${nombre}"]`) ?? raiz.querySelector(`meta[property="${nombre}"]`) ?? raiz.querySelector(`meta[name="${nombre.toLowerCase()}"]`)
  return (e?.getAttribute('content') ?? '').trim()
}

function absoluta(href: string | undefined, base: URL): string {
  if (!href) return ''
  try {
    return new URL(href, base).href
  } catch {
    return ''
  }
}

function esquemas(raiz: HTMLElement): Esquema[] {
  const out: Esquema[] = []
  const visitar = (n: unknown) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(visitar)
    const o = n as Record<string, unknown>
    if (Array.isArray(o['@graph'])) (o['@graph'] as unknown[]).forEach(visitar)
    const tipo = Array.isArray(o['@type']) ? String(o['@type'][0]) : typeof o['@type'] === 'string' ? o['@type'] : ''
    if (tipo) {
      const dir = (o.address ?? {}) as Record<string, unknown>
      out.push({
        tipo,
        nombre: typeof o.name === 'string' ? o.name : undefined,
        telefono: typeof o.telephone === 'string' ? o.telephone : undefined,
        ciudad: typeof dir.addressLocality === 'string' ? dir.addressLocality : undefined,
        direccion: typeof dir.streetAddress === 'string' ? dir.streetAddress : undefined,
      })
    }
  }
  for (const s of raiz.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visitar(JSON.parse(s.text))
    } catch {
      /* JSON-LD roto: se cuenta como ausente */
    }
  }
  return out
}

/** Colores de marca más repetidos en el CSS en línea y en <style>. */
function colores(html: string): string[] {
  const cuenta = new Map<string, number>()
  // Fuera las paletas predefinidas de WordPress y los estilos globales de sus bloques: no son de la marca.
  const limpio = html.replace(/--wp--preset--[^;}]*[;}]/g, '').replace(/<style[^>]*id=["'](global-styles|wp-block)[^>]*>[\s\S]*?<\/style>/gi, '')
  for (const m of limpio.matchAll(/(?<![&\w])#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let h = m[1]!.toLowerCase()
    if (h.length === 3) h = [...h].map((c) => c + c).join('')
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    // Se ignoran blancos, negros y grises: no dicen nada de la marca.
    if (max - min < 40 || max < 40 || min > 225) continue
    cuenta.set(h, (cuenta.get(h) ?? 0) + 1)
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([h]) => '#' + h)
}

export function extraer(html: string, urlPagina: string): Datos {
  const base = new URL(urlPagina)
  const raiz = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: true } })
  const head = raiz.querySelector('head')
  const cuerpo = raiz.querySelector('body') ?? raiz

  // Texto visible: sin scripts, estilos ni menús ocultos.
  const copia = parse(cuerpo.toString(), { comment: false })
  copia.querySelectorAll('script,style,noscript,svg,template').forEach((n) => n.remove())
  const visible = texto(copia)
  const palabras = visible ? visible.split(' ').length : 0

  const enlaces = raiz.querySelectorAll('a[href]')
  const hrefs = enlaces.map((a) => a.getAttribute('href') ?? '')
  const enlacesTexto = enlaces.map((a) => ({ href: a.getAttribute('href') ?? '', texto: texto(a) }))
  const todoHref = hrefs.join(' ')

  const decodificar = (h: string) => {
    try {
      return decodeURIComponent(h)
    } catch {
      return h
    }
  }
  // Solo enlaces cortos: un enlace que envuelve una tarjeta entera no es «el enlace a la política de privacidad».
  const legal = (re: RegExp) => enlacesTexto.some((a) => a.texto.length <= 60 && (re.test(a.texto) || re.test(decodificar(a.href).replace(/[-_/]/g, ' '))))

  const imagenes: Imagen[] = raiz.querySelectorAll('img').map((i) => ({
    src: absoluta(i.getAttribute('src') ?? i.getAttribute('data-src'), base),
    alt: i.hasAttribute('alt') ? (i.getAttribute('alt') ?? '').trim() : null,
    lazy: i.getAttribute('loading') === 'lazy' || i.hasAttribute('data-src') || /lazy/.test(i.getAttribute('class') ?? ''),
    dimensiones: i.hasAttribute('width') && i.hasAttribute('height'),
    srcset: i.hasAttribute('srcset') || i.parentNode?.rawTagName === 'picture',
  }))

  const scripts: Script[] = raiz.querySelectorAll('script').filter((s) => !/json|template|text\/x-/.test(s.getAttribute('type') ?? '')).map((s) => {
    const src = s.getAttribute('src') ? absoluta(s.getAttribute('src'), base) : null
    const enHead = Boolean(head && s.closest('head'))
    return {
      src,
      enHead,
      bloquea: Boolean(src) && enHead && !s.hasAttribute('async') && !s.hasAttribute('defer') && s.getAttribute('type') !== 'module',
      terceros: Boolean(src) && new URL(src!).hostname !== base.hostname,
    }
  })

  const hojasEstilo = raiz.querySelectorAll('link[rel~="stylesheet"]').map((l) => absoluta(l.getAttribute('href'), base)).filter(Boolean)

  const telefonosTexto = [...new Set((visible.match(TELEFONO) ?? []).map((t) => t.replace(/[\s.-]/g, '')))].slice(0, 5)
  const esq = esquemas(raiz)
  const negocio = esq.find((e) => /LocalBusiness|Restaurant|Store|Organization|Dentist|Physician|Hotel|Bar|Cafe|Salon|Shop|Medical|Clinic|Lodging|Food|Beauty|Hair|AutoRepair|Legal|Accounting|Real/i.test(e.tipo))

  const titulo = texto(raiz.querySelector('title'))
  const og = { titulo: meta(raiz, 'og:title'), descripcion: meta(raiz, 'og:description'), imagen: absoluta(meta(raiz, 'og:image'), base), sitio: meta(raiz, 'og:site_name') }
  const nombre = (negocio?.nombre || og.sitio || titulo.split(/\s[|–—·:-]\s|\s\|\s/)[0] || base.hostname.replace(/^www\./, '').split('.')[0] || '').trim().slice(0, 60)

  // Ciudad: del JSON-LD o de un código postal seguido del nombre («48005 Bilbao»).
  const cp = visible.match(/\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñü]+(?:[\s-](?:de\s|del\s|la\s)?[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+)?)/)
  const ciudad = negocio?.ciudad || esq.find((e) => e.ciudad)?.ciudad || cp?.[1] || ''

  const anio = [...visible.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1])).filter((n) => n > 1995 && n < 2100)

  const botones = raiz.querySelectorAll('button, a[role="button"]')
  const campos = raiz.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select')
  const etiquetas = new Set(raiz.querySelectorAll('label[for]').map((l) => l.getAttribute('for')))

  return {
    titulo,
    descripcion: meta(raiz, 'description'),
    h1: raiz.querySelectorAll('h1').map(texto).filter(Boolean),
    h2: raiz.querySelectorAll('h2').length,
    lang: (raiz.querySelector('html')?.getAttribute('lang') ?? '').trim(),
    viewport: meta(raiz, 'viewport'),
    canonical: absoluta(raiz.querySelector('link[rel="canonical"]')?.getAttribute('href'), base),
    noindex: /noindex/i.test(meta(raiz, 'robots')),
    og,
    favicon: absoluta(raiz.querySelector('link[rel~="icon"]')?.getAttribute('href') ?? raiz.querySelector('link[rel="shortcut icon"]')?.getAttribute('href'), base),
    iconoApple: absoluta(raiz.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'), base),
    colorTema: meta(raiz, 'theme-color'),
    esquemas: esq,
    telefonos: telefonosTexto,
    enlacesTel: hrefs.filter((h) => /^tel:/i.test(h)).length,
    emails: [...new Set(hrefs.filter((h) => /^mailto:/i.test(h)).map((h) => h.slice(7).split('?')[0]!))],
    whatsapp: /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/|web\.whatsapp\.com/i.test(todoHref),
    mapa: /google\.[a-z.]+\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(todoHref + ' ' + raiz.querySelectorAll('iframe').map((i) => i.getAttribute('src') ?? '').join(' ')),
    redes: REDES.filter(([re]) => re.test(todoHref)).map(([, n]) => n),
    formularios: raiz.querySelectorAll('form').filter((f) => f.querySelectorAll('input:not([type="hidden"]), textarea').length >= 2).length,
    reservas: [...new Set(enlacesTexto.filter((a) => RESERVAS.test(a.href) || /reserv|pide cita|pedir cita/i.test(a.texto)).map((a) => a.texto || a.href))].slice(0, 5),
    llamadasAccion: [...new Set([...enlaces, ...botones].map(texto).filter((t) => t.length > 2 && t.length < 40 && CTA.test(t)))].slice(0, 8),
    legal: {
      avisoLegal: legal(/aviso legal|legal notice|nota legal|informaci[oó]n legal/i),
      privacidad: legal(/privacidad|privacy|protecci[oó]n de datos/i),
      cookies: legal(/cookies/i),
    },
    gestorCookies: GESTORES_COOKIES.find(([re]) => re.test(html))?.[1] ?? null,
    rastreadores: RASTREADORES.filter(([re]) => re.test(html)).map(([, n]) => n),
    copyright: anio.length ? Math.max(...anio) : null,
    imagenes,
    scripts,
    hojasEstilo,
    fuentesExternas: /fonts\.googleapis\.com|use\.typekit\.net|fonts\.bunny\.net/.test(html),
    palabras,
    texto: visible.slice(0, 4000),
    mixto: base.protocol === 'https:' ? [...imagenes.map((i) => i.src), ...scripts.map((s) => s.src ?? ''), ...hojasEstilo].filter((u) => u.startsWith('http://')).slice(0, 10) : [],
    enlacesInternos: [...new Set(hrefs.map((h) => absoluta(h, base)).filter((u) => u && new URL(u).hostname === base.hostname && !/\.(jpg|jpeg|png|gif|webp|pdf|zip|svg)$/i.test(u)).map((u) => u.split('#')[0]!))].slice(0, 60),
    colores: colores(html),
    cms: CMS.find(([re]) => re.test(html))?.[1] ?? null,
    nombre,
    ciudad,
    botonesSinTexto: botones.filter((b) => !texto(b) && !b.getAttribute('aria-label') && !b.getAttribute('title')).length,
    spa: palabras < 40 && (/<div[^>]+id=["'](root|app|__next|__nuxt|svelte)["'][^>]*>\s*<\/div>/i.test(html) || scripts.some((x) => x.src && /\.(m?js)(\?|$)/.test(x.src)) && raiz.querySelectorAll('script[type="module"]').length > 0),
    camposSinEtiqueta: campos.filter((c) => !c.getAttribute('aria-label') && !c.getAttribute('placeholder') && !(c.id && etiquetas.has(c.id)) && !c.closest('label')).length,
  }
}
