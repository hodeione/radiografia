import { extraer } from './extraer.js'
import { ErrorRed, descargar, diasCertificado, enParalelo, normalizarUrl, pesoRecurso, primerSalto, robotsBloqueaTodo, type Descarga } from './red.js'
import type { Informe } from './informe.js'
import { evaluar, notas, prioridades, type Red } from './reglas.js'
import { propuestaReglas } from './textos.js'

export type { Informe }

/** Radiografía completa de una web: lo que devuelve /api/analizar. */


export type Paso = 'descarga' | 'contenido' | 'recursos' | 'seguridad' | 'informe'

export interface Dependencias {
  f?: typeof fetch
  resolver?: (host: string) => Promise<void>
  certificado?: (host: string) => Promise<number | null>
  alPaso?: (p: Paso, texto: string) => void
  anio?: number
}

async function intentar<T>(p: Promise<T>, def: T): Promise<T> {
  try {
    return await p
  } catch {
    return def
  }
}

export async function analizar(entrada: string, dep: Dependencias = {}): Promise<Informe> {
  const t0 = Date.now()
  const paso = dep.alPaso ?? (() => {})
  const opc = { f: dep.f, resolver: dep.resolver }
  const url = normalizarUrl(entrada)

  paso('descarga', `Visitando ${url.hostname} como lo haría un móvil…`)
  let pagina: Descarga
  try {
    pagina = await descargar(url, { ...opc, maxBytes: 4_000_000, truncar: true })
  } catch (err) {
    // Sin https puede que solo funcione http (o al revés): se prueba la otra.
    if (err instanceof ErrorRed && (err.codigo === 'conexion' || err.codigo === 'tiempo') && url.protocol === 'https:' && !/^https:/i.test(entrada.trim())) {
      url.protocol = 'http:'
      pagina = await descargar(url, { ...opc, maxBytes: 4_000_000, truncar: true })
    } else throw err
  }
  if (pagina.estado >= 400) throw new ErrorRed('estado', `La web responde con un error ${pagina.estado}.`)
  const tipo = pagina.cabeceras['content-type'] ?? ''
  if (tipo && !/html/i.test(tipo)) throw new ErrorRed('no_html', 'Esa dirección no es una página web (no devuelve HTML).')

  const final = new URL(pagina.url)
  paso('contenido', 'Leyendo textos, contacto, datos para Google y avisos legales…')
  const d = extraer(pagina.cuerpo, pagina.url)

  paso('recursos', `Pesando ${Math.min(d.imagenes.length, 16)} imágenes y comprobando enlaces…`)
  const origen = `${final.protocol}//${final.host}`
  const imagenesUnicas = [...new Set(d.imagenes.map((i) => i.src).filter((s) => /^https?:/.test(s)))].slice(0, 16)
  const internos = d.enlacesInternos.filter((u) => u !== pagina.url && u !== pagina.url.replace(/\/$/, '')).slice(0, 8)

  const [imagenes, rotos, robots, sitemap, redirigeHttps, certDias] = await Promise.all([
    enParalelo(imagenesUnicas, 8, async (u) => ({ url: u, ...(await pesoRecurso(u, opc.f, opc.resolver)) })),
    enParalelo(internos, 6, async (u) => ((await pesoRecurso(u, opc.f, opc.resolver)).estado >= 400 ? u : null)),
    intentar(descargar(`${origen}/robots.txt`, { ...opc, maxBytes: 200_000, tiempoMs: 5000 }), null),
    intentar(descargar(`${origen}/sitemap.xml`, { ...opc, maxBytes: 2_000_000, tiempoMs: 5000 }), null),
    final.protocol === 'https:'
      ? intentar(
          primerSalto(`http://${final.host}${final.pathname}`, opc.f, opc.resolver).then((x) => (x.estado >= 300 && x.estado < 400 ? Boolean(x.destino?.startsWith('https:')) : x.estado < 400 ? false : null)),
          null,
        )
      : Promise.resolve(null),
    final.protocol === 'https:' ? intentar((dep.certificado ?? diasCertificado)(final.hostname), null) : Promise.resolve(null),
  ])
  paso('seguridad', 'Revisando seguridad, cookies y aspectos legales…')

  const robotsTxt = robots && robots.estado < 400 ? robots.cuerpo : ''
  const bloqueaTodo = robotsBloqueaTodo(robotsTxt)
  const tieneSitemap = Boolean((sitemap && sitemap.estado < 400 && /<(urlset|sitemapindex)/i.test(sitemap.cuerpo)) || /^sitemap:/im.test(robotsTxt))

  const red: Red = {
    urlFinal: pagina.url,
    https: final.protocol === 'https:',
    redirigeHttps,
    saltos: pagina.cadena.length,
    ttfbMs: pagina.ttfbMs,
    bytesHtml: pagina.bytes,
    truncado: Boolean(pagina.truncado),
    compresion: pagina.cabeceras['content-encoding'] ?? null,
    certDias,
    robots: { existe: Boolean(robotsTxt), bloqueaTodo },
    sitemap: tieneSitemap,
    imagenes: imagenes.map((i) => ({ url: i.url, bytes: i.bytes, tipo: i.tipo })),
    rotos: rotos.filter((x): x is string => Boolean(x)),
  }

  paso('informe', 'Calculando la nota y preparando propuestas…')
  const hallazgos = evaluar(d, red, dep.anio)
  const n = notas(hallazgos)
  const propuesta = propuestaReglas(d)
  return {
    url: url.href,
    urlFinal: pagina.url,
    dominio: final.hostname.replace(/^www\./, ''),
    fecha: new Date().toISOString(),
    nombre: d.nombre,
    ciudad: d.ciudad,
    cms: d.cms,
    spa: d.spa,
    nota: n.global,
    categorias: n.categorias,
    hallazgos,
    prioridades: prioridades(hallazgos),
    propuesta,
    marca: { logo: d.iconoApple || d.favicon || `${origen}/favicon.ico`, imagen: d.og.imagen, colores: [...new Set([d.colorTema, ...d.colores].filter((c) => /^#[0-9a-f]{6}$/i.test(c)))].slice(0, 4) },
    resumen: {
      ttfbMs: pagina.ttfbMs,
      pesoImagenes: red.imagenes.reduce((s, i) => s + (i.bytes ?? 0), 0),
      imagenes: d.imagenes.length,
      scripts: d.scripts.length,
      rastreadores: d.rastreadores,
      palabras: d.palabras,
      telefono: d.telefonos[0] ?? d.esquemas.find((e) => e.telefono)?.telefono ?? null,
      whatsapp: d.whatsapp,
      redes: d.redes,
    },
    textos: { titulo: d.titulo, descripcion: d.descripcion, h1: d.h1, llamadasAccion: d.llamadasAccion, texto: d.texto.slice(0, 2500), nombre: d.nombre, ciudad: d.ciudad, telefonos: d.telefonos },
    duracionMs: Date.now() - t0,
  }
}
