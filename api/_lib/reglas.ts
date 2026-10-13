import type { Datos } from './extraer.js'

/**
 * Las comprobaciones. Cada una explica qué pasa, por qué le importa al
 * negocio (en clientes, no en jerga) y cómo se arregla. La nota de cada
 * categoría es la media ponderada de sus comprobaciones.
 */

export type Categoria = 'clientes' | 'google' | 'velocidad' | 'confianza' | 'movil' | 'accesibilidad'
export type Estado = 'bien' | 'mejorable' | 'mal'

export interface Hallazgo {
  id: string
  cat: Categoria
  estado: Estado
  titulo: string
  detalle: string
  /** Por qué importa, en términos de clientes. Solo si no está bien. */
  impacto?: string
  arreglo?: string
  /** 1 = detalle, 2 = importante, 3 = crítico. */
  peso: 1 | 2 | 3
}

export interface Red {
  urlFinal: string
  https: boolean
  /** ¿La versión http redirige a https? null si no se pudo comprobar. */
  redirigeHttps: boolean | null
  saltos: number
  ttfbMs: number
  bytesHtml: number
  /** El HTML era tan grande que solo se ha analizado el principio. */
  truncado?: boolean
  compresion: string | null
  certDias: number | null
  robots: { existe: boolean; bloqueaTodo: boolean }
  sitemap: boolean
  imagenes: { url: string; bytes: number | null; tipo: string | null }[]
  rotos: string[]
}

export const CATEGORIAS: { id: Categoria; nombre: string; peso: number; lema: string }[] = [
  { id: 'clientes', nombre: 'Captar clientes', peso: 25, lema: '¿Es fácil llamarte, escribirte o reservar?' },
  { id: 'google', nombre: 'Google y SEO local', peso: 20, lema: '¿Te encuentran los que buscan lo que haces en tu ciudad?' },
  { id: 'velocidad', nombre: 'Velocidad', peso: 20, lema: '¿Carga rápido en un móvil con datos?' },
  { id: 'confianza', nombre: 'Confianza y legal', peso: 15, lema: '¿Es segura y cumple la ley española?' },
  { id: 'movil', nombre: 'Móvil', peso: 10, lema: '¿Se ve bien en el teléfono?' },
  { id: 'accesibilidad', nombre: 'Accesibilidad', peso: 10, lema: '¿La puede usar todo el mundo?' },
]

const kb = (b: number) => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.round(b / 1000)} KB`)
const seg = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`

