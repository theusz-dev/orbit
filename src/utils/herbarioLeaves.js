// Gerador procedural de espécimes botânicos e física aerodinâmica de vento
// para o tema Herbário · Naturalista.
//
// Cada espécie é pintada uma única vez em canvases offscreen de alta resolução
// (face superior adaxial, verso abaxial mais pálido/prateado, brilho especular
// da cutícula, máscara de sombra própria e sombra projetada já suavizada).
// No loop de animação, cada folha é dobrada em V ao longo da nervura central
// (diedro natural) e projetada em 3D por matrizes afins — zero blur por frame.

export const SPRITE_W = 160
export const SPRITE_H = 200
export const SPRITE_CX = SPRITE_W / 2
export const SPRITE_CY = SPRITE_H / 2

// Direção da luz solar morna (topo-esquerda-frente), coerente com o gradiente
// dourado do papel do tema Herbário.
const SUN_LEN = Math.hypot(-0.3, -0.44, 0.85)
export const SUN_DIR = {
  x: -0.3 / SUN_LEN,
  y: -0.44 / SUN_LEN,
  z: 0.85 / SUN_LEN,
}

// PRNG determinístico simples (Mulberry32) para que cada espécime do atlas
// mantenha sua textura natural sem variar aleatoriamente de forma brusca.
function createRng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas(w = SPRITE_W, h = SPRITE_H) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

