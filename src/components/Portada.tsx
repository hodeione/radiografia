import { useState } from 'react'
import type { Informe, Propuesta } from '../lib/api'
import { oscurecer, recortar, textoSobre } from '../lib/util'

/**
 * Maqueta de cómo podría ser su portada en el móvil: su nombre, su logo,
 * su color de marca y los textos propuestos. Es el gancho comercial: el
 * dueño ve su web mejorada antes de hablar con nadie.
 */
export function Portada({ informe, propuesta }: { informe: Informe; propuesta: Propuesta }) {
  const color = informe.marca.colores[0] ?? '#c8ff00'
  const sobre = textoSobre(color)
  const fondo = oscurecer(color, 0.72)
  const [logoMal, setLogoMal] = useState(false)
  const digitos = (informe.resumen.telefono ?? '').replace(/\D/g, '').replace(/^34(?=\d{9}$)/, '')
  const tel = digitos.length === 9 ? `${digitos.slice(0, 3)} ${digitos.slice(3, 5)} ${digitos.slice(5, 7)} ${digitos.slice(7)}` : informe.resumen.telefono
  return (
    <div className="mx-auto w-[300px] overflow-hidden rounded-[2rem] border-[7px] border-[#1d2027] bg-white text-[#111] shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {!logoMal && informe.marca.logo ? (
            <img src={informe.marca.logo} alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" onError={() => setLogoMal(true)} />
          ) : (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-sm font-bold" style={{ background: color, color: sobre }}>
              {(informe.nombre || '?').charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-[13px] font-semibold">{recortar(informe.nombre || informe.dominio, 26)}</span>
        </div>
        <span className="flex flex-col gap-[3px]" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-[2px] w-4 rounded bg-[#111]" />
          ))}
        </span>
      </div>
      <div className="relative px-5 pt-8 pb-7 text-white" style={{ background: `radial-gradient(120% 90% at 20% 0%, ${color}55, transparent 60%), linear-gradient(160deg, ${fondo}, #0b0c0f)` }}>
        {informe.marca.imagen && <img src={informe.marca.imagen} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity" onError={(e) => (e.currentTarget.style.display = 'none')} />}
        <div className="relative">
          {informe.ciudad && <p className="text-[10px] font-semibold tracking-[0.18em] uppercase opacity-80">📍 {informe.ciudad}</p>}
          <h3 className="mt-2 text-[26px] leading-[1.05] font-extrabold tracking-tight">{propuesta.h1}</h3>
          <p className="mt-3 text-[13px] leading-snug opacity-90">{propuesta.subtitulo}</p>
          <span className="mt-5 block rounded-full py-3 text-center text-[14px] font-bold" style={{ background: color, color: sobre }}>
            {propuesta.cta}
          </span>
          <div className="mt-2.5 grid grid-cols-2 gap-2 text-[12px] font-semibold">
            <span className="rounded-full border border-white/40 py-2 text-center">📞 Llamar</span>
            <span className="rounded-full border border-white/40 py-2 text-center">💬 WhatsApp</span>
          </div>
        </div>
      </div>
      <div className="space-y-2 px-4 py-4 text-[11.5px]">
        {[tel ? `Teléfono a un toque: ${tel}` : 'Teléfono a un toque', 'Cómo llegar con Google Maps', 'Aviso legal, privacidad y cookies en regla'].map((x) => (
          <p key={x} className="flex items-center gap-2">
            <span className="grid h-4 w-4 place-items-center rounded-full text-[9px]" style={{ background: color, color: sobre }}>
              ✓
            </span>
            {x}
          </p>
        ))}
      </div>
    </div>
  )
}

/** Cómo sale en Google ahora y cómo saldría. */
export function ResultadoGoogle({ dominio, titulo, descripcion, etiqueta, bueno }: { dominio: string; titulo: string; descripcion: string; etiqueta: string; bueno?: boolean }) {
  return (
    <div className={`tarjeta rounded-2xl border p-4 ${bueno ? 'border-acid/40' : 'border-line'} bg-white`}>
      <p className={`mb-2 font-mono text-[10.5px] tracking-wider uppercase ${bueno ? 'text-[#3a7d00]' : 'text-[#888]'}`}>{etiqueta}</p>
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#f1f3f4] text-[11px] text-[#555]">{dominio.charAt(0).toUpperCase()}</span>
        <div className="leading-tight">
          <p className="text-[13px] text-[#202124]">{dominio}</p>
          <p className="text-[11.5px] text-[#4d5156]">https://{dominio}</p>
        </div>
      </div>
      <p className="mt-2 text-[19px] leading-snug text-[#1a0dab]">{titulo ? recortar(titulo, 60) : <span className="text-[#999] italic">(sin título)</span>}</p>
      <p className="mt-1 text-[13.5px] leading-snug text-[#4d5156]">{descripcion ? recortar(descripcion, 158) : <span className="italic">Sin descripción: Google se inventa un trozo de texto de la página…</span>}</p>
    </div>
  )
}
