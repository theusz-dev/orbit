import ParticleTerrain from './ParticleTerrain'

// Moldura do deserto à noite (tema Horizonte): quadro arredondado com céu
// estrelado girando, lua de brilho suave, vinheta e dunas de partículas.
export default function HorizonteBackdrop() {
  return (
    <div className="horizonte-frame" aria-hidden="true">
      <ParticleTerrain className="horizonte-canvas" />
      <div className="horizonte-moon gpu-layer" data-decorative aria-hidden="true" />
      <div className="horizonte-vignette" aria-hidden="true" />
    </div>
  )
}
