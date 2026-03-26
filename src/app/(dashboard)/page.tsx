'use client'

import dynamic from 'next/dynamic'
import styles from './page.module.css'

const MapboxView = dynamic(() => import('@/components/map/MapboxView'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Carregando mapa...</div>
})

export default function MapPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Mapa de Vendas</h1>
          <p className={styles.subtitle}>Clique no mapa para cadastrar uma nova casa</p>
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={`${styles.dot} ${styles.dotGreen}`} /> Cliente
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.dot} ${styles.dotRed}`} /> Não cliente
          </span>
          <span className={styles.legendItem}>
            <span className={`${styles.dot} ${styles.dotBlue}`} /> Vendedor
          </span>
        </div>
      </div>
      <div className={styles.mapWrapper}>
        <MapboxView />
      </div>
    </div>
  )
}