// Catálogo de 12 espécimes (6 espécies botânicas × 2 variações de pigmentação
// naturalista: verde-sálvia vivo, oliva prensado, ocre de outono e ouro ginkgo).
const SPECIMENS = [
  {
    id: 'laurel-sage',
    species: 'laurel',
    seed: 101,
    dihedral: 0.2,
    weight: 1.0,
    top: ['#355c44', '#4d7857', '#6c9268'],
    edge: '#7f9a66',
    bot: ['#8da389', '#a5b59d', '#b8c3ad'],
    veinTop: 'rgba(218, 228, 194, 0.5)',
    veinBot: 'rgba(236, 238, 220, 0.68)',
    stem: '#5b5239',
    mottle: ['rgba(184, 146, 70, 0.16)', 'rgba(52, 82, 56, 0.14)', 'rgba(138, 100, 52, 0.1)'],
  },
  {
    id: 'laurel-olive',
    species: 'laurel',
    seed: 207,
    dihedral: 0.22,
    weight: 1.05,
    top: ['#4b6343', '#6b8252', '#8e965d'],
    edge: '#a69658',
    bot: ['#9da689', '#b4ba9c', '#c3c6ac'],
    veinTop: 'rgba(228, 226, 188, 0.48)',
    veinBot: 'rgba(238, 234, 208, 0.65)',
    stem: '#66563b',
    mottle: ['rgba(176, 134, 62, 0.2)', 'rgba(84, 96, 52, 0.15)', 'rgba(130, 80, 44, 0.12)'],
  },
  {
    id: 'serrated-woodland',
    species: 'serrated',
    seed: 313,
    dihedral: 0.18,
    weight: 0.95,
    top: ['#365f44', '#507d54', '#749862'],
    edge: '#8ca05e',
    bot: ['#8da588', '#a3b69b', '#b7c4ab'],
    veinTop: 'rgba(222, 232, 196, 0.52)',
    veinBot: 'rgba(238, 240, 222, 0.7)',
    stem: '#594e38',
    mottle: ['rgba(190, 158, 76, 0.18)', 'rgba(42, 74, 49, 0.14)', 'rgba(148, 112, 54, 0.11)'],
  },
  {
    id: 'serrated-ochre',
    species: 'serrated',
    seed: 419,
    dihedral: 0.19,
    weight: 0.92,
    top: ['#677544', '#8e8d4d', '#b4944e'],
    edge: '#c09349',
    bot: ['#b1aa84', '#c5bc96', '#d2c9a6'],
    veinTop: 'rgba(242, 232, 192, 0.5)',
    veinBot: 'rgba(246, 238, 208, 0.68)',
    stem: '#6c5335',
    mottle: ['rgba(166, 102, 46, 0.2)', 'rgba(196, 162, 74, 0.2)', 'rgba(92, 98, 52, 0.14)'],
  },
  {
    id: 'ginkgo-gold',
    species: 'ginkgo',
    seed: 521,
    dihedral: 0.16,
    weight: 0.82,
    top: ['#8e924c', '#bda04b', '#d4b862'],
    edge: '#ddb95c',
    bot: ['#c4b680', '#d4c694', '#dfd3a8'],
    veinTop: 'rgba(248, 238, 196, 0.45)',
    veinBot: 'rgba(248, 242, 214, 0.6)',
    stem: '#76673d',
    mottle: ['rgba(166, 116, 46, 0.16)', 'rgba(130, 142, 72, 0.18)', 'rgba(222, 194, 104, 0.2)'],
  },
  {
    id: 'ginkgo-sage',
    species: 'ginkgo',
    seed: 631,
    dihedral: 0.16,
    weight: 0.85,
    top: ['#597b52', '#829a59', '#b1ad5c'],
    edge: '#c2b262',
    bot: ['#9fb08b', '#b7c19c', '#cacda9'],
    veinTop: 'rgba(234, 238, 202, 0.46)',
    veinBot: 'rgba(242, 244, 220, 0.62)',
    stem: '#64613f',
    mottle: ['rgba(194, 164, 74, 0.2)', 'rgba(72, 104, 68, 0.14)', 'rgba(154, 134, 64, 0.12)'],
  },
  {
    id: 'oak-russet',
    species: 'oak',
    seed: 743,
    dihedral: 0.18,
    weight: 1.12,
    top: ['#7a5133', '#9d6c3e', '#be8e4e'],
    edge: '#b4743e',
    bot: ['#aa8b67', '#be9f7a', '#cbb190'],
    veinTop: 'rgba(238, 216, 174, 0.46)',
    veinBot: 'rgba(242, 226, 194, 0.64)',
    stem: '#5c3f28',
    mottle: ['rgba(158, 72, 44, 0.18)', 'rgba(196, 152, 76, 0.18)', 'rgba(92, 62, 34, 0.16)'],
  },
  {
    id: 'oak-moss',
    species: 'oak',
    seed: 857,
    dihedral: 0.19,
    weight: 1.08,
    top: ['#4b6240', '#6e7b47', '#99884c'],
    edge: '#a57c46',
    bot: ['#949a79', '#abb08f', '#bdbd9e'],
    veinTop: 'rgba(228, 224, 186, 0.46)',
    veinBot: 'rgba(238, 234, 206, 0.64)',
    stem: '#5b4b34',
    mottle: ['rgba(164, 110, 48, 0.2)', 'rgba(74, 96, 56, 0.15)', 'rgba(128, 78, 42, 0.14)'],
  },
  {
    id: 'olive-silver',
    species: 'olive',
    seed: 967,
    dihedral: 0.24,
    weight: 0.88,
    top: ['#3e5c4a', '#53735b', '#6d8a6e'],
    edge: '#829a7d',
    bot: ['#b2bea9', '#c4ceb9', '#d2dac8'],
    veinTop: 'rgba(218, 230, 210, 0.5)',
    veinBot: 'rgba(242, 246, 236, 0.72)',
    stem: '#5a5743',
    mottle: ['rgba(154, 172, 146, 0.16)', 'rgba(46, 74, 58, 0.14)', 'rgba(168, 146, 86, 0.08)'],
  },
  {
    id: 'olive-dried',
    species: 'olive',
    seed: 1087,
    dihedral: 0.24,
    weight: 0.86,
    top: ['#556a4e', '#6f815c', '#8f966a'],
    edge: '#a49b6b',
    bot: ['#babfa6', '#cbd0b8', '#d7dac5'],
    veinTop: 'rgba(228, 232, 204, 0.48)',
    veinBot: 'rgba(244, 244, 228, 0.7)',
    stem: '#665b42',
    mottle: ['rgba(182, 152, 80, 0.18)', 'rgba(76, 94, 64, 0.14)', 'rgba(140, 114, 62, 0.1)'],
  },
  {
    id: 'leaflet-sage',
    species: 'leaflet',
    seed: 1193,
    dihedral: 0.22,
    weight: 0.7,
    top: ['#436f52', '#618e66', '#82a777'],
    edge: '#96b07c',
    bot: ['#9ab094', '#b0c1a8', '#c2cfb9'],
    veinTop: 'rgba(228, 238, 208, 0.52)',
    veinBot: 'rgba(242, 246, 228, 0.68)',
    stem: '#5e563c',
    mottle: ['rgba(184, 156, 74, 0.15)', 'rgba(54, 92, 62, 0.14)'],
  },
  {
    id: 'leaflet-amber',
    species: 'leaflet',
    seed: 1301,
    dihedral: 0.21,
    weight: 0.68,
    top: ['#847743', '#ad934d', '#c6aa60'],
    edge: '#c89b52',
    bot: ['#beb084', '#cfc29a', '#dcd1ae'],
    veinTop: 'rgba(246, 236, 198, 0.48)',
    veinBot: 'rgba(248, 242, 218, 0.65)',
    stem: '#6f5939',
    mottle: ['rgba(164, 102, 46, 0.18)', 'rgba(136, 144, 76, 0.14)'],
  },
]

