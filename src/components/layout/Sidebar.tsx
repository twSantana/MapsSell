'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions'
import type { User } from '@supabase/supabase-js'
import { useMapTheme, MAP_THEMES, ThemeKey } from '@/contexts/ThemeContext'
import styles from './Sidebar.module.css'

const navItems = [
  { href: '/', icon: '🗺️', label: 'Mapa' },
  { href: '/casas', icon: '🏠', label: 'Casas' },
  { href: '/ruas', icon: '🛣️', label: 'Ruas' },
  { href: '/vendedores', icon: '👥', label: 'Vendedores' },
]

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname()
  const { mapTheme, setMapTheme } = useMapTheme()

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoIcon}>📍</span>
        <div>
          <span className={styles.logoTitle}>GeoCRM</span>
          <span className={styles.logoSub}>Vendas Externas</span>
        </div>
      </div>

      {/* Navegação */}
      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
              {isActive && <span className={styles.activeDot} />}
            </Link>
          )
        })}
      </nav>

      {/* Rodapé: usuário e sair */}
      <div className={styles.footer}>
        <div className={styles.themeSelector}>
          <select 
            className="select select-bordered select-sm w-full" 
            style={{ marginBottom: '12px' }}
            value={mapTheme} 
            onChange={(e) => setMapTheme(e.target.value as ThemeKey)}
          >
            {(Object.keys(MAP_THEMES) as ThemeKey[]).map((key) => (
              <option key={key} value={key}>Tema: {MAP_THEMES[key].name}</option>
            ))}
          </select>
        </div>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {user.email?.charAt(0).toUpperCase()}
          </div>
          <div className={styles.userDetails}>
            <span className={styles.userName}>{user.email?.split('@')[0]}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>
        </div>
        <form action={logout}>
          <button type="submit" className={`btn btn-ghost btn-sm btn-full`} style={{ marginTop: '8px' }}>
            Sair
          </button>
        </form>
      </div>
    </aside>
  )
}
