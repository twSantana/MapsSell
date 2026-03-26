import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import styles from './dashboard.module.css'
import { MapThemeProvider } from '@/contexts/ThemeContext'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <MapThemeProvider>
      <div className={styles.wrapper}>
        <Sidebar user={user} />
        <main className={styles.main}>{children}</main>
      </div>
    </MapThemeProvider>
  )
}