// Constrói o contorno orgânico fechado de cada espécie botânica em torno do
// centro (SPRITE_CX, SPRITE_CY), com a nervura principal alinhada em x = SPRITE_CX
// (base para baixo em +y, ápice para cima em -y).
function buildLeafGeometry(species, rng) {
  const cx = SPRITE_CX
  const cy = SPRITE_CY
  const asymL = 0.96 + rng() * 0.08
  const asymR = 0.96 + rng() * 0.08
  const lobeShift = (rng() - 0.5) * 0.04

  if (species === 'ginkgo') {
    // Leque bilobado característico do Ginkgo biloba com fenda central.
    const baseY = cy + 32
    const topY = cy - 52
    const petioleEndY = cy + 68
    const halfSpan = 56
    const steps = 34
    const pts = []

    // Borda lateral direita (cunha da base até o canto direito do leque).
    pts.push([cx, baseY])
    for (let i = 1; i <= 10; i++) {
      const t = i / 10
      const x = cx + Math.pow(t, 0.92) * halfSpan * asymR
      const y = baseY - t * 44 - Math.sin(t * Math.PI) * 5
      pts.push([x, y])
    }
    // Margem superior direita ondulada até a fenda central.
    for (let i = 1; i <= steps; i++) {
      const u = i / steps // 0 = borda direita, 1 = fenda central
      const angle = (1 - u) * 0.95
      const wave = Math.sin(u * Math.PI * 5.5) * 2.2 + Math.sin(u * Math.PI * 11) * 0.9
      const cleft = u > 0.84 ? Math.pow((u - 0.84) / 0.16, 1.8) * 19 : 0
      const r = 74 + Math.sin(u * Math.PI) * 10 + wave - cleft
      const x = cx + Math.sin(angle) * r * asymR * 0.86
      const y = baseY - Math.cos(angle) * r
      pts.push([Math.max(cx, x), y])
    }
    // Fundo da fenda central (em x = cx).
    pts.push([cx, topY + 21])
    // Margem superior esquerda (espelhada com leve assimetria natural).
    for (let i = steps - 1; i >= 0; i--) {
      const u = i / steps
      const angle = (1 - u) * 0.95
      const wave = Math.sin(u * Math.PI * 5.2 + 0.5) * 2.2 + Math.sin(u * Math.PI * 10.5) * 0.9
      const cleft = u > 0.84 ? Math.pow((u - 0.84) / 0.16, 1.8) * 19 : 0
      const r = 74 + Math.sin(u * Math.PI) * 9.5 + wave - cleft
      const x = cx - Math.sin(angle) * r * asymL * 0.86
      const y = baseY - Math.cos(angle) * r
      pts.push([Math.min(cx, x), y])
    }
    // Borda lateral esquerda de volta à base.
    for (let i = 9; i >= 1; i--) {
      const t = i / 10
      const x = cx - Math.pow(t, 0.92) * halfSpan * asymL
      const y = baseY - t * 44 - Math.sin(t * Math.PI) * 5
      pts.push([x, y])
    }

    return {
      pts,
      baseY,
      tipY: topY + 21,
      topExtentY: topY - 4,
      petioleEndY,
      maxHalfW: halfSpan,
    }
  }

  // Espécies peninérveas (louro, bétula serrilhada, carvalho, oliveira, folíolo).
  const cfg = {
    laurel: { halfLen: 68, maxW: 28, petiole: 18, steps: 56 },
    serrated: { halfLen: 60, maxW: 38, petiole: 19, steps: 72 },
    oak: { halfLen: 68, maxW: 41, petiole: 17, steps: 84 },
    olive: { halfLen: 68, maxW: 19, petiole: 15, steps: 48 },
    leaflet: { halfLen: 46, maxW: 21, petiole: 13, steps: 44 },
  }[species]

  const baseY = cy + cfg.halfLen - 6
  const tipY = cy - cfg.halfLen - 6
  const span = baseY - tipY
  const petioleEndY = baseY + cfg.petiole

  const widthAt = (t, side) => {
    const asym = side > 0 ? asymR : asymL
    const ts = Math.min(1, Math.max(0, t + (side > 0 ? lobeShift : -lobeShift) * Math.sin(t * Math.PI)))

    if (species === 'laurel') {
      // Perfil elíptico-lanceolado com ápice acuminado suave.
      const env = Math.sin(Math.pow(ts, 0.84) * Math.PI)
      const acuminate = ts > 0.72 ? 1 - Math.pow((ts - 0.72) / 0.28, 2) * 0.22 : 1
      const undul = 1 + 0.025 * Math.sin(ts * Math.PI * 5 + side)
      return cfg.maxW * env * acuminate * undul * asym
    }

    if (species === 'olive') {
      // Lâmina esguia, elegante, afilando suavemente nas duas pontas.
      const env = Math.pow(Math.sin(Math.pow(ts, 0.9) * Math.PI), 0.88)
      const undul = 1 + 0.02 * Math.sin(ts * Math.PI * 4)
      return cfg.maxW * env * undul * asym
    }

    if (species === 'leaflet') {
      // Folíolo oval delicado, base arredondada e ponta sutil.
      const env = Math.sin(Math.pow(ts, 0.74) * Math.PI)
      return cfg.maxW * env * asym
    }

    if (species === 'serrated') {
      // Ovada-cordada mais larga no terço inferior + dentes marginais finos.
      const env = Math.sin(Math.pow(ts, 0.68) * Math.PI) * (0.94 + 0.14 * Math.sin(ts * Math.PI))
      let tooth = 0
      if (t > 0.08 && t < 0.94) {
        const phase = (t * 14.5 + (side > 0 ? 0.15 : 0)) % 1
        // Dente assimétrico apontando para o ápice da folha.
        const saw = phase < 0.72 ? phase / 0.72 : (1 - phase) / 0.28
        tooth = saw * 3.1 * Math.sin(t * Math.PI)
      }
      return Math.max(0, cfg.maxW * env * asym + tooth)
    }

    if (species === 'oak') {
      // Lobos sinuados clássicos de carvalho (4 pares laterais + lobo terminal).
      const env = Math.pow(Math.sin(Math.pow(ts, 0.76) * Math.PI), 0.72)
      const lobeWave = 0.5 + 0.5 * Math.sin(ts * Math.PI * 8.4 - Math.PI * 0.55)
      const shapedLobe = Math.pow(lobeWave, 0.85)
      // Base em cunha estreita; ápice fecha em lobo arredondado.
      const lobeDepth = t > 0.08 && t < 0.88 ? 0.52 + 0.52 * shapedLobe : 0.76
      return cfg.maxW * env * lobeDepth * asym
    }

    return cfg.maxW * Math.sin(t * Math.PI) * asym
  }

  const pts = []
  pts.push([cx, baseY])
  // Lado direito da base ao ápice.
  for (let i = 1; i < cfg.steps; i++) {
    const t = i / cfg.steps
    const y = baseY - t * span
    const w = widthAt(t, 1)
    pts.push([cx + w, y])
  }
  pts.push([cx, tipY])
  // Lado esquerdo do ápice de volta à base.
  for (let i = cfg.steps - 1; i >= 1; i--) {
    const t = i / cfg.steps
    const y = baseY - t * span
    const w = widthAt(t, -1)
    pts.push([cx - w, y])
  }

  return {
    pts,
    baseY,
    tipY,
    topExtentY: tipY,
    petioleEndY,
    maxHalfW: cfg.maxW,
    widthAt,
  }
}

