import { memo, useMemo } from 'react'
import { useSiteCard } from '../hooks/useSiteCard'
import { hashName } from '../utils/hash'
import SiteIcon from './SiteIcon'
import SiteCardActions from './SiteCardActions'

// Layout "Dunas" (tema Horizonte): placa astronômica compacta e silenciosa.
// Vidro escuro translúcido com micro-marcações no topo, poeira estelar, um
// ponto de difração sutil, carimbo itálico discreto e ícone em cores originais.
function SiteCardDunas({ site }) {
  const { rootProps, showActions, open, edit, remove } = useSiteCard(site)

  const { plateNo, starShift, glintAlt } = useMemo(() => {
    const hash = hashName(site.name)
    return {
      plateNo: String((hash % 89) + 11).padStart(2, '0'),
      starShift: `${hash % 59}px ${(hash >> 3) % 41}px`,
      glintAlt: (hash >> 1) % 2 === 1,
    }
  }, [site.name])

  return (
    <div {...rootProps} className="dunas-site group relative flex flex-col items-center card-contain">
      <button
        type="button"
        className="dunas-plate relative w-[88px] h-[80px] sm:w-[100px] sm:h-[90px] overflow-hidden"
        onClick={open}
        aria-label={`Abrir ${site.name}`}
      >
        <span className="dunas-plate-ticks" aria-hidden />
        <span className="dunas-plate-stars" style={{ backgroundPosition: starShift }} aria-hidden />
        <span className="dunas-plate-haze" aria-hidden />
        <span className="dunas-glint" data-alt={glintAlt || undefined} aria-hidden />

        <em className="dunas-plate-id" aria-hidden>Pl. {plateNo}</em>

        <span className="dunas-icon" aria-hidden>
          <SiteIcon
            name={site.name}
            url={site.url}
            alt=""
            imgClassName="w-10 h-10 sm:w-11 sm:h-11 object-contain"
            fallbackClassName="w-10 h-10 sm:w-11 sm:h-11 text-lg font-medium"
          />
        </span>
      </button>

      <h3 className="dunas-name">{site.name}</h3>

      {showActions && <SiteCardActions site={site} onEdit={edit} onDelete={remove} className="absolute -top-2 -right-2" />}
    </div>
  )
}

export default memo(SiteCardDunas)