export function evaluar(d: Datos, r: Red, anioActual = new Date().getFullYear()): Hallazgo[] {
  const h: Hallazgo[] = []
  const add = (x: Hallazgo) => h.push(x)

  /* ---------------------------------------------------------- clientes */
  const hayTelefono = d.telefonos.length > 0 || d.esquemas.some((e) => e.telefono) || d.enlacesTel > 0
  add(
    hayTelefono
      ? { id: 'telefono', cat: 'clientes', estado: 'bien', peso: 3, titulo: 'El teléfono está a la vista', detalle: `Se ve ${d.telefonos[0] ? `el ${formatearTel(d.telefonos[0])}` : 'un teléfono de contacto'}.` }
      : { id: 'telefono', cat: 'clientes', estado: 'mal', peso: 3, titulo: 'No hay ningún teléfono a la vista', detalle: 'En la página principal no aparece ningún número.', impacto: 'Quien quiere llamarte en ese momento se va al siguiente resultado de Google.', arreglo: 'Pon el teléfono arriba del todo y en el pie de página.' },
  )
  if (hayTelefono)
    add(
      d.enlacesTel > 0
        ? { id: 'tel_clic', cat: 'clientes', estado: 'bien', peso: 3, titulo: 'Se puede llamar con un toque', detalle: 'El teléfono es un enlace «tel:»: en el móvil se pulsa y llama.' }
        : { id: 'tel_clic', cat: 'clientes', estado: 'mal', peso: 3, titulo: 'El teléfono no se puede pulsar', detalle: 'El número aparece como texto, sin enlace «tel:».', impacto: 'En el móvil hay que copiarlo a mano: muchos no se molestan.', arreglo: 'Convierte el número en un enlace tel: (por ejemplo, <a href="tel:+34944123456">).' },
    )
  add(
    d.whatsapp
      ? { id: 'whatsapp', cat: 'clientes', estado: 'bien', peso: 2, titulo: 'Tiene botón de WhatsApp', detalle: 'Se puede escribir por WhatsApp desde la web.' }
      : { id: 'whatsapp', cat: 'clientes', estado: 'mejorable', peso: 2, titulo: 'No se puede escribir por WhatsApp', detalle: 'No hay ningún enlace a WhatsApp.', impacto: 'Mucha gente prefiere escribir antes que llamar, sobre todo fuera de horario.', arreglo: 'Añade un botón flotante con un enlace wa.me y un mensaje ya escrito.' },
  )
  add(
    d.llamadasAccion.length > 0
      ? { id: 'cta', cat: 'clientes', estado: 'bien', peso: 3, titulo: 'Hay llamadas a la acción', detalle: `Botones como «${d.llamadasAccion.slice(0, 3).join('», «')}».` }
      : { id: 'cta', cat: 'clientes', estado: 'mal', peso: 3, titulo: 'No hay ningún botón que invite a actuar', detalle: 'No se ve ningún «Reservar», «Pide cita», «Llámanos» ni «Pide presupuesto».', impacto: 'La gente mira y se va: nadie le dice qué hacer a continuación.', arreglo: 'Pon un botón claro arriba del todo con la acción principal de tu negocio.' },
  )
  const contacto = d.reservas.length > 0 || d.formularios > 0 || d.emails.length > 0
  add(
    contacto
      ? { id: 'reserva', cat: 'clientes', estado: 'bien', peso: 2, titulo: d.reservas.length ? 'Se puede reservar o pedir cita' : 'Hay forma de escribir', detalle: d.reservas.length ? `Enlaces de reserva: ${d.reservas.slice(0, 2).join(', ')}.` : d.formularios ? 'Tiene formulario de contacto.' : `Email: ${d.emails[0]}.` }
      : { id: 'reserva', cat: 'clientes', estado: 'mejorable', peso: 2, titulo: 'No se puede reservar ni escribir desde la web', detalle: 'No hay formulario, email ni sistema de reservas.', impacto: 'Fuera de horario no hay forma de dejarte un encargo o una reserva.', arreglo: 'Añade reservas online o un formulario corto (nombre, teléfono y mensaje).' },
  )
  const ubicacion = d.mapa || Boolean(d.ciudad) || d.esquemas.some((e) => e.direccion)
  add(
    ubicacion
      ? { id: 'ubicacion', cat: 'clientes', estado: 'bien', peso: 2, titulo: 'Dice dónde está', detalle: d.mapa ? 'Tiene mapa o enlace a Google Maps.' : `Aparece la ubicación${d.ciudad ? ` (${d.ciudad})` : ''}.` }
      : { id: 'ubicacion', cat: 'clientes', estado: 'mejorable', peso: 2, titulo: 'No queda claro dónde estás', detalle: 'No hay dirección ni mapa.', impacto: 'Un negocio local sin dirección genera desconfianza y no sale en «cerca de mí».', arreglo: 'Pon la dirección completa y un enlace a tu ficha de Google Maps.' },
  )
  add(
    d.redes.length
      ? { id: 'redes', cat: 'clientes', estado: 'bien', peso: 1, titulo: 'Enlaza sus redes sociales', detalle: d.redes.join(', ') + '.' }
      : { id: 'redes', cat: 'clientes', estado: 'mejorable', peso: 1, titulo: 'No enlaza redes sociales', detalle: 'No hay enlaces a Instagram, Facebook ni otras redes.', impacto: 'Las redes son la prueba de que el negocio está vivo.', arreglo: 'Enlaza al menos la red donde más publicas.' },
  )

  /* ------------------------------------------------------------ google */
  if (d.noindex) add({ id: 'noindex', cat: 'google', estado: 'mal', peso: 3, titulo: 'La web le pide a Google que no la muestre', detalle: 'Tiene la etiqueta «noindex».', impacto: 'Google no la enseñará en sus resultados: es invisible.', arreglo: 'Quita «noindex» de la etiqueta meta robots (en WordPress: Ajustes → Lectura).' })
  if (r.robots.bloqueaTodo) add({ id: 'robots', cat: 'google', estado: 'mal', peso: 3, titulo: 'robots.txt bloquea a Google', detalle: 'El fichero robots.txt prohíbe rastrear toda la web.', impacto: 'Google no puede leer la web, así que no la posiciona.', arreglo: 'Quita la línea «Disallow: /» de robots.txt.' })
  const t = d.titulo
  add(
    !t
      ? { id: 'titulo', cat: 'google', estado: 'mal', peso: 3, titulo: 'La página no tiene título', detalle: 'Falta la etiqueta <title>.', impacto: 'Es lo primero que se lee en Google: sin él, nadie hace clic.', arreglo: 'Pon un título con tu servicio y tu ciudad, por ejemplo «Restaurante en Bilbao | Nombre».' }
      : t.length < 25 || t.length > 65
        ? { id: 'titulo', cat: 'google', estado: 'mejorable', peso: 3, titulo: t.length < 25 ? 'El título es demasiado corto' : 'El título es demasiado largo', detalle: `«${t}» (${t.length} caracteres; lo ideal es entre 30 y 60).`, impacto: t.length < 25 ? 'No dice qué haces ni dónde: Google no sabe para qué búsquedas mostrarte.' : 'Google lo corta y se pierde lo importante.', arreglo: 'Usa la propuesta de abajo: servicio + ciudad + nombre.' }
        : { id: 'titulo', cat: 'google', estado: 'bien', peso: 3, titulo: 'Buen título', detalle: `«${t}».` },
  )
  if (d.ciudad) {
    const menciona = [t, ...d.h1].some((x) => x.toLowerCase().includes(d.ciudad.toLowerCase()))
    add(
      menciona
        ? { id: 'ciudad', cat: 'google', estado: 'bien', peso: 2, titulo: `Nombra ${d.ciudad} donde importa`, detalle: 'La ciudad aparece en el título o en el titular principal.' }
        : { id: 'ciudad', cat: 'google', estado: 'mejorable', peso: 2, titulo: `No menciona ${d.ciudad} en el título ni en el titular`, detalle: 'La ciudad solo aparece en el texto o en la dirección.', impacto: `Las búsquedas locales («… en ${d.ciudad}») son las que traen clientes.`, arreglo: `Incluye «${d.ciudad}» en el título y en el titular principal.` },
    )
  }
  const desc = d.descripcion
  add(
    !desc
      ? { id: 'descripcion', cat: 'google', estado: 'mal', peso: 2, titulo: 'Sin descripción para Google', detalle: 'Falta la meta descripción.', impacto: 'Google se inventa el texto bajo tu enlace, y suele ser un trozo sin sentido.', arreglo: 'Escribe 1-2 frases (unos 150 caracteres) que vendan: qué haces, dónde y por qué elegirte.' }
      : desc.length < 70 || desc.length > 165
        ? { id: 'descripcion', cat: 'google', estado: 'mejorable', peso: 2, titulo: desc.length < 70 ? 'Descripción demasiado corta' : 'Descripción demasiado larga', detalle: `${desc.length} caracteres (lo ideal es 120-160).`, impacto: 'Es tu anuncio gratis en Google: aprovecha el espacio sin que lo corten.', arreglo: 'Usa la propuesta de abajo.' }
        : { id: 'descripcion', cat: 'google', estado: 'bien', peso: 2, titulo: 'Buena descripción para Google', detalle: `${desc.length} caracteres.` },
  )
  add(
    d.h1.length === 1
      ? { id: 'h1', cat: 'google', estado: 'bien', peso: 2, titulo: 'Un titular principal claro', detalle: `«${d.h1[0]!.slice(0, 90)}».` }
      : d.h1.length === 0
        ? { id: 'h1', cat: 'google', estado: 'mal', peso: 2, titulo: 'No hay titular principal (H1)', detalle: 'Falta la etiqueta H1.', impacto: 'Google no sabe cuál es el tema principal de la página.', arreglo: 'Pon un único H1 con lo que haces y dónde.' }
        : { id: 'h1', cat: 'google', estado: 'mejorable', peso: 1, titulo: `${d.h1.length} titulares principales (H1)`, detalle: 'Debería haber uno solo.', impacto: 'Diluye el tema principal de la página.', arreglo: 'Deja un H1 y pasa el resto a H2.' },
  )
  const negocio = d.esquemas.find((e) => /LocalBusiness|Restaurant|Store|Dentist|Physician|Hotel|Bar|Cafe|Salon|Shop|Medical|Clinic|Lodging|Food|Beauty|Hair|AutoRepair|Legal|Accounting|Real/i.test(e.tipo))
  add(
    negocio
      ? { id: 'esquema', cat: 'google', estado: 'bien', peso: 2, titulo: 'Ficha de negocio para Google (schema.org)', detalle: `Datos estructurados de tipo ${negocio.tipo}.` }
      : d.esquemas.length
        ? { id: 'esquema', cat: 'google', estado: 'mejorable', peso: 2, titulo: 'Datos estructurados sin ficha de negocio local', detalle: `Tiene schema.org (${d.esquemas[0]!.tipo}) pero no de negocio local.`, impacto: 'Google entiende peor tu horario, dirección y teléfono.', arreglo: 'Añade un bloque JSON-LD de tipo LocalBusiness (o Restaurant, Dentist…).' }
        : { id: 'esquema', cat: 'google', estado: 'mal', peso: 2, titulo: 'Sin ficha de negocio para Google (schema.org)', detalle: 'No hay datos estructurados.', impacto: 'Te pierdes los resultados enriquecidos: horario, estrellas y teléfono en Google.', arreglo: 'Añade un bloque JSON-LD LocalBusiness con nombre, dirección, teléfono y horario.' },
  )
  add(
    d.og.imagen && (d.og.titulo || d.titulo)
      ? { id: 'og', cat: 'google', estado: 'bien', peso: 1, titulo: 'Se ve bien al compartirla por WhatsApp', detalle: 'Tiene imagen y título para las vistas previas.' }
      : { id: 'og', cat: 'google', estado: 'mejorable', peso: 1, titulo: 'Sin vista previa al compartirla', detalle: 'Faltan las etiquetas Open Graph (og:image).', impacto: 'Cuando alguien envía tu web por WhatsApp sale un enlace soso, sin foto.', arreglo: 'Añade og:title, og:description y una og:image de 1200×630.' },
  )
  add(
    d.palabras >= 300
      ? { id: 'contenido', cat: 'google', estado: 'bien', peso: 2, titulo: 'Tiene texto suficiente', detalle: `Unas ${d.palabras} palabras.` }
      : { id: 'contenido', cat: 'google', estado: d.palabras < 120 ? 'mal' : 'mejorable', peso: 2, titulo: 'Muy poco texto', detalle: `Solo unas ${d.palabras} palabras legibles por Google.`, impacto: 'Sin texto, Google no tiene con qué posicionarte (el texto dentro de imágenes no cuenta).', arreglo: 'Explica tus servicios, tu zona y lo que te diferencia, en texto real.' },
  )
  add(r.sitemap ? { id: 'sitemap', cat: 'google', estado: 'bien', peso: 1, titulo: 'Tiene mapa del sitio', detalle: 'sitemap.xml disponible.' } : { id: 'sitemap', cat: 'google', estado: 'mejorable', peso: 1, titulo: 'Sin mapa del sitio', detalle: 'No hay sitemap.xml.', impacto: 'Google tarda más en descubrir tus páginas.', arreglo: 'Genera un sitemap.xml y envíalo en Google Search Console.' })
  add(/^es\b/i.test(d.lang) ? { id: 'lang', cat: 'google', estado: 'bien', peso: 1, titulo: 'Idioma declarado', detalle: `lang="${d.lang}".` } : { id: 'lang', cat: 'google', estado: 'mejorable', peso: 1, titulo: d.lang ? `Idioma declarado como «${d.lang}»` : 'Sin idioma declarado', detalle: 'La etiqueta html no indica que la web está en castellano.', impacto: 'Los lectores de pantalla y Google pueden equivocarse de idioma.', arreglo: 'Pon <html lang="es">.' })

  /* --------------------------------------------------------- velocidad */
  add(
    r.ttfbMs < 600
      ? { id: 'ttfb', cat: 'velocidad', estado: 'bien', peso: 3, titulo: 'El servidor responde rápido', detalle: `Primera respuesta en ${seg(r.ttfbMs)}.` }
      : { id: 'ttfb', cat: 'velocidad', estado: r.ttfbMs < 1500 ? 'mejorable' : 'mal', peso: 3, titulo: 'El servidor tarda en responder', detalle: `Tarda ${seg(r.ttfbMs)} solo en empezar a enviar la página.`, impacto: 'Cada segundo de espera en el móvil hace que se vaya más gente antes de verte.', arreglo: 'Activa caché de página, revisa los plugins o cambia a un alojamiento mejor.' },
  )
  const pesoImg = r.imagenes.reduce((s, i) => s + (i.bytes ?? 0), 0)
  const grandes = r.imagenes.filter((i) => (i.bytes ?? 0) > 300_000)
  add(
    pesoImg < 1_500_000 && !grandes.length
      ? { id: 'imagenes', cat: 'velocidad', estado: 'bien', peso: 3, titulo: 'Imágenes ligeras', detalle: `${r.imagenes.length} imágenes, ${kb(pesoImg)} en total.` }
      : { id: 'imagenes', cat: 'velocidad', estado: pesoImg < 4_000_000 ? 'mejorable' : 'mal', peso: 3, titulo: 'Imágenes demasiado pesadas', detalle: `${kb(pesoImg)} en imágenes${grandes.length ? `; ${grandes.length} pesan más de 300 KB (la mayor, ${kb(Math.max(...grandes.map((g) => g.bytes ?? 0)))})` : ''}.`, impacto: 'Es lo que más ralentiza una web en el móvil y gasta los datos de tus clientes.', arreglo: 'Reduce las fotos a 1600 px y pásalas a WebP o AVIF: suelen bajar un 80 %. Gratis en dht-fotos.vercel.app.' },
  )
  const modernas = r.imagenes.filter((i) => /webp|avif|svg/i.test((i.tipo ?? '') + i.url)).length
  if (r.imagenes.length >= 3)
    add(
      modernas / r.imagenes.length >= 0.5
        ? { id: 'formatos', cat: 'velocidad', estado: 'bien', peso: 1, titulo: 'Formatos de imagen modernos', detalle: `${modernas} de ${r.imagenes.length} imágenes en WebP, AVIF o SVG.` }
        : { id: 'formatos', cat: 'velocidad', estado: 'mejorable', peso: 1, titulo: 'Imágenes en formatos antiguos', detalle: `Solo ${modernas} de ${r.imagenes.length} están en WebP o AVIF.`, impacto: 'JPG y PNG pesan hasta 3 veces más con la misma calidad.', arreglo: 'Convierte las imágenes a WebP o AVIF.' },
    )
  const bloquean = d.scripts.filter((s) => s.bloquea).length
  add(
    bloquean === 0
      ? { id: 'bloqueo', cat: 'velocidad', estado: 'bien', peso: 2, titulo: 'Ningún script bloquea la carga', detalle: 'Los scripts de la cabecera no frenan el primer pintado.' }
      : { id: 'bloqueo', cat: 'velocidad', estado: bloquean > 3 ? 'mal' : 'mejorable', peso: 2, titulo: `${bloquean} script${bloquean > 1 ? 's' : ''} bloquea${bloquean > 1 ? 'n' : ''} la carga`, detalle: 'Hay scripts en la cabecera sin async ni defer.', impacto: 'La página se queda en blanco hasta que se descargan.', arreglo: 'Añade «defer» a los scripts o muévelos al final.' },
  )
  const terceros = new Set(d.scripts.filter((s) => s.terceros).map((s) => new URL(s.src!).hostname)).size
  add(
    terceros <= 5
      ? { id: 'terceros', cat: 'velocidad', estado: 'bien', peso: 1, titulo: 'Pocos servicios externos', detalle: `${terceros} dominios externos con scripts.` }
      : { id: 'terceros', cat: 'velocidad', estado: terceros > 12 ? 'mal' : 'mejorable', peso: 1, titulo: `Carga scripts de ${terceros} servicios externos`, detalle: 'Muchos plugins, widgets y rastreadores.', impacto: 'Cada servicio externo añade tiempo y puntos de fallo.', arreglo: 'Quita los widgets que no uses.' },
  )
  if (r.truncado || r.bytesHtml > 1_000_000) add({ id: 'html', cat: 'velocidad', estado: 'mal', peso: 2, titulo: 'La página es enorme', detalle: `El HTML pesa ${r.truncado ? 'más de ' : ''}${kb(r.bytesHtml)}${r.truncado ? ' (se ha analizado solo el principio)' : ''}. Lo normal es menos de 200 KB.`, impacto: 'El móvil tiene que descargar y leer todo eso antes de mostrar nada.', arreglo: 'Suele deberse a imágenes incrustadas en el código o a constructores visuales: sácalas a ficheros aparte.' })
  if (r.bytesHtml > 10_000)
    add(r.compresion ? { id: 'compresion', cat: 'velocidad', estado: 'bien', peso: 1, titulo: 'Envío comprimido', detalle: `Usa ${r.compresion === 'br' ? 'Brotli' : r.compresion}.` } : { id: 'compresion', cat: 'velocidad', estado: 'mejorable', peso: 1, titulo: 'El servidor no comprime la página', detalle: `${kb(r.bytesHtml)} de HTML sin comprimir.`, impacto: 'Se envía hasta 4 veces más de lo necesario.', arreglo: 'Activa gzip o Brotli en el alojamiento.' })
  if (r.saltos > 1) add({ id: 'saltos', cat: 'velocidad', estado: 'mejorable', peso: 1, titulo: `${r.saltos} redirecciones antes de llegar`, detalle: 'La dirección rebota varias veces antes de cargar.', impacto: 'Cada redirección suma tiempo de espera.', arreglo: 'Haz que la dirección principal redirija directamente a la versión final (https y con o sin www).' })

  /* --------------------------------------------------------- confianza */
  add(r.https ? { id: 'https', cat: 'confianza', estado: 'bien', peso: 3, titulo: 'Conexión segura (HTTPS)', detalle: 'El candado aparece en el navegador.' } : { id: 'https', cat: 'confianza', estado: 'mal', peso: 3, titulo: 'La web no es segura (sin HTTPS)', detalle: 'El navegador la marca como «No seguro».', impacto: 'Asusta a los visitantes y Google la penaliza.', arreglo: 'Activa un certificado gratuito (Let’s Encrypt) en el alojamiento.' })
  if (r.https && r.redirigeHttps === false) add({ id: 'http', cat: 'confianza', estado: 'mejorable', peso: 2, titulo: 'La versión sin «s» no redirige', detalle: 'http:// carga la web sin pasar a https://.', impacto: 'Quien entra por un enlace antiguo ve «No seguro».', arreglo: 'Redirige todo http:// a https:// (301).' })
  if (r.certDias !== null) add(r.certDias > 20 ? { id: 'certificado', cat: 'confianza', estado: 'bien', peso: 1, titulo: 'Certificado vigente', detalle: `Caduca dentro de ${r.certDias} días.` } : { id: 'certificado', cat: 'confianza', estado: r.certDias < 0 ? 'mal' : 'mejorable', peso: 3, titulo: r.certDias < 0 ? 'El certificado ha caducado' : 'El certificado caduca pronto', detalle: r.certDias < 0 ? 'El navegador muestra un aviso de peligro.' : `Le quedan ${r.certDias} días.`, impacto: 'Con el certificado caducado, el navegador bloquea la web con una pantalla de peligro.', arreglo: 'Renueva el certificado o activa la renovación automática.' })
  if (d.mixto.length) add({ id: 'mixto', cat: 'confianza', estado: 'mejorable', peso: 1, titulo: 'Contenido inseguro mezclado', detalle: `${d.mixto.length} recursos se cargan por http://.`, impacto: 'Pueden no cargarse o quitar el candado.', arreglo: 'Cambia esas direcciones a https://.' })
  add(d.legal.avisoLegal ? { id: 'aviso', cat: 'confianza', estado: 'bien', peso: 2, titulo: 'Tiene aviso legal', detalle: 'Hay enlace al aviso legal.' } : { id: 'aviso', cat: 'confianza', estado: 'mal', peso: 2, titulo: 'Falta el aviso legal', detalle: 'No hay enlace al aviso legal.', impacto: 'La LSSI obliga a identificar al titular de la web (nombre, NIF, dirección). Sin él, la web transmite poca confianza y puede haber sanción.', arreglo: 'Añade una página de aviso legal enlazada desde el pie.' })
  const pideDatos = d.formularios > 0 || d.emails.length > 0
  add(d.legal.privacidad ? { id: 'privacidad', cat: 'confianza', estado: 'bien', peso: 2, titulo: 'Tiene política de privacidad', detalle: 'Hay enlace a la política de privacidad.' } : { id: 'privacidad', cat: 'confianza', estado: pideDatos ? 'mal' : 'mejorable', peso: pideDatos ? 3 : 2, titulo: 'Falta la política de privacidad', detalle: pideDatos ? 'La web recoge datos (formulario o email) sin política de privacidad.' : 'No hay enlace a la política de privacidad.', impacto: 'El RGPD la exige si tratas datos personales. Las multas de la AEPD empiezan en cientos de euros.', arreglo: 'Añade la política de privacidad y una casilla de aceptación en los formularios.' })
  if (d.rastreadores.length) {
    const ok = d.legal.cookies && d.gestorCookies
    add(ok ? { id: 'cookies', cat: 'confianza', estado: 'bien', peso: 3, titulo: 'Cookies con aviso y política', detalle: `Usa ${d.rastreadores.join(', ')} con ${d.gestorCookies === 'Banner propio' ? 'un banner de consentimiento' : d.gestorCookies}.` } : { id: 'cookies', cat: 'confianza', estado: d.legal.cookies || d.gestorCookies ? 'mejorable' : 'mal', peso: 3, titulo: d.gestorCookies ? 'Falta la política de cookies' : 'Usa cookies de seguimiento sin pedir permiso', detalle: `Carga ${d.rastreadores.join(', ')}${d.gestorCookies ? '' : ' y no se ha detectado banner de consentimiento'}.`, impacto: 'La AEPD exige consentimiento previo para cookies de análisis y publicidad; es de lo más sancionado.', arreglo: 'Añade un banner que bloquee esos scripts hasta que el usuario acepte, y una política de cookies.' })
  } else add({ id: 'cookies', cat: 'confianza', estado: 'bien', peso: 1, titulo: 'Sin cookies de seguimiento', detalle: 'No se han detectado rastreadores de análisis ni publicidad.' })
  if (d.copyright !== null) add(d.copyright >= anioActual - 1 ? { id: 'actualizada', cat: 'confianza', estado: 'bien', peso: 1, titulo: 'Parece al día', detalle: `© ${d.copyright}.` } : { id: 'actualizada', cat: 'confianza', estado: 'mejorable', peso: 1, titulo: `El pie dice © ${d.copyright}`, detalle: `Han pasado ${anioActual - d.copyright} años.`, impacto: 'Da la impresión de que el negocio está abandonado o cerrado.', arreglo: 'Actualiza el año o haz que se ponga solo.' })
  if (r.rotos.length) add({ id: 'rotos', cat: 'confianza', estado: 'mejorable', peso: 2, titulo: `${r.rotos.length} enlace${r.rotos.length > 1 ? 's' : ''} roto${r.rotos.length > 1 ? 's' : ''}`, detalle: r.rotos.slice(0, 3).map((u) => new URL(u).pathname).join(', '), impacto: 'Llevan a una página de error: mala impresión y Google lo tiene en cuenta.', arreglo: 'Corrige o quita esos enlaces.' })

  /* -------------------------------------------------------------- móvil */
  const vp = d.viewport
  add(/width\s*=\s*device-width/i.test(vp) ? { id: 'viewport', cat: 'movil', estado: 'bien', peso: 3, titulo: 'Adaptada al móvil', detalle: 'Declara la etiqueta viewport.' } : { id: 'viewport', cat: 'movil', estado: 'mal', peso: 3, titulo: 'No está adaptada al móvil', detalle: 'Falta la etiqueta viewport: el móvil la muestra como un ordenador en miniatura.', impacto: 'Más del 70 % de las visitas a negocios locales llegan desde el móvil.', arreglo: 'Añade <meta name="viewport" content="width=device-width, initial-scale=1"> y un diseño adaptable.' })
  const imgs = d.imagenes.filter((i) => i.src)
  if (imgs.length >= 3) {
    const sinMedidas = imgs.filter((i) => !i.dimensiones).length
    add(sinMedidas / imgs.length < 0.3 ? { id: 'saltos_diseno', cat: 'movil', estado: 'bien', peso: 1, titulo: 'La página no da saltos al cargar', detalle: 'Las imágenes indican su tamaño.' } : { id: 'saltos_diseno', cat: 'movil', estado: 'mejorable', peso: 1, titulo: 'La página da saltos al cargar', detalle: `${sinMedidas} de ${imgs.length} imágenes no indican su tamaño.`, impacto: 'El texto se mueve mientras cargan las fotos y se pulsa lo que no es.', arreglo: 'Añade width y height a las imágenes.' })
    const adaptables = imgs.filter((i) => i.srcset).length
    add(adaptables / imgs.length >= 0.3 ? { id: 'srcset', cat: 'movil', estado: 'bien', peso: 1, titulo: 'Imágenes adaptadas a cada pantalla', detalle: `${adaptables} imágenes con versiones por tamaño.` } : { id: 'srcset', cat: 'movil', estado: 'mejorable', peso: 1, titulo: 'El móvil descarga las fotos a tamaño ordenador', detalle: 'Las imágenes no tienen versiones para pantallas pequeñas (srcset).', impacto: 'Se gastan datos y tiempo en píxeles que no se ven.', arreglo: 'Usa srcset o un plugin que genere tamaños.' })
    const lazy = imgs.filter((i) => i.lazy).length
    if (imgs.length >= 6) add(lazy / imgs.length >= 0.3 ? { id: 'lazy', cat: 'velocidad', estado: 'bien', peso: 1, titulo: 'Carga diferida de imágenes', detalle: 'Las imágenes de abajo se cargan al bajar.' } : { id: 'lazy', cat: 'velocidad', estado: 'mejorable', peso: 1, titulo: 'Carga todas las imágenes de golpe', detalle: `${imgs.length} imágenes y solo ${lazy} diferidas.`, impacto: 'Retrasa lo que se ve primero.', arreglo: 'Añade loading="lazy" a las imágenes que no se ven al entrar.' })
  }

  /* ------------------------------------------------------ accesibilidad */
  if (imgs.length) {
    const sinAlt = imgs.filter((i) => i.alt === null).length
    add(sinAlt === 0 ? { id: 'alt', cat: 'accesibilidad', estado: 'bien', peso: 2, titulo: 'Imágenes descritas', detalle: 'Todas tienen texto alternativo.' } : { id: 'alt', cat: 'accesibilidad', estado: sinAlt / imgs.length > 0.3 ? 'mal' : 'mejorable', peso: 2, titulo: `${sinAlt} imagen${sinAlt > 1 ? 'es' : ''} sin descripción`, detalle: 'Les falta el atributo alt.', impacto: 'Las personas ciegas no saben qué muestran, y Google tampoco (no salen en Google Imágenes).', arreglo: 'Describe cada foto en su alt: «Arroz negro con carabineros», no «IMG_2041».' })
  }
  if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(vp)) add({ id: 'zoom', cat: 'accesibilidad', estado: 'mejorable', peso: 2, titulo: 'No deja hacer zoom', detalle: 'El viewport bloquea ampliar con los dedos.', impacto: 'Quien ve mal no puede agrandar el texto o el menú.', arreglo: 'Quita user-scalable=no y maximum-scale=1.' })
  add(d.botonesSinTexto === 0 ? { id: 'botones', cat: 'accesibilidad', estado: 'bien', peso: 1, titulo: 'Botones con nombre', detalle: 'Todos los botones tienen texto o etiqueta.' } : { id: 'botones', cat: 'accesibilidad', estado: 'mejorable', peso: 1, titulo: `${d.botonesSinTexto} botón${d.botonesSinTexto > 1 ? 'es' : ''} sin nombre`, detalle: 'Botones de solo icono sin etiqueta.', impacto: 'Un lector de pantalla dice solo «botón».', arreglo: 'Añade aria-label a los botones de icono.' })
  if (d.formularios) add(d.camposSinEtiqueta === 0 ? { id: 'campos', cat: 'accesibilidad', estado: 'bien', peso: 1, titulo: 'Formularios etiquetados', detalle: 'Cada campo tiene su etiqueta.' } : { id: 'campos', cat: 'accesibilidad', estado: 'mejorable', peso: 1, titulo: `${d.camposSinEtiqueta} campo${d.camposSinEtiqueta > 1 ? 's' : ''} sin etiqueta`, detalle: 'Hay campos de formulario sin etiqueta.', impacto: 'No se sabe qué hay que escribir en ellos.', arreglo: 'Asocia un <label> a cada campo.' })
  add(d.lang ? { id: 'lang_a11y', cat: 'accesibilidad', estado: 'bien', peso: 1, titulo: 'Idioma para lectores de pantalla', detalle: 'El lector sabe en qué idioma leer.' } : { id: 'lang_a11y', cat: 'accesibilidad', estado: 'mejorable', peso: 1, titulo: 'El lector de pantalla no sabe el idioma', detalle: 'Falta lang en <html>.', impacto: 'Puede leer el castellano con pronunciación inglesa.', arreglo: 'Pon <html lang="es">.' })

  if (d.spa) {
    // El contenido lo pinta JavaScript en el navegador: lo que depende del cuerpo de la página no se puede juzgar.
    const quitar = new Set(['telefono', 'tel_clic', 'whatsapp', 'cta', 'reserva', 'ubicacion', 'redes', 'h1', 'contenido', 'ciudad', 'alt', 'botones', 'campos', 'saltos_diseno', 'srcset', 'lazy', 'imagenes', 'formatos', 'aviso', 'privacidad', 'actualizada'])
    const resto = h.filter((x) => !quitar.has(x.id))
    resto.unshift({
      id: 'spa',
      cat: 'google',
      estado: 'mal',
      peso: 3,
      titulo: 'Google y WhatsApp ven tu web vacía al principio',
      detalle: 'La página se construye con JavaScript en el navegador: el HTML que se descarga no tiene textos, teléfono ni enlaces.',
      impacto: 'Google tarda más en indexarla y puede posicionarla peor; WhatsApp, Facebook y otros buscadores solo ven una página en blanco. Por eso parte de este informe no se puede evaluar.',
      arreglo: 'Genera el HTML en el servidor (SSR) o como páginas estáticas: Next.js, Astro o el prerenderizado de tu herramienta.',
    })
    return resto
  }
  return h
}

