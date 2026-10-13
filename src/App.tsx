import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import Informe from './components/Informe'
import { analizar, disponible, type Informe as TInforme } from './lib/api'
import { DHT } from './lib/util'

const REPO = 'https://github.com/hodeione/radiografia'

const PASOS = [
  ['descarga', 'Visitando la web como un móvil'],
  ['contenido', 'Leyendo textos, contacto y datos para Google'],
  ['recursos', 'Pesando imágenes y comprobando enlaces'],
  ['seguridad', 'Revisando seguridad, cookies y aviso legal'],
  ['informe', 'Poniendo nota y escribiendo propuestas'],
] as const

const QUE_MIRA = [
  ['Captar clientes', 'Teléfono que se pulsa, WhatsApp, botones de reservar o pedir cita, dirección y mapa.'],
  ['Google y SEO local', 'Título, descripción, titular, ficha de negocio (schema.org), ciudad, texto y mapa del sitio.'],
  ['Velocidad', 'Respuesta del servidor, peso y formato de las imágenes, scripts que bloquean y compresión.'],
  ['Confianza y legal', 'HTTPS y certificado, aviso legal (LSSI), privacidad (RGPD) y cookies con consentimiento.'],
  ['Móvil', 'Adaptación a la pantalla, imágenes por tamaño y saltos al cargar.'],
  ['Accesibilidad', 'Textos alternativos, zoom, botones y formularios etiquetados.'],
]

