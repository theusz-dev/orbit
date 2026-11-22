import { useEffect, useRef, useState } from 'react'
import useStore from '../store/useStore'
import { resolveMotion, watchSystemMotion } from '../utils/motion'
import {
  SPRITE_W,
  SPRITE_H,
  SPRITE_CX,
  SPRITE_CY,
  SUN_DIR,
  buildLeafAtlas,
  sampleWind,
  leafBasis3D,
} from '../utils/herbarioLeaves'

// Vetor meio-termo entre o observador (0, 0, 1) e o sol para brilho especular
// da cutícula cerosa das folhas ao girar na brisa.
const HALF_LEN = Math.hypot(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z + 1)
const HALF_VEC = {
  x: SUN_DIR.x / HALF_LEN,
  y: SUN_DIR.y / HALF_LEN,
  z: (SUN_DIR.z + 1) / HALF_LEN,
}

const MARGIN = 135
const MOUSE_RADIUS = 190

const rand = (min, max) => min + Math.random() * (max - min)

function targetLeafCount(width, height) {
  const area = width * height
  if (width < 720) return 13
  return Math.max(18, Math.min(26, Math.round(area / 56000)))
}

function targetMoteCount(width) {
  return width < 720 ? 18 : 34
}

function createLeaf(width, height, atlas, scatter, index = 0, total = 1) {
  const specIndex = scatter
    ? (index + Math.floor(Math.random() * 3)) % atlas.length
    : Math.floor(Math.random() * atlas.length)
  const spec = atlas[specIndex]

  // Distribuição natural em profundidade: maioria no plano médio, algumas ao
  // fundo (menores, suaves) e raras maiores e mais próximas da mesa/observador.
  const r = Math.random()
  let depth
  if (r < 0.28) depth = rand(0.1, 0.34)
  else if (r < 0.82) depth = rand(0.36, 0.78)
  else depth = rand(0.8, 1.0)

  const scale = 0.33 + depth * 0.39
  const baseOpacity = depth < 0.34 ? rand(0.54, 0.7) : depth < 0.8 ? rand(0.78, 0.92) : rand(0.76, 0.88)

  let x
  let y
  if (scatter) {
    // Distribuição estratificada na abertura para haver folhas em toda a prancha
    // (inclusive nas margens do relógio e cantos superiores), sem aglomerar.
    const cols = Math.max(4, Math.ceil(Math.sqrt(total * (width / Math.max(height, 1)))))
    const rows = Math.max(3, Math.ceil(total / cols))
    const col = index % cols
    const row = Math.floor(index / cols) % rows
    x = ((col + rand(0.12, 0.88)) / cols) * width
    y = ((row + rand(0.12, 0.88)) / rows) * height
  } else if (Math.random() < 0.68) {
    // Entra pela borda esquerda carregada pela brisa predominante.
    x = -rand(55, MARGIN)
    y = rand(-height * 0.12, height * 0.88)
  } else {
    // Entra pela borda superior descendo suavemente na diagonal.
    x = rand(-width * 0.08, width * 0.86)
    y = -rand(55, MARGIN)
  }

  // Altitude (px acima do papel) controla distância e suavidade da sombra projetada.
  const baseAlt = 16 + depth * 54 + rand(-5, 12)

  // Inicia com ângulos aerodinamicamente estáveis (face superior ou verso
  // voltados ao ar), evitando folhas presas de perfil na abertura.
  const initialFlip = Math.random() < 0.3 ? Math.PI : 0

  return {
    specIndex,
    depth,
    scale,
    baseOpacity,
    weight: spec.weight * rand(0.88, 1.14),
    x,
    y,
    vx: rand(24, 48) * (0.72 + depth * 0.48),
    vy: rand(6, 16) * (0.72 + depth * 0.48),
    alt: baseAlt,
    baseAlt,
    yaw: rand(0, Math.PI * 2),
    pitch: rand(-0.42, 0.42),
    roll: initialFlip + rand(-0.55, 0.55),
    vYaw: rand(-0.2, 0.2),
    vPitch: rand(-0.26, 0.26),
    vRoll: rand(-0.35, 0.35),
    // Personalidade aerodinâmica (balanço, frequência de flutuação e giro).
    flutterFreq: rand(0.85, 1.65),
    flutterAmp: rand(0.32, 0.68),
    tumbleBias: (Math.random() < 0.5 ? -1 : 1) * rand(0.18, 0.52),
    phase: rand(0, Math.PI * 2),
    phase2: rand(0, Math.PI * 2),
    fadeIn: scatter ? 1 : 0,
  }
}

