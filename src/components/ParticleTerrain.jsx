import { useEffect, useRef } from 'react'
import { cssRgb } from '../utils/cssRgb'
import { useCanvasLoop } from '../hooks/useCanvasLoop'

const EFFECTS = ['ondas', 'constelacoes', 'rastro']

const Z_NEAR = 1.2
const Z_FAR = 46
const BUCKETS = 7

const RIPPLE_SPEED = 3
const RIPPLE_LIFE = 11
const SEGMENT_TIME = 0.42
const CONSTELLATION_HOLD = 3.6
const CONSTELLATION_FADE = 1.6
const TRACE_LIFE = 1.5

const SKY_SPEED = 0.003
const BAND_ANGLE = 0.35
const METEOR_LIFE = 0.9

export function terrainHeight(x, z, travel) {
  const zz = z + travel
  const ridge = Math.min(1, Math.max(0, (z - 8) / 24))
  const amp = 0.3 + 5.6 * Math.pow(ridge, 1.5)
  const crest = 1 - Math.abs(Math.sin(x * 0.15 + zz * 0.05))
  const roll = 0.5 + 0.5 * Math.sin(x * 0.47 - zz * 0.19 + 1.3)
  const grain = 0.5 + 0.5 * Math.sin(x * 1.3 + zz * 0.7 + 0.4)
  return amp * (0.6 * crest * crest + 0.28 * roll + 0.12 * grain)
}

function effectFromUrl() {
  try {
    const value = new URLSearchParams(window.location.search).get('efeito')
    return EFFECTS.includes(value) ? value : 'ondas'
  } catch {
    return 'ondas'
  }
}

