import type { Datos } from './extraer.js'
import type { Hallazgo, notas } from './reglas.js'
import type { Propuesta } from './textos.js'

/** Tipos que comparten las funciones y la web (sin dependencias de Node). */

export type { Hallazgo, Propuesta }

export interface Informe {
  url: string
  urlFinal: string
  dominio: string
  fecha: string
  nombre: string
  ciudad: string
  cms: string | null
  spa: boolean
  nota: number
  categorias: ReturnType<typeof notas>['categorias']
  hallazgos: Hallazgo[]
  prioridades: Hallazgo[]
  propuesta: Propuesta
  marca: { logo: string; imagen: string; colores: string[] }
  resumen: { ttfbMs: number; pesoImagenes: number; imagenes: number; scripts: number; rastreadores: string[]; palabras: number; telefono: string | null; whatsapp: boolean; redes: string[] }
  /** Textos de la portada, para que la IA proponga mejoras. */
  textos: Pick<Datos, 'titulo' | 'descripcion' | 'h1' | 'llamadasAccion' | 'texto' | 'nombre' | 'ciudad' | 'telefonos'>
  duracionMs: number
}

export interface PageSpeed {
  notas: { rendimiento: number; accesibilidad: number; buenasPracticas: number; seo: number }
  metricas: { lcp: string; cls: string; tbt: string; fcp: string; si: string }
  /** Datos reales de usuarios de Chrome (CrUX), si la web tiene suficiente tráfico. */
  campo: { categoria: string; lcpMs: number | null; inpMs: number | null; cls: number | null } | null
}
