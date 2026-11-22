import useStore from '../store/useStore'

// Cabeçalho de três colunas dos temas mais recentes. O texto é dado aqui; o
// visual é todo do CSS de cada tema (`[data-theme="x"] .theme-masthead`).
const MASTHEADS = {
  sumie: { label: 'Sumi-e', left: '墨絵', center: 'Sumi-e', right: '静' },
  herbario: { label: 'Herbário Orbit', left: 'Flora & Rede · Séc. XIX', center: 'Herbarium', right: 'Catálogo Geral' },
  horizonte: { label: 'Horizonte', left: 'Observatório · Breu', center: 'Horizonte', right: 'Carta Celeste' },
}

export default function ThemeMasthead() {
  const theme = useStore((state) => state.theme)
  const masthead = MASTHEADS[theme]
  if (!masthead) return null

  return (
    <header className="theme-masthead" aria-label={masthead.label}>
      <span>{masthead.left}</span>
      <strong>{masthead.center}</strong>
      <span>{masthead.right}</span>
    </header>
  )
}
