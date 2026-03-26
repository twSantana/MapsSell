import React, { useEffect } from 'react'
import styles from './SidePanel.module.css'

interface Props {
  title: React.ReactNode
  subtitle?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}

export default function SidePanel({ title, subtitle, onClose, children }: Props) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  )
}