function createMote(width, height, scatter) {
  return {
    x: scatter ? rand(0, width) : -rand(10, 60),
    y: rand(0, height),
    r: rand(0.75, 1.75),
    alpha: rand(0.16, 0.38),
    depth: rand(0.35, 1.0),
    phase: rand(0, Math.PI * 2),
    speed: rand(0.6, 1.4),
  }
}

export default function HerbarioLeaves() {
  const motionMode = useStore((state) => state.motionMode)
  const [reduced, setReduced] = useState(() => resolveMotion(motionMode) === 'reduced')
  const canvasRef = useRef(null)

  useEffect(() => {
    const sync = () => setReduced(resolveMotion(motionMode) === 'reduced')
    sync()
    return watchSystemMotion(sync)
  }, [motionMode])

  useEffect(() => {
    if (reduced) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const atlas = buildLeafAtlas()

    let width = window.innerWidth
    let height = window.innerHeight
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    const leaves = []
    const motes = []

    const syncCounts = (scatter) => {
      const wantLeaves = targetLeafCount(width, height)
      while (leaves.length < wantLeaves) {
        leaves.push(createLeaf(width, height, atlas, scatter, leaves.length, wantLeaves))
      }
      if (leaves.length > wantLeaves + 3) {
        leaves.length = wantLeaves
      }
      leaves.sort((a, b) => a.depth - b.depth)

      const wantMotes = targetMoteCount(width)
      while (motes.length < wantMotes) {
        motes.push(createMote(width, height, scatter))
      }
      if (motes.length > wantMotes) {
        motes.length = wantMotes
      }
    }

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      syncCounts(leaves.length === 0)
    }

    resize()

    // Sopro sutil do cursor: mover o mouse desloca suavemente o ar em torno
    // das folhas próximas, como passar a mão acima de folhas secas na mesa.
    const wake = {
      x: -9999,
      y: -9999,
      vx: 0,
      vy: 0,
      lastX: 0,
      lastY: 0,
      lastAt: 0,
      seen: false,
    }

    const onPointerMove = (e) => {
      if (e.pointerType !== 'mouse') return
      const now = performance.now()
      const x = e.clientX
      const y = e.clientY
      if (!wake.seen) {
        wake.seen = true
        wake.lastX = x
        wake.lastY = y
        wake.lastAt = now
        wake.x = x
        wake.y = y
        return
      }
      const dt = Math.max((now - wake.lastAt) / 1000, 0.012)
      const rawVx = (x - wake.lastX) / dt
      const rawVy = (y - wake.lastY) / dt
      // Suaviza e limita o impulso para nunca parecer agitado.
      wake.vx = Math.max(-280, Math.min(280, wake.vx * 0.45 + rawVx * 0.55))
      wake.vy = Math.max(-280, Math.min(280, wake.vy * 0.45 + rawVy * 0.55))
      wake.x = x
      wake.y = y
      wake.lastX = x
      wake.lastY = y
      wake.lastAt = now
    }

    const drawHalf = (spec, leafAlpha, vAxis, eY, normal, side, x, y, scale) => {
      // Face voltada ao observador (+Z): superior (adaxial) ou verso (abaxial).
      const front = normal.z >= 0
      const nx = front ? normal.x : -normal.x
      const ny = front ? normal.y : -normal.y
      const nz = front ? normal.z : -normal.z

      // Incidência solar e brilho especular da cutícula em tempo real.
      const sunDot = nx * SUN_DIR.x + ny * SUN_DIR.y + nz * SUN_DIR.z
      const halfDot = Math.max(0, nx * HALF_VEC.x + ny * HALF_VEC.y + nz * HALF_VEC.z)
      const specStrength = (front ? 0.34 : 0.09) * Math.pow(halfDot, 5.5)
      const shadeStrength = sunDot < 0.45 ? Math.min(0.28, (0.45 - sunDot) * 0.28) : 0

      // Projeção 3D exata da metade da folha via matriz afim 2D.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.transform(
        vAxis.x * scale,
        vAxis.y * scale,
        eY.x * scale,
        eY.y * scale,
        x,
        y,
      )

      const img = front ? spec.top : spec.bot
      // Sobreposição de 1px na nervura central (x = 0) evita fenda de antialias.
      const sx = side < 0 ? 0 : SPRITE_CX - 1
      const sw = side < 0 ? SPRITE_CX + 1 : SPRITE_W - SPRITE_CX + 1
      const dx = side < 0 ? -SPRITE_CX : -1

      ctx.globalAlpha = leafAlpha
      ctx.drawImage(img, sx, 0, sw, SPRITE_H, dx, -SPRITE_CY, sw, SPRITE_H)

      if (shadeStrength > 0.015) {
        ctx.globalAlpha = leafAlpha * shadeStrength
        ctx.drawImage(spec.shadeMask, sx, 0, sw, SPRITE_H, dx, -SPRITE_CY, sw, SPRITE_H)
      }

      if (specStrength > 0.015) {
        ctx.globalAlpha = leafAlpha * specStrength
        ctx.drawImage(spec.specMask, sx, 0, sw, SPRITE_H, dx, -SPRITE_CY, sw, SPRITE_H)
      }
    }

    let raf = 0
    let simTime = rand(10, 80)
    let lastTime = performance.now()

    const step = (dt) => {
      simTime += dt

      // Dissipa o sopro do cursor rapidamente quando o mouse para.
      const wakeDecay = Math.exp(-dt * 5.5)
      wake.vx *= wakeDecay
      wake.vy *= wakeDecay
      const wakeSpeed = Math.hypot(wake.vx, wake.vy)

      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i]
        const spec = atlas[leaf.specIndex]
        const parallax = 0.66 + leaf.depth * 0.56
        const wind = sampleWind(leaf.x, leaf.y, simTime)

        // Oscilação aerodinâmica natural (flutter pendular da folha no ar).
        const flutter = Math.sin(simTime * leaf.flutterFreq + leaf.phase)
        const flutterCos = Math.cos(simTime * leaf.flutterFreq + leaf.phase)
        const slowWave = Math.sin(simTime * 0.42 + leaf.phase2)

        // Sustentação acoplada à inclinação: folhas mais planas planam mais,
        // folhas inclinadas deslizam suavemente para baixo em arcos orgânicos.
        const flatFactor = Math.abs(Math.cos(leaf.pitch) * Math.cos(leaf.roll))
        const glideLift = (0.35 + flatFactor * 0.65) * wind.gust * 8.5

        const targetVx = (wind.vx + flutter * 12 * leaf.flutterAmp) * parallax
        const targetVy = (wind.vy + 11 * leaf.weight - glideLift + flutterCos * 9.5 * leaf.flutterAmp) * parallax

        // Arrasto exponencial suave — a folha responde ao vento com inércia real.
        const drag = 1 - Math.exp(-dt * (1.35 / leaf.weight))
        leaf.vx += (targetVx - leaf.vx) * drag
        leaf.vy += (targetVy - leaf.vy) * drag

        // Influência sutil do rastro de ar do cursor.
        if (wakeSpeed > 18) {
          const dx = leaf.x - wake.x
          const dy = leaf.y - wake.y
          const dist = Math.hypot(dx, dy)
          if (dist < MOUSE_RADIUS) {
            const influence = Math.pow(1 - dist / MOUSE_RADIUS, 2) * (0.45 + leaf.depth * 0.55)
            leaf.vx += wake.vx * influence * dt * 0.85
            leaf.vy += wake.vy * influence * dt * 0.85
            leaf.vRoll += (wake.vx * 0.008 - wake.vy * 0.005) * influence * dt * 2.2
            leaf.vPitch += (wake.vy * 0.006) * influence * dt * 1.8
          }
        }

        leaf.x += leaf.vx * dt
        leaf.y += leaf.vy * dt

        // Altitude respira com correntes ascendentes — aproxima e afasta a sombra do papel.
        const targetAlt = Math.max(12, Math.min(96, leaf.baseAlt + wind.updraft * 16 + slowWave * 9))
        leaf.alt += (targetAlt - leaf.alt) * (1 - Math.exp(-dt * 1.1))

        // Dinâmica angular 3D: balanço suave + torque aerodinâmico de placa plana
        // (-sin(2*roll)) que faz a folha planar mais tempo com a lâmina aberta e
        // virar com fluidez ao passar de perfil durante rajadas.
        const flatRestore = -Math.sin(2 * leaf.roll) * 0.55
        const desiredRollRate =
          leaf.tumbleBias * (0.38 + wind.gust * 0.68) +
          flutterCos * 0.68 * leaf.flutterAmp +
          flatRestore
        const desiredPitchRate = Math.sin(simTime * leaf.flutterFreq * 0.72 + leaf.phase2) * 0.56 * leaf.flutterAmp
        const desiredYawRate = 0.14 * flutter + 0.09 * slowWave + (wind.vx > 42 ? 0.14 * Math.sign(leaf.tumbleBias) : 0)

        const angBlend = 1 - Math.exp(-dt * 2.2)
        leaf.vRoll += (desiredRollRate - leaf.vRoll) * angBlend
        leaf.vPitch += (desiredPitchRate - leaf.vPitch) * angBlend
        leaf.vYaw += (desiredYawRate - leaf.vYaw) * angBlend

        leaf.roll += leaf.vRoll * dt
        // Pitch oscila amplamente mas com restauração suave para manter o
        // planeio elegante (folhas leves tombam um pouco mais).
        leaf.pitch += leaf.vPitch * dt - leaf.pitch * dt * (0.36 * spec.weight)
        leaf.yaw += leaf.vYaw * dt

        if (leaf.fadeIn < 1) {
          leaf.fadeIn = Math.min(1, leaf.fadeIn + dt * 0.7)
        }

        // Recicla a folha suavemente quando sai pelos limites da tela.
        if (leaf.x > width + MARGIN || leaf.y > height + MARGIN || leaf.x < -MARGIN * 1.6 || leaf.y < -MARGIN * 1.6) {
          const recycled = createLeaf(width, height, atlas, false)
          // Mantém o mesmo plano de profundidade para preservar a ordenação.
          recycled.depth = leaf.depth
          recycled.scale = leaf.scale
          recycled.baseOpacity = leaf.baseOpacity
          recycled.baseAlt = leaf.baseAlt
          recycled.alt = leaf.baseAlt
          leaves[i] = recycled
        }
      }

      // Poeira botânica / pólen ao sol seguindo o mesmo campo de vento.
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i]
        const wind = sampleWind(m.x, m.y, simTime)
        m.x += (wind.vx * 0.52 + Math.sin(simTime * 0.9 + m.phase) * 5) * m.depth * dt
        m.y += (wind.vy * 0.42 + Math.cos(simTime * 0.7 + m.phase) * 4.5) * m.depth * dt
        if (m.x > width + 20) {
          m.x = -15
          m.y = rand(0, height)
        } else if (m.y > height + 20) {
          m.y = -15
          m.x = rand(0, width)
        } else if (m.y < -20) {
          m.y = height + 15
        }
      }
    }

    const render = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // 1. Grãos minúsculos de pólen / fibra dourada dançando na luz solar.
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i]
        const glint = 0.5 + 0.5 * Math.sin(simTime * m.speed + m.phase)
        const a = m.alpha * (0.5 + 0.5 * glint)
        if (m.r > 1.25) {
          ctx.fillStyle = `rgba(205, 168, 88, ${(a * 0.28).toFixed(3)})`
          ctx.beginPath()
          ctx.arc(m.x, m.y, m.r * 2.3, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = `rgba(176, 138, 64, ${a.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Pré-calcula a base 3D de cada folha para reutilizar na sombra e nas duas metades.
      const bases = new Array(leaves.length)
      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i]
        bases[i] = leafBasis3D(leaf.yaw, leaf.pitch, leaf.roll)
      }

      // 2. Passada de sombras projetadas sobre o papel algodão (todas abaixo de
      // todas as folhas — distância e suavidade respondem à altitude da folha).
      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i]
        const spec = atlas[leaf.specIndex]
        const { eX, eY } = bases[i]

        const sx = leaf.x + leaf.alt * 0.34
        const sy = leaf.y + leaf.alt * 0.48
        const penumbra = leaf.scale * (1 + leaf.alt * 0.0032)
        const shadowAlpha = leaf.baseOpacity * leaf.fadeIn * (0.19 / (1 + leaf.alt * 0.011))
        if (shadowAlpha < 0.012) continue

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.transform(
          eX.x * penumbra,
          eX.y * penumbra,
          eY.x * penumbra,
          eY.y * penumbra,
          sx,
          sy,
        )
        ctx.globalAlpha = shadowAlpha
        ctx.drawImage(spec.shadow, -SPRITE_CX, -SPRITE_CY)
      }

      // 3. Passada das folhas (ordenadas do fundo para a frente, com dobra 3D
      // em diedro ao longo da nervura central e iluminação solar em tempo real).
      for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i]
        const spec = atlas[leaf.specIndex]
        const { eX, eY, eZ } = bases[i]
        const leafAlpha = leaf.baseOpacity * leaf.fadeIn

        const cosD = Math.cos(spec.dihedral)
        const sinD = Math.sin(spec.dihedral)

        // Metade direita (x > 0): sobe em direção a +eZ (forma calha suave).
        const vR = {
          x: eX.x * cosD + eZ.x * sinD,
          y: eX.y * cosD + eZ.y * sinD,
          z: eX.z * cosD + eZ.z * sinD,
        }
        const nR = {
          x: eZ.x * cosD - eX.x * sinD,
          y: eZ.y * cosD - eX.y * sinD,
          z: eZ.z * cosD - eX.z * sinD,
        }

        // Metade esquerda (x < 0): também sobe em direção a +eZ.
        const vL = {
          x: eX.x * cosD - eZ.x * sinD,
          y: eX.y * cosD - eZ.y * sinD,
          z: eX.z * cosD - eZ.z * sinD,
        }
        const nL = {
          x: eZ.x * cosD + eX.x * sinD,
          y: eZ.y * cosD + eX.y * sinD,
          z: eZ.z * cosD + eX.z * sinD,
        }

        // Painter's order entre as duas metades: desenha primeiro a mais distante.
        const rightDepth = vR.z
        const leftDepth = -vL.z

        if (leftDepth < rightDepth) {
          drawHalf(spec, leafAlpha, vL, eY, nL, -1, leaf.x, leaf.y, leaf.scale)
          drawHalf(spec, leafAlpha, vR, eY, nR, 1, leaf.x, leaf.y, leaf.scale)
        } else {
          drawHalf(spec, leafAlpha, vR, eY, nR, 1, leaf.x, leaf.y, leaf.scale)
          drawHalf(spec, leafAlpha, vL, eY, nL, -1, leaf.x, leaf.y, leaf.scale)
        }
      }

      ctx.globalAlpha = 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const tick = (now) => {
      if (document.hidden) {
        raf = 0
        return
      }
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      step(dt)
      render()
      raf = requestAnimationFrame(tick)
    }

    const startLoop = () => {
      if (raf || document.hidden) return
      lastTime = performance.now()
      raf = requestAnimationFrame(tick)
    }

    let resizeTimer = 0
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(resize, 150)
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else {
        startLoop()
      }
    }

    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    startLoop()

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reduced])

  if (reduced) return null

  return (
    <canvas
      ref={canvasRef}
      className="herbario-leaves"
      data-decorative
      aria-hidden="true"
    />
  )
}
