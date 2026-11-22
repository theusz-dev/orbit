// Componente SiteCard — delega para o layout correto via store
import { memo } from 'react'
import useStore from '../store/useStore'
import SiteCardClassic from './SiteCardClassic'
import SiteCardWaveParticle from './SiteCardWaveParticle'
import SiteCardQuantumSpin from './SiteCardQuantumSpin'
import SiteCardCyberpunk from './SiteCardCyberpunk'
import SiteCardArchive from './SiteCardArchive'
import SiteCardAndroid from './SiteCardAndroid'
import SiteCardBerserk from './SiteCardBerserk'
import SiteCardTanzaku from './SiteCardTanzaku'
import SiteCardExsicata from './SiteCardExsicata'
import SiteCardDunas from './SiteCardDunas'

// id do layout (utils/cardLayout.js) -> componente. Id desconhecido cai no Clássico.
const LAYOUT_COMPONENTS = {
  'wave-particle': SiteCardWaveParticle,
  'quantum-spin': SiteCardQuantumSpin,
  cyber: SiteCardCyberpunk,
  archive: SiteCardArchive,
  android: SiteCardAndroid,
  berserk: SiteCardBerserk,
  tanzaku: SiteCardTanzaku,
  exsicata: SiteCardExsicata,
  dunas: SiteCardDunas,
}

function SiteCard({ site }) {
  const cardLayout = useStore((state) => state.cardLayout)
  const Layout = LAYOUT_COMPONENTS[cardLayout] || SiteCardClassic

  return <Layout site={site} />
}

export default memo(SiteCard)
