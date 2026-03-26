'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SellerLocation } from '@/lib/types'
import styles from './vendedores.module.css'

export default function VendedoresPage() {
  const supabase = createClient()
  const [sellers, setSellers] = useState<SellerLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })

    supabase
      .from('sellers_locations')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setSellers(data)
        setLoading(false)
      })

    // Realtime
    const channel = supabase
      .channel('realtime:sellers_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers_locations' }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          setSellers((prev) => {
            const exists = prev.find((s) => s.user_id === (payload.new as SellerLocation).user_id)
            if (exists) {
              return prev.map((s) => s.user_id === (payload.new as SellerLocation).user_id ? payload.new as SellerLocation : s)
            }
            return [payload.new as SellerLocation, ...prev]
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  function getTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return 'Agora'
    if (min < 60) return `${min} min atrás`
    return `${Math.floor(min / 60)}h atrás`
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vendedores em Campo</h1>
          <p className={styles.subtitle}>{sellers.length} vendedores com localização registrada</p>
        </div>
        <span className={`badge badge-success`}>● Tempo Real</span>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando...</div>
      ) : sellers.length === 0 ? (
        <div className={styles.empty}>Nenhum vendedor com localização ativa.</div>
      ) : (
        <div className={styles.list}>
          {sellers.map((seller) => {
            const isMe = seller.user_id === currentUserId
            return (
              <div key={seller.id} className={`${styles.item} ${isMe ? styles.isMe : ''}`}>
                <div className={styles.avatar}>
                  {isMe ? '🧭' : '👤'}
                </div>
                <div className={styles.info}>
                  <p className={styles.name}>
                    {isMe ? 'Você' : `Vendedor`}
                    {isMe && <span className={`badge badge-primary`} style={{ marginLeft: 8, fontSize: 10 }}>EU</span>}
                  </p>
                  <p className={styles.coords}>
                    📍 {seller.lat.toFixed(5)}, {seller.lng.toFixed(5)}
                  </p>
                </div>
                <div className={styles.time}>
                  <span className={`badge ${styles.timeBadge}`}>
                    🕐 {getTimeAgo(seller.updated_at)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
