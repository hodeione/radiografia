export const colorNota = (n: number | null) => (n === null ? '#8b929c' : n < 50 ? '#ff4d4f' : n < 75 ? '#ffb020' : '#c8ff00')

export function veredicto(n: number, graves = 0): { titulo: string; texto: string } {
  // Con fallos graves no se dice «muy buena», aunque la media salga alta.
  if (n >= 85 && graves === 0) return { titulo: 'Muy buena web', texto: 'Está bien hecha. Quedan detalles para exprimirla al máximo.' }
  if (n >= 70) return { titulo: 'Buena base, pero se te escapan clientes', texto: 'Funciona, aunque hay arreglos sencillos que te traerían más llamadas y reservas.' }
  if (n >= 50) return { titulo: 'Tu web te está haciendo perder clientes', texto: 'Hay problemas que ahuyentan a quien te busca, sobre todo desde el móvil.' }
  return { titulo: 'Tu web aleja a los clientes', texto: 'Necesita una renovación: así, quien te encuentra en Google se va con la competencia.' }
}

/** Texto blanco o negro según lo claro que sea el fondo (contraste WCAG). */
export function textoSobre(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return l > 0.4 ? '#0b0c0f' : '#ffffff'
}

/** Oscurece un color para fondos (mezcla con negro). */
export function oscurecer(hex: string, f = 0.55): string {
  const c = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)))
  return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('')
}

export const recortar = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…')

export const kb = (b: number) => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.round(b / 1000)} KB`)

export const DHT = 'https://h-com-bay.vercel.app'
export const WHATSAPP_DHT = '34668524968'