export default function App() {
  const [url, setUrl] = useState(() => new URLSearchParams(location.search).get('url') ?? '')
  const [estado, setEstado] = useState<'inicio' | 'analizando' | 'informe' | 'error'>('inicio')
  const [paso, setPaso] = useState<{ id: string; texto: string } | null>(null)
  const [informe, setInforme] = useState<TInforme | null>(null)
  const [error, setError] = useState('')
  const [ia, setIa] = useState(false)
  const [lighthouse, setLighthouse] = useState(false)
  const abortar = useRef<AbortController | null>(null)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void disponible('/api/textos').then(setIa)
    void disponible('/api/pagespeed').then(setLighthouse)
  }, [])

  const lanzar = useCallback(async (u: string) => {
    const limpia = u.trim()
    if (!limpia) return
    abortar.current?.abort()
    abortar.current = new AbortController()
    setEstado('analizando')
    setPaso(null)
    setError('')
    window.scrollTo({ top: 0 })
    history.replaceState(null, '', `?url=${encodeURIComponent(limpia.replace(/^https?:\/\//, '').replace(/\/$/, ''))}`)
    try {
      const i = await analizar(limpia, (id, texto) => setPaso({ id, texto }), abortar.current.signal)
      setInforme(i)
      setEstado('informe')
      document.title = `${i.dominio}: ${i.nota}/100 · Radiografía web`
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'No se ha podido analizar la web.')
      setEstado('error')
    }
  }, [])

  // Enlace compartido (?url=…): se analiza al entrar.
  useEffect(() => {
    const inicial = new URLSearchParams(location.search).get('url')
    if (inicial) void lanzar(inicial)
  }, [lanzar])

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    void lanzar(url)
  }
  const otra = () => {
    setEstado('inicio')
    setInforme(null)
    setUrl('')
    history.replaceState(null, '', '/')
    document.title = 'Radiografía web · ¿Tu web te trae clientes o te los quita?'
    setTimeout(() => campo.current?.focus(), 50)
  }

  return (
    <>
      <header className="no-imprimir sticky top-0 z-20 border-b border-line/60 bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={otra} className="flex items-center gap-2.5" aria-label="Radiografía web: inicio">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-acid font-display text-lg text-ink">DH</span>
            <span className="font-display text-xl tracking-wider">
              Radiografía <span className="text-acid">web</span>
            </span>
          </button>
          <nav className="flex items-center gap-1 text-sm">
            <a href={DHT} className="hidden rounded-full px-3 py-1.5 text-mute hover:text-soft sm:block">
              DH Technology
            </a>
            <a href={REPO} className="rounded-full border border-line px-3 py-1.5 text-soft hover:border-mute">
              Código
            </a>
          </nav>
        </div>
      </header>

      <main className="pt-8">
        {estado === 'informe' && informe ? (
          <Informe informe={informe} ia={ia} lighthouse={lighthouse} onOtra={otra} />
        ) : (
          <section className="mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 lg:pt-14">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-mono text-xs tracking-[0.2em] text-acid uppercase">Gratis · sin registro · 20 segundos</p>
              <h1 className="mt-4 font-display text-[clamp(3rem,8vw,6rem)] leading-[0.88] tracking-wide">
                ¿Tu web te trae clientes <span className="text-acid">o te los quita?</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-soft/90">
                Escribe la dirección de tu web y te decimos, en cristiano, qué está espantando a tus clientes: velocidad, Google, móvil, cómo contactarte y si cumples la ley. Con una propuesta de cómo podría ser tu portada.
              </p>
              <form onSubmit={enviar} className="mx-auto mt-9 flex max-w-2xl flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="url">
                  Dirección de la web
                </label>
                <input
                  id="url"
                  ref={campo}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="tunegocio.es"
                  inputMode="url"
                  autoComplete="url"
                  autoFocus
                  disabled={estado === 'analizando'}
                  className="sin-anillo min-w-0 flex-1 rounded-full border border-line bg-card px-6 py-4 text-lg text-white outline-none placeholder:text-mute/60 focus:border-acid/70"
                />
                <button disabled={estado === 'analizando' || !url.trim()} className="rounded-full bg-acid px-8 py-4 font-semibold text-ink transition hover:brightness-110 disabled:opacity-50">
                  {estado === 'analizando' ? 'Analizando…' : 'Analizar gratis'}
                </button>
              </form>
              {estado === 'inicio' && (
                <p className="mt-4 font-mono text-xs text-mute">
                  Prueba con{' '}
                  {['taberna-luna-dht.vercel.app', 'h-com-bay.vercel.app'].map((d, i) => (
                    <span key={d}>
                      {i > 0 && ' o '}
                      <button
                        onClick={() => {
                          setUrl(d)
                          void lanzar(d)
                        }}
                        className="text-soft underline decoration-line underline-offset-4 hover:text-acid"
                      >
                        {d}
                      </button>
                    </span>
                  ))}
                </p>
              )}
            </div>

            {estado === 'analizando' && (
              <ol className="mx-auto mt-12 max-w-md space-y-3" aria-live="polite">
                {PASOS.map(([id, texto], n) => {
                  const actual = PASOS.findIndex(([p]) => p === paso?.id)
                  const hecho = n < actual
                  const ahora = n === actual || (actual === -1 && n === 0)
                  return (
                    <li key={id} className={`flex items-center gap-3 transition-opacity ${hecho || ahora ? 'opacity-100' : 'opacity-35'}`}>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${hecho ? 'border-acid bg-acid text-ink' : ahora ? 'border-acid text-acid' : 'border-line text-mute'}`}>
                        {hecho ? '✓' : ahora ? <span className="h-2 w-2 animate-ping rounded-full bg-acid" /> : n + 1}
                      </span>
                      <span className={ahora ? 'text-white' : 'text-soft'}>{ahora && paso ? paso.texto : texto}</span>
                    </li>
                  )
                })}
              </ol>
            )}

            {estado === 'error' && (
              <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-ko/40 bg-ko/10 p-5 text-center">
                <p className="text-[#ffb3b3]">{error}</p>
                <button onClick={() => void lanzar(url)} className="mt-3 font-mono text-xs text-soft underline underline-offset-4">
                  Volver a intentarlo
                </button>
              </div>
            )}

            {estado !== 'analizando' && (
              <div className="mt-20 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {QUE_MIRA.map(([t, d], n) => (
                  <div key={t} className="rounded-3xl border border-line bg-card p-6">
                    <span className="font-mono text-xs text-acid">0{n + 1}</span>
                    <h2 className="mt-2 font-display text-3xl tracking-wide">{t}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-soft/80">{d}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="no-imprimir border-t border-line/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 font-mono text-xs text-mute sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Hecho por <a href={DHT} className="text-soft hover:text-acid">DH Technology</a> · Analizamos solo lo público, como lo vería Google.
          </p>
          <p>No guardamos las webs analizadas.</p>
        </div>
      </footer>
    </>
  )
}