function traceLeafPath(ctx, pts) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1])
  }
  ctx.closePath()
}

// Pinta a lâmina (face superior ou verso) com pigmentação em camadas, manchas
// orgânicas de clorofila, textura fibrosa fina, nervuras com relevo e pecíolo.
function paintLeafFace(ctx, spec, geom, isUnderside) {
  const rng = createRng(spec.seed + (isUnderside ? 997 : 0))
  const cx = SPRITE_CX
  const { pts, baseY, tipY, topExtentY, petioleEndY, maxHalfW, widthAt } = geom
  const palette = isUnderside ? spec.bot : spec.top

  // 1. Pecíolo (cabo) com afinamento orgânico e leve curvatura.
  ctx.save()
  ctx.lineCap = 'round'
  const stemCurveX = cx + (rng() - 0.5) * 2.2
  ctx.strokeStyle = isUnderside ? '#7b745a' : spec.stem
  ctx.lineWidth = spec.species === 'leaflet' ? 1.8 : 2.5
  ctx.beginPath()
  ctx.moveTo(cx, baseY - 2)
  ctx.quadraticCurveTo(stemCurveX, (baseY + petioleEndY) * 0.5, cx + (rng() - 0.5) * 1.4, petioleEndY)
  ctx.stroke()

  // Fio de luz ao longo do pecíolo para dar volume cilíndrico.
  ctx.strokeStyle = 'rgba(244, 236, 212, 0.28)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(cx - 0.6, baseY - 2)
  ctx.quadraticCurveTo(stemCurveX - 0.6, (baseY + petioleEndY) * 0.5, cx - 0.4, petioleEndY - 1)
  ctx.stroke()
  ctx.restore()

  // 2. Recorte na silhueta da folha para todas as camadas de pigmento e nervuras.
  ctx.save()
  traceLeafPath(ctx, pts)
  ctx.clip()

  // Gradiente base longitudinal (mais rico na base/centro, mais luminoso na ponta).
  const baseGrad = ctx.createLinearGradient(cx - maxHalfW * 0.35, baseY, cx + maxHalfW * 0.35, topExtentY)
  baseGrad.addColorStop(0, palette[0])
  baseGrad.addColorStop(0.52, palette[1])
  baseGrad.addColorStop(1, palette[2])
  ctx.fillStyle = baseGrad
  ctx.fillRect(0, 0, SPRITE_W, SPRITE_H)

  // Gradiente transversal sutil: centro ligeiramente mais profundo, margens
  // mais finas e translúcidas (subsurface scattering natural).
  const crossGrad = ctx.createRadialGradient(
    cx,
    (baseY + topExtentY) * 0.52,
    maxHalfW * 0.12,
    cx,
    (baseY + topExtentY) * 0.5,
    maxHalfW * 1.35,
  )
  if (isUnderside) {
    crossGrad.addColorStop(0, 'rgba(235, 240, 224, 0.16)')
    crossGrad.addColorStop(1, 'rgba(92, 98, 76, 0.16)')
  } else {
    crossGrad.addColorStop(0, 'rgba(20, 32, 22, 0.12)')
    crossGrad.addColorStop(0.65, 'rgba(255, 245, 210, 0.03)')
    crossGrad.addColorStop(1, spec.edge + '38')
  }
  ctx.fillStyle = crossGrad
  ctx.fillRect(0, 0, SPRITE_W, SPRITE_H)

  // 3. Manchas orgânicas de pigmentação (variação natural de clorofila / secagem).
  const mottleCount = isUnderside ? 7 : 12
  for (let i = 0; i < mottleCount; i++) {
    const mx = cx + (rng() - 0.5) * maxHalfW * 1.6
    const my = topExtentY + rng() * (baseY - topExtentY)
    const mr = 10 + rng() * (maxHalfW * 0.72)
    const tint = spec.mottle[Math.floor(rng() * spec.mottle.length)]
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr)
    mg.addColorStop(0, tint)
    mg.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = mg
    ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2)
  }

  // Pequenas sardas naturais de folha seca / espécime de herbário (apenas na face).
  if (!isUnderside) {
    const speckCount = spec.species === 'oak' ? 14 : 6
    for (let i = 0; i < speckCount; i++) {
      const sx = cx + (rng() - 0.5) * maxHalfW * 1.5
      const sy = topExtentY + rng() * (baseY - topExtentY)
      const sr = 0.6 + rng() * 1.6
      ctx.fillStyle = rng() < 0.5 ? 'rgba(66, 44, 24, 0.22)' : 'rgba(136, 94, 42, 0.18)'
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 4. Sombra sutil de vincagem ao longo da nervura central (dá sensação de
  // folha ligeiramente côncava/em calha antes mesmo da dobra 3D).
  const creaseW = Math.max(8, maxHalfW * 0.35)
  const crease = ctx.createLinearGradient(cx - creaseW, 0, cx + creaseW, 0)
  crease.addColorStop(0, 'rgba(0, 0, 0, 0)')
  crease.addColorStop(0.47, isUnderside ? 'rgba(245, 246, 232, 0.12)' : 'rgba(20, 26, 18, 0.13)')
  crease.addColorStop(0.5, isUnderside ? 'rgba(255, 255, 242, 0.22)' : 'rgba(240, 242, 214, 0.1)')
  crease.addColorStop(0.53, isUnderside ? 'rgba(245, 246, 232, 0.12)' : 'rgba(20, 26, 18, 0.1)')
  crease.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = crease
  ctx.fillRect(cx - creaseW, topExtentY, creaseW * 2, baseY - topExtentY)

  // 5. Nervuras (dicotômicas para ginkgo, peninérveas com micro-rede nas demais).
  const veinColor = isUnderside ? spec.veinBot : spec.veinTop
  const shadowVein = isUnderside ? 'rgba(54, 58, 44, 0.22)' : 'rgba(18, 26, 16, 0.24)'

  if (spec.species === 'ginkgo') {
    // Nervuras radiantes paralelas/dicotômicas características do Ginkgo.
    const rays = 26
    for (let i = 0; i < rays; i++) {
      const frac = (i / (rays - 1)) * 2 - 1 // -1 .. 1
      if (Math.abs(frac) < 0.05) continue
      const angle = frac * 0.92
      const reach = 84 + (1 - Math.abs(frac)) * 12
      const ex = cx + Math.sin(angle) * reach * 0.88
      const ey = baseY - Math.cos(angle) * reach
      const ctrlX = cx + Math.sin(angle * 0.82) * reach * 0.45
      const ctrlY = baseY - Math.cos(angle * 0.82) * reach * 0.52

      ctx.strokeStyle = shadowVein
      ctx.lineWidth = 1.0
      ctx.beginPath()
      ctx.moveTo(cx + 0.5, baseY + 0.5)
      ctx.quadraticCurveTo(ctrlX + 0.5, ctrlY + 0.5, ex + 0.5, ey + 0.5)
      ctx.stroke()

      ctx.strokeStyle = veinColor
      ctx.lineWidth = isUnderside ? 1.15 : 0.95
      ctx.beginPath()
      ctx.moveTo(cx, baseY)
      ctx.quadraticCurveTo(ctrlX, ctrlY, ex, ey)
      ctx.stroke()
    }
  } else {
    const span = baseY - tipY
    const pairCount = {
      laurel: 9,
      serrated: 8,
      oak: 6,
      olive: 8,
      leaflet: 6,
    }[spec.species]

    // Nervuras secundárias + ramificações terciárias finas.
    for (let i = 1; i <= pairCount; i++) {
      const t = i / (pairCount + 1.15)
      for (const side of [-1, 1]) {
        const y0 = baseY - t * span + (side > 0 ? 1.5 : -1.5)
        const targetT = Math.min(0.95, t + (spec.species === 'olive' ? 0.16 : 0.13))
        const localW = widthAt ? widthAt(targetT, side) : maxHalfW * Math.sin(targetT * Math.PI)
        const reach = localW * (spec.species === 'serrated' ? 0.95 : 0.9)
        if (reach < 2.5) continue

        const ex = cx + side * reach
        const ey = baseY - targetT * span
        const midX = cx + side * reach * 0.55
        const midY = y0 - (y0 - ey) * 0.34

        // Sombra fina junto à nervura (sensação de relevo tátil).
        ctx.strokeStyle = shadowVein
        ctx.lineWidth = (1 - t * 0.5) * (isUnderside ? 1.65 : 1.35)
        ctx.beginPath()
        ctx.moveTo(cx, y0 + 0.8)
        ctx.quadraticCurveTo(midX, midY + 0.8, ex, ey + 0.8)
        ctx.stroke()

        // Nervura luminosa.
        ctx.strokeStyle = veinColor
        ctx.lineWidth = (1 - t * 0.5) * (isUnderside ? 1.5 : 1.2)
        ctx.beginPath()
        ctx.moveTo(cx, y0)
        ctx.quadraticCurveTo(midX, midY, ex, ey)
        ctx.stroke()

        // Micro-nervuras terciárias ramificando para a borda (dá realismo macro).
        if (reach > 10) {
          ctx.strokeStyle = veinColor
          ctx.globalAlpha = 0.55
          ctx.lineWidth = 0.65
          const b1x = cx + side * reach * 0.54
          const b1y = y0 - (y0 - ey) * 0.42
          ctx.beginPath()
          ctx.moveTo(b1x, b1y)
          ctx.lineTo(b1x + side * reach * 0.34, b1y - 6.5)
          ctx.moveTo(b1x + side * reach * 0.14, b1y - 2)
          ctx.lineTo(b1x + side * reach * 0.32, b1y + 4.5)
          ctx.stroke()
          ctx.globalAlpha = 1
        }
      }
    }

    // Nervura principal central com afinamento contínuo da base até a ponta.
    const segs = 16
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs
      const t1 = (i + 1) / segs
      const y0 = baseY - t0 * span
      const y1 = baseY - t1 * span
      const w = (1 - t0 * 0.82) * (isUnderside ? 3.1 : 2.55)

      ctx.strokeStyle = shadowVein
      ctx.lineWidth = w + 0.8
      ctx.beginPath()
      ctx.moveTo(cx + 0.55, y0)
      ctx.lineTo(cx + 0.55, y1)
      ctx.stroke()

      ctx.strokeStyle = veinColor
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(cx, y0)
      ctx.lineTo(cx, y1)
      ctx.stroke()
    }
  }

  // 6. Borda translúcida morna (luz atravessando a borda fina da folha) + fio
  // natural delicado para definição sobre o papel claro.
  traceLeafPath(ctx, pts)
  ctx.strokeStyle = isUnderside ? 'rgba(232, 232, 210, 0.28)' : 'rgba(235, 224, 178, 0.24)'
  ctx.lineWidth = 2.2
  ctx.stroke()

  traceLeafPath(ctx, pts)
  ctx.strokeStyle = isUnderside ? 'rgba(66, 68, 52, 0.24)' : 'rgba(35, 28, 22, 0.24)'
  ctx.lineWidth = 0.85
  ctx.stroke()

  ctx.restore()
}

// Máscara de brilho especular suave da cutícula (usada em tempo real quando a
// normal 3D de uma metade da folha alinha com a luz solar).
function paintSpecularMask(ctx, geom) {
  const { pts, baseY, topExtentY, maxHalfW } = geom
  ctx.save()
  traceLeafPath(ctx, pts)
  ctx.clip()

  const grad = ctx.createLinearGradient(
    SPRITE_CX - maxHalfW * 0.8,
    topExtentY,
    SPRITE_CX + maxHalfW * 0.8,
    baseY,
  )
  grad.addColorStop(0, 'rgba(255, 250, 230, 0.85)')
  grad.addColorStop(0.45, 'rgba(255, 246, 214, 0.42)')
  grad.addColorStop(1, 'rgba(255, 242, 200, 0.12)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, SPRITE_W, SPRITE_H)
  ctx.restore()
}

// Máscara de sombra própria (escurece sutilmente a face voltada contra o sol).
function paintShadeMask(ctx, geom) {
  const { pts } = geom
  ctx.save()
  traceLeafPath(ctx, pts)
  ctx.fillStyle = '#241e16'
  ctx.fill()
  ctx.restore()
}

// Sombra projetada pré-desfocada em sépia quente (blur calculado UMA única vez
// na montagem — custo zero de filter por frame durante a animação).
function paintCastShadow(ctx, geom) {
  const { pts, baseY, petioleEndY } = geom
  const cx = SPRITE_CX

  const drawShape = (alpha, ox = 0, oy = 0) => {
    ctx.save()
    ctx.translate(ox, oy)
    ctx.fillStyle = `rgba(42, 31, 20, ${alpha})`
    ctx.strokeStyle = `rgba(42, 31, 20, ${alpha})`
    traceLeafPath(ctx, pts)
    ctx.fill()
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx, baseY - 2)
    ctx.lineTo(cx, petioleEndY)
    ctx.stroke()
    ctx.restore()
  }

  if ('filter' in ctx) {
    ctx.save()
    ctx.filter = 'blur(5.5px)'
    drawShape(0.85)
    ctx.restore()
  } else {
    // Fallback suave sem ctx.filter.
    drawShape(0.28, 0, 0)
    drawShape(0.16, -2, -2)
    drawShape(0.16, 2, 2)
    drawShape(0.12, -2, 2)
    drawShape(0.12, 2, -2)
  }
}

// Gera o atlas completo de espécimes botânicos uma única vez.
export function buildLeafAtlas() {
  return SPECIMENS.map((spec) => {
    const rng = createRng(spec.seed)
    const geom = buildLeafGeometry(spec.species, rng)

    const top = makeCanvas()
    paintLeafFace(top.getContext('2d'), spec, geom, false)

    const bot = makeCanvas()
    paintLeafFace(bot.getContext('2d'), spec, geom, true)

    const specMask = makeCanvas()
    paintSpecularMask(specMask.getContext('2d'), geom)

    const shadeMask = makeCanvas()
    paintShadeMask(shadeMask.getContext('2d'), geom)

    const shadow = makeCanvas()
    paintCastShadow(shadow.getContext('2d'), geom)

    return {
      id: spec.id,
      species: spec.species,
      dihedral: spec.dihedral,
      weight: spec.weight,
      top,
      bot,
      specMask,
      shadeMask,
      shadow,
    }
  })
}

// Campo de vento coerente e suave: brisa predominante da esquerda/topo para a
// direita/baixo com rajadas lentas que respiram e redemoinhos espaciais contínuos
// derivados de função de corrente (para folhas próximas sentirem a mesma corrente).
export function sampleWind(x, y, t) {
  // Envelope de rajada lenta: alterna calmarias contemplativas e sopros suaves.
  const gust =
    0.72 +
    0.32 * Math.sin(t * 0.21) +
    0.18 * Math.sin(t * 0.47 + 1.35) +
    0.12 * Math.sin(t * 0.11 + 3.2)

  // Redemoinhos amplos em coordenadas espaciais suaves.
  const sx = x * 0.0021 - t * 0.19
  const sy = y * 0.0026 + t * 0.07
  const swirlX = Math.cos(sy * 1.4 + Math.sin(sx * 0.9)) * 18 + Math.sin(sx * 0.7 - sy * 0.8 + t * 0.28) * 11
  const swirlY = Math.sin(sx * 1.3 + Math.cos(sy * 0.85)) * 14 + Math.cos(sx * 0.6 + sy * 1.1 - t * 0.24) * 9

  // Corrente ascendente sutil que ergue ou abaixa a folha acima do papel.
  const updraft = Math.sin(sx * 1.1 + sy * 0.9 + t * 0.34) * 0.55 + (gust - 0.85) * 0.8

  return {
    vx: 34 * gust + swirlX,
    vy: 13 * gust + swirlY * 0.65,
    gust,
    updraft,
  }
}

// Calcula a base ortonormal 3D (eX, eY, eZ) da folha a partir de (yaw, pitch, roll):
// R = Rz(yaw) * Rx(pitch) * Ry(roll).
export function leafBasis3D(yaw, pitch, roll) {
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const cr = Math.cos(roll)
  const sr = Math.sin(roll)

  // Coluna 0 (eixo X local: largura da folha)
  const xx = cy * cr - sy * sp * sr
  const xy = sy * cr + cy * sp * sr
  const xz = -cp * sr

  // Coluna 1 (eixo Y local: ao longo da nervura central)
  const yx = -sy * cp
  const yy = cy * cp
  const yz = sp

  // Coluna 2 (eixo Z local: normal saindo da face superior)
  const zx = cy * sr + sy * sp * cr
  const zy = sy * sr - cy * sp * cr
  const zz = cp * cr

  return {
    eX: { x: xx, y: xy, z: xz },
    eY: { x: yx, y: yy, z: yz },
    eZ: { x: zx, y: zy, z: zz },
  }
}
