import { useEffect, useState } from 'react'
import { pagespeed, textosIA, type Hallazgo, type Informe as TInforme, type PageSpeed, type Propuesta } from '../lib/api'
import { WHATSAPP_DHT, colorNota, kb, veredicto } from '../lib/util'
import { COLOR_ESTADO, Captura, ICONO, Marco, Nota } from './Piezas'
import { Portada, ResultadoGoogle } from './Portada'

interface Props {
  informe: TInforme
  ia: boolean
  lighthouse: boolean
  onOtra: () => void
}

export default function Informe({ informe: i, ia, lighthouse, onOtra }: Props) {
  const [propuesta, setPropuesta] = useState<Propuesta>(i.propuesta)
  const [cargandoIA, setCargandoIA] = useState(false)
  const [errorIA, setErrorIA] = useState('')
  const [copiado, setCopiado] = useState(false)
  const enlace = `${location.origin}/?url=${encodeURIComponent(i.dominio)}`
  const malas = i.hallazgos.filter((h) => h.estado === 'mal').length
  const mejorables = i.hallazgos.filter((h) => h.estado === 'mejorable').length
  const v = veredicto(i.nota, malas)
  const mensaje = `Hola, he pasado mi web ${i.dominio} por la Radiografía web y ha sacado un ${i.nota}/100 (${malas} problemas graves). Me gustaría que me ayudarais a mejorarla.`

  const mejorarConIA = async () => {
    setCargandoIA(true)
    setErrorIA('')
    try {
      setPropuesta(await textosIA(i.textos))
    } catch (e) {
      setErrorIA(e instanceof Error ? e.message : 'La IA no ha podido revisar los textos.')
    } finally {
      setCargandoIA(false)
    }
  }

  return (
    <article className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      {/* ---------------------------------------------------- cabecera */}
      <section className="tarjeta grid gap-8 rounded-3xl border border-line bg-card p-6 sm:p-8 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-acid uppercase">Radiografía de</p>
          <h1 className="mt-2 font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-[0.9] tracking-wide break-words">{i.dominio}</h1>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-mute">
            {i.nombre && <span>{i.nombre}</span>}
            {i.ciudad && <span>· {i.ciudad}</span>}
            {i.cms && <span>· hecha con {i.cms}</span>}
            <span>· {new Date(i.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </p>
          <div className="mt-7 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
            <Nota valor={i.nota} etiqueta="de 100" />
            <div>
              <h2 className="text-2xl leading-tight font-semibold" style={{ color: colorNota(i.nota) }}>
                {v.titulo}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-soft/85">{v.texto}</p>
              <p className="mt-3 font-mono text-xs text-mute">
                {malas} graves · {mejorables} mejorables · {i.hallazgos.length - malas - mejorables} bien
              </p>
            </div>
          </div>
          {i.spa && (
            <p className="mt-5 rounded-xl border border-[#ffb020]/40 bg-[#ffb020]/10 px-4 py-3 text-sm text-[#ffd27a]">
              Nota provisional: esta web se construye con JavaScript y parte de su contenido no se puede leer sin un navegador. Lo explicamos abajo.
            </p>
          )}
        </div>
        <Marco dominio={i.dominio}>
          <Captura url={i.urlFinal} alt={`Captura de ${i.dominio}`} />
        </Marco>
      </section>

      {/* -------------------------------------------------- categorías */}
      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {i.categorias.map((c) => (
          <a key={c.id} href={`#cat-${c.id}`} className="tarjeta group rounded-2xl border border-line bg-card p-4 transition hover:border-mute">
            <Nota valor={c.nota} tam={72} grosor={7} />
            <p className="mt-3 text-sm font-semibold text-soft">{c.nombre}</p>
            <p className="mt-0.5 text-xs leading-snug text-mute">{c.nota === null ? 'No se puede evaluar sin navegador' : c.lema}</p>
          </a>
        ))}
      </section>

      {/* ------------------------------------------------ lo más urgente */}
      {i.prioridades.length > 0 && (
        <section className="mt-12">
          <Titulo eyebrow="Por dónde empezar" titulo="Lo más urgente" />
          <ol className="grid gap-4 lg:grid-cols-3">
            {i.prioridades.map((h, n) => (
              <li key={h.id} className="tarjeta flex flex-col rounded-3xl border border-line bg-card p-6">
                <span className="font-display text-5xl leading-none" style={{ color: h.estado === 'mal' ? '#ff6b6b' : '#ffb020' }}>
                  {n + 1}
                </span>
                <h3 className="mt-3 text-lg leading-snug font-semibold text-white">{h.titulo}</h3>
                <p className="mt-2 text-sm text-soft/85">{h.impacto}</p>
                <p className="mt-auto pt-4 text-sm text-acid">→ {h.arreglo}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* --------------------------------------------- propuesta portada */}
      <section className="mt-14 imprimir-salto">
        <Titulo eyebrow="La propuesta" titulo="Así podría verse tu portada">
          Con tu nombre, tu logo y tu color de marca, y textos pensados para que te encuentren y te llamen.
          {propuesta.origen === 'ia' ? ' Textos revisados por Claude.' : ''}
        </Titulo>
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_330px_1fr]">
          <div className="space-y-4">
            <ResultadoGoogle dominio={i.dominio} titulo={i.textos.titulo} descripcion={i.textos.descripcion} etiqueta="Así sales en Google ahora" />
            <ResultadoGoogle dominio={i.dominio} titulo={propuesta.titulo} descripcion={propuesta.descripcion} etiqueta="Así saldrías" bueno />
          </div>
          <Portada informe={i} propuesta={propuesta} />
          <div className="tarjeta space-y-4 rounded-3xl border border-line bg-card p-6">
            {propuesta.impresion && (
              <div>
                <p className="font-mono text-[11px] tracking-wider text-acid uppercase">Primera impresión</p>
                <p className="mt-1 text-soft">«{propuesta.impresion}»</p>
              </div>
            )}
            {propuesta.problemas && propuesta.problemas.length > 0 && (
              <ul className="space-y-1.5 text-sm text-soft/85">
                {propuesta.problemas.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-[#ffb020]">!</span>
                    {p}
                  </li>
                ))}
              </ul>
            )}
            <Copiable etiqueta="Título para Google" texto={propuesta.titulo} />
            <Copiable etiqueta="Descripción para Google" texto={propuesta.descripcion} />
            <Copiable etiqueta="Titular de la portada (H1)" texto={propuesta.h1} />
            {ia && propuesta.origen !== 'ia' && (
              <button onClick={() => void mejorarConIA()} disabled={cargandoIA} className="no-imprimir w-full rounded-full border border-acid/60 py-2.5 text-sm text-acid transition hover:bg-acid/10 disabled:opacity-50">
                {cargandoIA ? 'Claude está leyendo tu web…' : '✦ Mejorar los textos con IA'}
              </button>
            )}
            {errorIA && <p className="text-xs text-[#ffb3b3]">{errorIA}</p>}
          </div>
        </div>
      </section>

      {lighthouse && <Lighthouse url={i.urlFinal} />}

      {/* ---------------------------------------------- todos los detalles */}
      <section className="mt-14">
        <Titulo eyebrow={`${i.hallazgos.length} comprobaciones`} titulo="El detalle" />
        <div className="space-y-4">
          {i.categorias.map((c) => (
            <Categoria key={c.id} id={c.id} nombre={c.nombre} nota={c.nota} hallazgos={i.hallazgos.filter((h) => h.cat === c.id)} />
          ))}
        </div>
        <p className="mt-4 font-mono text-[11px] text-mute">
          Primera respuesta del servidor: {(i.resumen.ttfbMs / 1000).toFixed(1).replace('.', ',')} s · {i.resumen.imagenes} imágenes ({kb(i.resumen.pesoImagenes)} en las comprobadas) · {i.resumen.scripts} scripts · {i.resumen.palabras} palabras · análisis en {(i.duracionMs / 1000).toFixed(1).replace('.', ',')} s
        </p>
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section className="no-imprimir mt-14 grid gap-6 rounded-3xl border border-acid/40 bg-gradient-to-br from-acid/[0.08] to-transparent p-7 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-acid uppercase">DH Technology</p>
          <h2 className="mt-2 font-display text-5xl leading-none tracking-wide">¿Te lo arreglamos?</h2>
          <p className="mt-3 max-w-xl text-soft/90">Hacemos webs rápidas, que salen en Google y que convierten visitas en llamadas y reservas. Cuéntanos qué necesitas y te decimos cuánto cuesta, sin compromiso.</p>
        </div>
        <div className="flex flex-col gap-3">
          <a href={`https://wa.me/${WHATSAPP_DHT}?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener" className="rounded-full bg-acid py-3.5 text-center font-medium text-ink transition hover:brightness-110">
            Hablar por WhatsApp
          </a>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => window.print()} className="rounded-full border border-line py-3 text-sm text-soft hover:border-mute">
              Guardar en PDF
            </button>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(enlace)
                setCopiado(true)
                setTimeout(() => setCopiado(false), 2000)
              }}
              className="rounded-full border border-line py-3 text-sm text-soft hover:border-mute"
            >
              {copiado ? '¡Enlace copiado!' : 'Copiar enlace'}
            </button>
          </div>
          <button onClick={onOtra} className="font-mono text-xs text-mute hover:text-soft">
            Analizar otra web →
          </button>
        </div>
      </section>
    </article>
  )
}

function Titulo({ eyebrow, titulo, children }: { eyebrow: string; titulo: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 max-w-2xl">
      <p className="font-mono text-xs tracking-[0.2em] text-acid uppercase">{eyebrow}</p>
      <h2 className="mt-2 font-display text-5xl leading-none tracking-wide">{titulo}</h2>
      {children && <p className="mt-3 text-soft/85">{children}</p>}
    </div>
  )
}

function Copiable({ etiqueta, texto }: { etiqueta: string; texto: string }) {
  const [ok, setOk] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] tracking-wider text-mute uppercase">{etiqueta}</p>
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(texto)
            setOk(true)
            setTimeout(() => setOk(false), 1500)
          }}
          className="no-imprimir font-mono text-[11px] text-acid hover:underline"
        >
          {ok ? 'copiado' : 'copiar'}
        </button>
      </div>
      <p className="mt-1 text-sm text-soft">{texto}</p>
    </div>
  )
}

function Categoria({ id, nombre, nota, hallazgos }: { id: string; nombre: string; nota: number | null; hallazgos: Hallazgo[] }) {
  const orden = { mal: 0, mejorable: 1, bien: 2 }
  const lista = [...hallazgos].sort((a, b) => orden[a.estado] - orden[b.estado] || b.peso - a.peso)
  const [abierta, setAbierta] = useState(hallazgos.some((h) => h.estado !== 'bien'))
  return (
    <div id={`cat-${id}`} className="tarjeta scroll-mt-24 rounded-3xl border border-line bg-card">
      <button onClick={() => setAbierta(!abierta)} className="flex w-full items-center gap-4 p-5 text-left" aria-expanded={abierta}>
        <Nota valor={nota} tam={52} grosor={5} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl tracking-wide">{nombre}</h3>
          <p className="font-mono text-xs text-mute">
            {hallazgos.filter((h) => h.estado === 'bien').length} de {hallazgos.length} bien
          </p>
        </div>
        <span className="no-imprimir font-mono text-xs text-mute">{abierta ? 'ocultar' : 'ver'}</span>
      </button>
      {/* Plegada solo en pantalla: en el PDF sale todo. */}
      {(
        <ul className={`divide-y divide-line border-t border-line print:block ${abierta ? '' : 'hidden'}`}>
          {lista.map((h) => (
            <li key={h.id} className="flex gap-3 px-5 py-4">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold ${COLOR_ESTADO[h.estado]}`} aria-label={h.estado}>
                {ICONO[h.estado]}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-soft">{h.titulo}</p>
                <p className="text-sm break-words text-mute">{h.detalle}</p>
                {h.impacto && <p className="mt-1.5 text-sm text-soft/80">{h.impacto}</p>}
                {h.arreglo && <p className="mt-1 text-sm text-acid/90">→ {h.arreglo}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Lighthouse({ url }: { url: string }) {
  const [d, setD] = useState<PageSpeed | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    pagespeed(url).then(setD, (e: Error) => setError(e.message))
  }, [url])
  const notas = d ? ([['Rendimiento', d.notas.rendimiento], ['Accesibilidad', d.notas.accesibilidad], ['Buenas prácticas', d.notas.buenasPracticas], ['SEO', d.notas.seo]] as const) : []
  return (
    <section className="mt-14">
      <Titulo eyebrow="Google Lighthouse · móvil" titulo="La opinión de Google">
        La herramienta oficial de Google carga tu web en un móvil simulado y mide cuánto tarda en verse y en poder usarse.
      </Titulo>
      {!d && !error && <p className="tarjeta rounded-3xl border border-line bg-card p-6 font-mono text-sm text-mute">Google está cargando tu web en un móvil simulado… (tarda entre 20 y 40 segundos)</p>}
      {error && <p className="tarjeta rounded-3xl border border-line bg-card p-6 text-sm text-mute">{error}</p>}
      {d && (
        <div className="tarjeta grid gap-6 rounded-3xl border border-line bg-card p-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {notas.map(([n, v]) => (
              <div key={n} className="flex flex-col items-center text-center">
                <Nota valor={v} tam={86} grosor={8} />
                <p className="mt-2 text-sm text-soft">{n}</p>
              </div>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Primer contenido', d.metricas.fcp],
              ['Contenido principal (LCP)', d.metricas.lcp],
              ['Bloqueo total', d.metricas.tbt],
              ['Estabilidad (CLS)', d.metricas.cls],
            ].map(([k, val]) => (
              <div key={k} className="rounded-xl border border-line p-3">
                <dt className="font-mono text-[11px] text-mute">{k}</dt>
                <dd className="mt-1 font-display text-2xl text-soft">{val || '–'}</dd>
              </div>
            ))}
            {d.campo && (
              <p className="col-span-2 text-xs text-mute">
                Usuarios reales de Chrome: experiencia {d.campo.categoria === 'FAST' ? 'buena' : d.campo.categoria === 'AVERAGE' ? 'mejorable' : 'mala'}
                {d.campo.lcpMs ? ` · LCP ${(d.campo.lcpMs / 1000).toFixed(1).replace('.', ',')} s` : ''}
                {d.campo.inpMs ? ` · INP ${d.campo.inpMs} ms` : ''}
              </p>
            )}
          </dl>
        </div>
      )}
    </section>
  )
}
