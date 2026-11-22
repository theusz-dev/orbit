import { useEffect, useRef } from 'react'

// Ajusta o canvas ao elemento pai (DPR <= 2), executa `draw` a cada frame
// enquanto visível e não oculto, suaviza o ponteiro (-1..1) e renderiza um
// único frame estático quando prefers-reduced-motion ou o modo Leve está ativo.
export function useCanvasLoop(setup, draw) {
  const canvasRef = useRef(null)
  const setupRef = useRef(setup)
  const drawRef = useRef(draw)

  useEffect(() => {
    setupRef.current = setup
    drawRef.current = draw
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const isReduced = () => {
      const attr = document.documentElement.getAttribute('data-motion')
      if (attr === 'reduced') return true
      if (attr === 'full') return false
      return reduceMotion.matches
    }

    let width = 0
    let height = 0
    let isSmall = false
    let raf = 0
    let visible = true
    let start = performance.now()
    let frozenAt = 0
    const target = { x: 0, y: 0 }
    const pointer = { x: 0, y: 0 }

    const renderFrame = (now) => {
      const reduced = isReduced()
      const time = reduced ? frozenAt : (now - start) / 1000
      pointer.x += (target.x - pointer.x) * 0.04
      pointer.y += (target.y - pointer.y) * 0.04
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const dpr = canvas.width / Math.max(width, 1)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawRef.current({ ctx, width, height, time, pointer, isSmall })
    }

    const loop = (now) => {
      renderFrame(now)
      if (visible && !isReduced() && !document.hidden) {
        raf = requestAnimationFrame(loop)
      } else {
        raf = 0
      }
    }

    const kick = () => {
      if (!raf && visible && !isReduced() && !document.hidden) {
        raf = requestAnimationFrame(loop)
      }
    }

    const resize = () => {
      const rect = parent.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      isSmall = width < 720
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      setupRef.current({ width, height, isSmall })
      renderFrame(performance.now())
      kick()
    }

    const onPointer = (event) => {
      if (event.pointerType !== 'mouse') return
      target.x = (event.clientX / window.innerWidth) * 2 - 1
      target.y = (event.clientY / window.innerHeight) * 2 - 1
    }

    const onMotionChange = () => {
      if (isReduced()) {
        frozenAt = (performance.now() - start) / 1000
        cancelAnimationFrame(raf)
        raf = 0
        renderFrame(performance.now())
      } else {
        start = performance.now() - frozenAt * 1000
        kick()
      }
    }

    const onVisibility = () => {
      if (!document.hidden) kick()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(parent)

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) kick()
    })
    intersection.observe(canvas)

    const motionObserver = new MutationObserver(onMotionChange)
    motionObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-motion'],
    })

    window.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    reduceMotion.addEventListener('change', onMotionChange)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersection.disconnect()
      motionObserver.disconnect()
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
      reduceMotion.removeEventListener('change', onMotionChange)
    }
  }, [])

  return canvasRef
}
