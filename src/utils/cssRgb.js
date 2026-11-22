// Lê uma custom property CSS no formato "r g b" (ou "r, g, b") e devolve
// "r, g, b" para uso em `rgba(...)`. Cacheado por elemento (500 ms) para os
// canvases acompanharem trocas de tema sem chamar getComputedStyle a cada frame.
const cache = new WeakMap()

export function cssRgb(el, name, fallback) {
  const now = performance.now()
  let entry = cache.get(el)
  if (!entry || now - entry.at > 500) {
    entry = { at: now, values: new Map() }
    cache.set(el, entry)
  }

  let value = entry.values.get(name)
  if (value === undefined) {
    const raw = getComputedStyle(el).getPropertyValue(name).trim()
    value = raw ? raw.split(/[\s,]+/).join(', ') : fallback
    entry.values.set(name, value)
  }
  return value
}
