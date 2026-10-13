import { useEffect, useState } from 'react'
import { colorNota } from '../lib/util'

/** Nota circular (0-100). */
export function Nota({ valor, tam = 168, grosor = 12, etiqueta }: { valor: number | null; tam?: number; grosor?: number; etiqueta?: string }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setV(valor ?? 0), 80)
    return () => clearTimeout(t)
  }, [valor])
  const r = (tam - grosor) / 2
  const c = 2 * Math.PI * r
  const color = colorNota(valor)
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: tam, height: tam }} role="img" aria-label={valor === null ? 'Sin nota' : `Nota ${valor} de 100`}>
      <svg width={tam} height={tam} className="-rotate-90">
        <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke="#23262d" strokeWidth={grosor} />
        <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute text-center">
        <span className="font-display leading-none" style={{ color, fontSize: tam * 0.36 }}>
          {valor ?? '–'}
        </span>
        {etiqueta && <span className="block font-mono text-[11px] tracking-wider text-mute uppercase">{etiqueta}</span>}
      </div>
    </div>
  )
}

/**
 * Captura de la web con el servicio público mShots de WordPress.com. La
 * primera vez devuelve una imagen de «generando»: se reintenta unos segundos.
 */
export function Captura({ url, alt }: { url: string; alt: string }) {
  const [intento, setIntento] = useState(0)
  const [lista, setLista] = useState(false)
  const src = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1280${intento ? `&r=${intento}` : ''}`
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#15181d]">
      {!lista && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-mono text-xs text-mute">{intento >= 15 ? 'La captura no está disponible ahora mismo.' : 'Haciendo la captura…'}</span>
          <span className="barrido absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-acid/10 to-transparent" />
        </div>
      )}
      <img
        key={intento}
        src={src}
        alt={alt}
        className={`h-full w-full object-cover object-top transition-opacity duration-500 ${lista ? 'opacity-100' : 'opacity-0'}`}
        onLoad={(e) => {
          const img = e.currentTarget
          // La imagen provisional mide 400×300: hay que esperar a la buena (la primera vez, hasta un minuto).
          if (img.naturalWidth <= 400 && intento < 15) setTimeout(() => setIntento((x) => x + 1), 4000)
          else setLista(true)
        }}
        onError={() => intento < 15 && setTimeout(() => setIntento((x) => x + 1), 4000)}
      />
    </div>
  )
}

export function Marco({ dominio, children }: { dominio: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-[#0f1115] shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)]">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
          ))}
        </span>
        <span className="mx-auto truncate rounded-md bg-[#1a1d23] px-3 py-0.5 font-mono text-[11px] text-mute">{dominio}</span>
      </div>
      <div className="p-2">{children}</div>
    </div>
  )
}

export const ICONO: Record<string, string> = { bien: '✓', mejorable: '!', mal: '✕' }
export const COLOR_ESTADO: Record<string, string> = { bien: 'text-acid border-acid/40 bg-acid/10', mejorable: 'text-[#ffb020] border-[#ffb020]/40 bg-[#ffb020]/10', mal: 'text-[#ff6b6b] border-[#ff4d4f]/40 bg-[#ff4d4f]/10' }