const VALOR: Record<Estado, number> = { bien: 1, mejorable: 0.5, mal: 0 }

export function notas(h: Hallazgo[]) {
  const porCat = CATEGORIAS.map((c) => {
    const items = h.filter((x) => x.cat === c.id)
    const total = items.reduce((s, x) => s + x.peso, 0)
    // Sin comprobaciones (por ejemplo, una web hecha con JavaScript) no hay nota: no se inventa.
    const nota = total ? Math.round((items.reduce((s, x) => s + x.peso * VALOR[x.estado], 0) / total) * 100) : null
    return { id: c.id, nombre: c.nombre, lema: c.lema, nota, bien: items.filter((x) => x.estado === 'bien').length, total: items.length }
  })
  const con = porCat.map((c, i) => ({ nota: c.nota, peso: CATEGORIAS[i]!.peso })).filter((x): x is { nota: number; peso: number } => x.nota !== null)
  const pesos = con.reduce((s, c) => s + c.peso, 0)
  const global = pesos ? Math.round(con.reduce((s, c) => s + c.nota * c.peso, 0) / pesos) : 0
  return { global, categorias: porCat }
}

/** Lo más urgente: primero lo grave y de más peso, de las categorías que más venden. */
export function prioridades(h: Hallazgo[], n = 3): Hallazgo[] {
  const pesoCat = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.peso]))
  return h
    .filter((x) => x.estado !== 'bien')
    .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'mal' ? -1 : 1) || b.peso - a.peso || pesoCat[b.cat]! - pesoCat[a.cat]!)
    .slice(0, n)
}

export function formatearTel(t: string): string {
  const d = t.replace(/\D/g, '').replace(/^34(?=\d{9}$)/, '')
  if (d.length !== 9) return t
  return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}`
}