export default function ParticleTerrain({ className }) {
  const points = useRef([])
  const stars = useRef([])
  const buckets = useRef([])
  const sky = useRef({ poleY: 0, rMin: 1, rMax: 1, span: 1 })
  const meteor = useRef(null)
  const nextMeteor = useRef(9)
  const effect = useRef('ondas')

  const ripples = useRef([])
  const nextRipple = useRef(1.2)
  const taps = useRef([])

  const figures = useRef([])
  const nextFigure = useRef(1.5)

  const traces = useRef([])
  const lastMove = useRef(-Infinity)
  const clock = useRef(0)

  const canvasRef = useCanvasLoop(
    ({ width, height, isSmall }) => {
      const cols = isSmall ? 90 : 170
      const rows = isSmall ? 64 : 96
      const next = []
      for (let r = 0; r < rows; r++) {
        const t = r / (rows - 1)
        const z = Z_NEAR + (Z_FAR - Z_NEAR) * Math.pow(t, 1.35)
        for (let c = 0; c < cols; c++) {
          next.push({
            u: (c + Math.random()) / cols - 0.5,
            z: z + (Math.random() - 0.5) * 0.35,
            jx: (Math.random() - 0.5) * 0.02,
            seed: Math.random(),
          })
        }
      }
      points.current = next

      const poleY = -height * 1.1
      const rMin = height * 1.1
      const rMax = height * 1.67
      const span = Math.asin(Math.min(1, (width / 2 + 30) / rMin))
      sky.current = { poleY, rMin, rMax, span }
      const sector = span * (rMax * rMax - rMin * rMin)
      const visible = width * height * 0.55
      const starCount = Math.round(((width * height) / (isSmall ? 5200 : 7800)) * (sector / visible))
      const radiusAt = () => Math.sqrt(rMin * rMin + Math.random() * (rMax * rMax - rMin * rMin))

      const field = Array.from({ length: starCount }, () => ({
        x: 0,
        y: 0,
        r: Math.random() < 0.08 ? 1.3 : 0.7,
        phase: Math.random() * Math.PI * 2,
        angle: (Math.random() * 2 - 1) * span,
        radius: radiusAt(),
        speed: 0.45 + Math.random() * 1.1,
        depth: 0.2 + Math.random() * 0.8,
        alpha: 0.85,
      }))

      // Via Láctea: estrelas tênues concentradas numa faixa diagonal.
      const dust = Math.round(starCount * 0.6)
      for (let i = 0; i < dust; i++) {
        const radius = radiusAt()
        const t = (radius - rMin) / (rMax - rMin)
        const scatter = (Math.random() + Math.random() + Math.random() - 1.5) * 0.09
        field.push({
          x: 0,
          y: 0,
          r: 0.6,
          phase: Math.random() * Math.PI * 2,
          angle: BAND_ANGLE + (t - 0.5) * 0.55 + scatter,
          radius,
          speed: 0.3 + Math.random() * 0.8,
          depth: 0.1,
          alpha: 0.3 + Math.random() * 0.25,
        })
      }

      stars.current = field
      buckets.current = Array.from({ length: BUCKETS }, () => [])
      figures.current = []
      traces.current = []
    },
    ({ ctx, width, height, time, pointer, isSmall }) => {
      clock.current = time
      const mode = effect.current
      const dot = cssRgb(ctx.canvas, '--particle-rgb', '245, 245, 245')
      const starRgb = cssRgb(ctx.canvas, '--particle-star-rgb', '240, 240, 240')
      const horizon = height * (isSmall ? 0.66 : 0.62)
      const focal = Math.min(width, height * 1.6) * (isSmall ? 1.05 : 0.82)
      const camY = 1.55 + pointer.y * 0.12
      const sway = pointer.x * 0.8
      const travel = time * 0.55
      const cx = width / 2

      // --- Céu ---------------------------------------------------------------
      const { poleY, rMin, rMax, span } = sky.current
      const turn = time * SKY_SPEED
      const wrap = (a) => {
        const w = span * 2
        return ((((a + span) % w) + w) % w) - span
      }

      for (let k = 0; k < 5; k++) {
        const t = k / 4
        const radius = rMin + t * (rMax - rMin)
        const a = wrap(BAND_ANGLE + (t - 0.5) * 0.55 + turn)
        const gx = cx + radius * Math.sin(a)
        const gy = poleY + radius * Math.cos(a)
        const reach = height * 0.2
        if (gx < -reach || gx > width + reach) continue
        const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, reach)
        glow.addColorStop(0, `rgba(${starRgb}, 0.022)`)
        glow.addColorStop(1, `rgba(${starRgb}, 0)`)
        ctx.fillStyle = glow
        ctx.fillRect(gx - reach, gy - reach, reach * 2, reach * 2)
      }

      for (const s of stars.current) {
        const a = wrap(s.angle + turn)
        s.x = (cx + s.radius * Math.sin(a) + pointer.x * s.depth * 6) / width
        s.y = (poleY + s.radius * Math.cos(a) + pointer.y * s.depth * 3) / height
      }

      const lit = mode === 'constelacoes' ? updateConstellations(width, height, time, isSmall) : null
      for (let i = 0; i < stars.current.length; i++) {
        const s = stars.current[i]
        const x = s.x * width
        const y = s.y * height
        if (x < -2 || x > width + 2 || y < -2) continue
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.speed + s.phase))
        const boost = lit?.get(i) ?? 0
        ctx.fillStyle = `rgba(${starRgb}, ${Math.min(1, s.alpha * twinkle + boost)})`
        const r = s.r + boost * 0.9
        ctx.fillRect(x - (r - s.r) / 2, y - (r - s.r) / 2, r, r)
      }
      if (lit) drawConstellations(ctx, width, height, time, starRgb)
      drawMeteor(ctx, width, height, time, starRgb)

      // --- Efeitos da areia --------------------------------------------------
      const rippleList = ripples.current
      if (mode === 'ondas') {
        for (const tap of taps.current.splice(0)) {
          if (tap.y < horizon + 6) continue
          const z = Math.min(32, Math.max(2.5, (camY * focal * 0.55) / (tap.y - horizon)))
          rippleList.push({ x: ((tap.x - cx) * z) / focal + sway * 0.15, z, start: time, strength: 1 })
        }
        if (time >= nextRipple.current) {
          const z = 6 + Math.random() * 16
          const u = (Math.random() - 0.5) * 0.6
          rippleList.push({ x: ((u * (width / 2) * z) / focal) * 2.3, z, start: time, strength: 1 })
          nextRipple.current = time + 5 + Math.random() * 3
        }
      }
      for (let i = rippleList.length - 1; i >= 0; i--) {
        if (time - rippleList[i].start > RIPPLE_LIFE) rippleList.splice(i, 1)
      }
      if (rippleList.length > 5) rippleList.splice(0, rippleList.length - 5)

      const trail = traces.current
      let box = null
      if (mode === 'rastro') {
        if (time - lastMove.current > 3.5) {
          const wx = cx + width * 0.4 * Math.sin(time * 0.21) * Math.cos(time * 0.07)
          const wy = horizon + (height - horizon) * (0.42 + 0.28 * Math.sin(time * 0.33 + 1.1))
          pushTrace(trail, wx, wy, time)
        }
        while (trail.length && time - trail[0].t > TRACE_LIFE) trail.shift()
        if (trail.length) {
          box = [Infinity, Infinity, -Infinity, -Infinity]
          for (const n of trail) {
            box[0] = Math.min(box[0], n.x - 90)
            box[1] = Math.min(box[1], n.y - 90)
            box[2] = Math.max(box[2], n.x + 90)
            box[3] = Math.max(box[3], n.y + 90)
          }
        }
      }

      // --- Dunas -------------------------------------------------------------
      const lists = buckets.current
      for (const list of lists) list.length = 0

      for (const p of points.current) {
        const halfSpan = ((width / 2) * p.z) / focal
        const x = (p.u + p.jx) * halfSpan * 2.3
        const h = terrainHeight(x + sway, p.z, travel)
        let sx = cx + ((x - sway * 0.15) * focal) / p.z
        if (sx < -2 || sx > width + 2) continue
        let sy = horizon + (((camY - h) * focal) / p.z) * 0.55
        let glow = 0

        if (rippleList.length) {
          for (const r of rippleList) {
            const age = time - r.start
            const dx = x - r.x
            const dz = p.z - r.z
            const d = Math.sqrt(dx * dx + dz * dz) - age * RIPPLE_SPEED
            if (d > 4 || d < -4) continue
            const damp = Math.exp(-age * 0.3) / (1 + age * RIPPLE_SPEED * 0.06)
            const wave = Math.exp(-(d * d) / 3.2) * Math.cos(d * 2.4) * damp * r.strength
            sy -= wave * 20 * (1 - 0.45 * (p.z / Z_FAR))
            if (wave > 0) glow += wave
          }
        }

        if (box && sx > box[0] && sx < box[2] && sy > box[1] && sy < box[3]) {
          let pushX = 0
          let pushY = 0
          for (const n of trail) {
            const a = (time - n.t) / TRACE_LIFE
            const radius = (isSmall ? 40 : 54) + 40 * a
            const dx = sx - n.x
            const dy = sy - n.y
            if (dx > radius || dx < -radius || dy > radius || dy < -radius) continue
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            if (dist >= radius) continue
            const f = (1 - dist / radius) ** 2 * (1 - a) ** 2
            pushX += (dx / dist) * f
            pushY += (dy / dist) * f
            glow += f * 1.1
          }
          sx += Math.max(-1.5, Math.min(1.5, pushX)) * 22
          sy += Math.max(-1.5, Math.min(1.5, pushY)) * 12 - Math.min(1, glow) * 5
        }
        if (sy < 0 || sy > height + 2) continue

        const depth = 1 - p.z / Z_FAR
        const fog = Math.min(1, depth * 1.35)
        const crest = Math.min(1, h / 4)
        const light =
          0.12 +
          0.6 * fog * (0.55 + 0.45 * crest) +
          0.28 * p.seed * fog +
          Math.min(0.6, glow) * (0.5 + 0.5 * p.seed)
        const bucket = Math.min(BUCKETS - 1, Math.floor(light * BUCKETS))
        const size = Math.max(0.6, Math.min(2.1, 2.4 / Math.sqrt(p.z))) * (1 + Math.min(1, glow) * 0.9)
        lists[bucket].push(sx, sy, size)
      }

      for (let b = 0; b < BUCKETS; b++) {
        const list = lists[b]
        if (!list.length) continue
        ctx.fillStyle = `rgba(${dot}, ${((b + 1) / BUCKETS) * 0.85})`
        for (let i = 0; i < list.length; i += 3) {
          ctx.fillRect(list[i], list[i + 1], list[i + 2], list[i + 2])
        }
      }
    },
  )

  function drawMeteor(ctx, width, height, time, rgb) {
    if (time >= nextMeteor.current) {
      const angle = Math.PI * (0.12 + Math.random() * 0.1)
      const side = Math.random() < 0.5 ? -1 : 1
      meteor.current = {
        x: width * (0.15 + Math.random() * 0.7),
        y: height * (0.04 + Math.random() * 0.22),
        dx: Math.cos(angle) * side,
        dy: Math.sin(angle),
        length: Math.min(width * 0.16, 200),
        start: time,
      }
      nextMeteor.current = time + 14 + Math.random() * 14
    }
    const m = meteor.current
    if (!m) return
    const t = (time - m.start) / METEOR_LIFE
    if (t < 0 || t > 1) return
    const travel = m.length * (1 - Math.pow(1 - t, 3))
    const hx = m.x + m.dx * travel
    const hy = m.y + m.dy * travel
    const tail = m.length * 0.45 * (1 - 0.5 * t)
    const fade = Math.sin(Math.PI * t)
    const streak = ctx.createLinearGradient(hx, hy, hx - m.dx * tail, hy - m.dy * tail)
    streak.addColorStop(0, `rgba(${rgb}, ${0.6 * fade})`)
    streak.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.strokeStyle = streak
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(hx, hy)
    ctx.lineTo(hx - m.dx * tail, hy - m.dy * tail)
    ctx.stroke()
  }

  function updateConstellations(width, height, time, isSmall) {
    const list = figures.current
    for (let i = list.length - 1; i >= 0; i--) {
      if (time - list[i].start > figureLength(list[i]) + CONSTELLATION_HOLD + CONSTELLATION_FADE) {
        list.splice(i, 1)
      }
    }
    if (time >= nextFigure.current && list.length < 2) {
      const used = new Set(list.flatMap((f) => f.stars))
      const figure = buildConstellation(stars.current, width, height, used, isSmall)
      if (figure) list.push({ ...figure, start: time })
      nextFigure.current = time + 4.5 + Math.random() * 2.5
    }

    const lit = new Map()
    for (const f of list) {
      const alpha = figureAlpha(f, time)
      const reached = (time - f.start) / SEGMENT_TIME
      f.stars.forEach((star, order) => {
        const on = order === 0 ? 1 : Math.min(1, Math.max(0, reached - (order - 1)))
        lit.set(star, Math.max(lit.get(star) ?? 0, 0.55 * on * alpha))
      })
    }
    return lit
  }

  function drawConstellations(ctx, width, height, time, rgb) {
    ctx.lineWidth = 0.7
    for (const f of figures.current) {
      const alpha = figureAlpha(f, time)
      const progress = (time - f.start) / SEGMENT_TIME
      ctx.strokeStyle = `rgba(${rgb}, ${0.32 * alpha})`
      ctx.beginPath()
      f.edges.forEach(([from, to], i) => {
        const t = Math.min(1, Math.max(0, progress - i))
        if (t <= 0) return
        const a = stars.current[from]
        const b = stars.current[to]
        const ax = a.x * width
        const ay = a.y * height
        const ease = 1 - Math.pow(1 - t, 3)
        ctx.moveTo(ax, ay)
        ctx.lineTo(ax + (b.x * width - ax) * ease, ay + (b.y * height - ay) * ease)
      })
      ctx.stroke()

      ctx.strokeStyle = `rgba(${rgb}, ${0.22 * alpha})`
      ctx.beginPath()
      f.stars.forEach((star, order) => {
        if (progress < order) return
        const s = stars.current[star]
        ctx.moveTo(s.x * width + 4, s.y * height)
        ctx.arc(s.x * width, s.y * height, 4, 0, Math.PI * 2)
      })
      ctx.stroke()

      const labelAlpha = Math.min(1, Math.max(0, progress - f.edges.length)) * alpha
      if (labelAlpha > 0) {
        let left = Infinity
        let right = -Infinity
        let bottom = -Infinity
        for (const star of f.stars) {
          left = Math.min(left, stars.current[star].x * width)
          right = Math.max(right, stars.current[star].x * width)
          bottom = Math.max(bottom, stars.current[star].y * height)
        }
        ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(${rgb}, ${0.45 * labelAlpha})`
        const labelX = Math.min(width - 70, Math.max(70, (left + right) / 2))
        ctx.fillText(f.label, labelX, bottom + 18)
        ctx.textAlign = 'start'
      }
    }
  }

  useEffect(() => {
    effect.current = effectFromUrl()
    const canvas = canvasRef.current
    if (!canvas) return

    const local = (event) => {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      return x < 0 || y < 0 || x > rect.width || y > rect.height ? null : { x, y }
    }

    const onDown = (event) => {
      if (effect.current !== 'ondas') return
      if (event.target?.closest?.('a, button, input, textarea, select, [role="button"]')) return
      const at = local(event)
      if (at) taps.current.push(at)
    }

    const onMove = (event) => {
      if (effect.current !== 'rastro') return
      const at = local(event)
      if (!at) return
      lastMove.current = clock.current
      pushTrace(traces.current, at.x, at.y, clock.current)
    }

    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
    }
  }, [canvasRef])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

function pushTrace(trail, x, y, t) {
  const last = trail[trail.length - 1]
  if (last && Math.hypot(x - last.x, y - last.y) < 7) return
  trail.push({ x, y, t })
  if (trail.length > 48) trail.shift()
}

function figureLength(f) {
  return (f.edges.length + 1) * SEGMENT_TIME
}

function figureAlpha(f, time) {
  const fadeStart = f.start + figureLength(f) + CONSTELLATION_HOLD
  return time < fadeStart ? 1 : Math.max(0, 1 - (time - fadeStart) / CONSTELLATION_FADE)
}

function buildConstellation(stars, width, height, used, isSmall) {
  const free = (i) => {
    if (used.has(i)) return false
    const x = stars[i].x * width
    const y = stars[i].y * height
    const nearMoon = Math.hypot(x - width / 2, y - height * 0.22) < 70
    const behindTitle = Math.abs(x - width / 2) < width * (isSmall ? 0.5 : 0.36) && y > height * 0.32
    return !nearMoon && !behindTitle && x > 24 && x < width - 24 && y > 70
  }

  const candidates = stars.map((_, i) => i).filter(free)
  const reach = Math.max(60, Math.min(width * 0.11, 150))

  for (let attempt = 0; attempt < 8; attempt++) {
    const first = candidates[Math.floor(Math.random() * candidates.length)]
    if (first === undefined) return null
    const chosen = [first]
    const edges = []
    const target = 4 + Math.floor(Math.random() * 4)

    while (chosen.length < target) {
      let best = -1
      let from = -1
      let bestDist = Infinity
      for (const c of candidates) {
        if (chosen.includes(c)) continue
        for (let k = 0; k < chosen.length; k++) {
          const a = stars[chosen[k]]
          const d = Math.hypot((stars[c].x - a.x) * width, (stars[c].y - a.y) * height)
          const bias = k === chosen.length - 1 ? 0.8 : 1
          if (d > 24 && d < reach && d * bias < bestDist) {
            bestDist = d * bias
            best = c
            from = chosen[k]
          }
        }
      }
      if (best < 0) break
      chosen.push(best)
      edges.push([from, best])
    }

    if (chosen.length >= 4) {
      const head = stars[first]
      const ra = Math.floor(head.x * 24)
      const minutes = Math.floor((head.x * 24 - ra) * 60)
      const dec = Math.round(60 - head.y * 160)
      const label = `AR ${ra}h${String(minutes).padStart(2, '0')}m · δ ${dec >= 0 ? '+' : '−'}${Math.abs(dec)}°`
      return { stars: chosen, edges, label }
    }
  }
  return null
}
